import { Canvas } from '@react-three/fiber'
import { memo, useMemo, useState } from 'react'
import type { AgentView, SessionRef } from '../../../shared/office/types'
import type { FrameMetrics } from '../frame-metrics'
import { usePrefersReducedMotion } from '../hooks'
import { BAND_ZOOM, ISO_POLAR, ISO_START_AZIMUTH, type ZoomBand } from '../logic/camera-bands'
import type { NameCard, ProjectStack } from '../logic/name-cards'
import { useOfficeSettings } from '../logic/office-settings'
import { groupZonesByTheme, resolveTheme, useThemeAssignments } from '../logic/office-themes'
import type { CameraRequest } from '../logic/office-reducer'
import type { WallsMode } from '../logic/room-layout'
import { SCENE_BACKGROUND } from '../office-palette'
import type { FloorGeometry } from '../scene-model'
import { CameraRig } from './CameraRig'
import { FloorView } from './FloorView'
import { Horizon } from './Horizon'
import { CardProjector, type CardAnchors } from './CardProjector'
import { NameCardLayer } from './NameCards'
import { FrameGovernor, MetricsProbe } from './RenderLoop'
import { RobotCrew } from './Robot'
import { BatchedScene } from './BatchedScene'
import { TowerView } from './WorldView'
import { ZonePickers } from './ZonePickers'
import { MoverLayer } from '../citizens/MoverLayer'
import { PlayerLayer } from '../player/PlayerLayer'
import { sendPlayer, type Player } from '../player/walking'
import { useQualitySettings } from '../quality-store'
import { TOWER_STOREY_M } from '../themes/layout'
import { GROUND_Y, MAX_LOT_HEIGHT_M, sceneExtent } from '../themes/surroundings'
import type { OfficeTheme, TowerFloor } from '../themes/types'
import { TownGround } from '../town/TownGround'
import { dressOf, TownAmbient, TownView } from '../town/TownView'
import { useTownPlan } from '../town/use-town-plan'

interface OfficeSceneProps {
  // The floor's default: zones without a company or project theme inherit it.
  theme: OfficeTheme
  floors: readonly TowerFloor[]
  sessions: readonly SessionRef[]
  onFlyToZone: (zoneId: string) => void
  floor: FloorGeometry
  agents: readonly AgentView[]
  cards: readonly NameCard[]
  stacks: readonly ProjectStack[]
  selectedAgentKey: string | null
  wallsMode: WallsMode
  cameraRequest: CameraRequest | null
  metrics: FrameMetrics
  onSelectAgent: (agentKey: string | null) => void
  onFlyToAgent: (agentKey: string) => void
  reviewableKeys: ReadonlySet<string>
  onReview: (sessionKey: string) => void
  speakingAgentKey: string | null
  // The owner's own character; null until the floor it stands on is known.
  player?: Player | null
  isWalking?: boolean
}

// Orthographic distance only sets clipping, not size; zoom sets size.
const CAMERA_DISTANCE = 60
const INITIAL_CAMERA_POSITION: [number, number, number] = [
  CAMERA_DISTANCE * Math.sin(ISO_POLAR) * Math.sin(ISO_START_AZIMUTH),
  CAMERA_DISTANCE * Math.cos(ISO_POLAR),
  CAMERA_DISTANCE * Math.sin(ISO_POLAR) * Math.cos(ISO_START_AZIMUTH)
]

// Other floors are storeys in the building overview; only the focused plate has agents.
function OfficeScene(props: OfficeSceneProps) {
  const isReducedMotion = usePrefersReducedMotion()
  const [band, setBand] = useState<ZoomBand>('floor')
  const [anchors] = useState<CardAnchors>(() => ({
    cards: new Map(),
    dots: new Map(),
    stacks: new Map()
  }))
  // Serialising the floor is costly; redo it only when an input to the batches changes.
  const { theme, floor, agents, selectedAgentKey, speakingAgentKey, isWalking = false } = props
  // The owner's switches: a feature that is off is not mounted, so it costs no frame work.
  const settings = useOfficeSettings()
  const player = settings.player ? props.player : null
  const assignments = useThemeAssignments()
  const zoneGroups = useMemo(
    () => groupZonesByTheme(floor, (zone) => resolveTheme(zone, assignments, theme.id)),
    [floor, assignments, theme.id]
  )
  const revision = useMemo(
    () =>
      JSON.stringify([
        theme.id,
        zoneGroups.map((zoneGroup) => [
          zoneGroup.themeId,
          [...zoneGroup.companies, ...zoneGroup.projects, ...zoneGroup.rooms].map(({ id }) => id)
        ]),
        floor,
        selectedAgentKey,
        speakingAgentKey,
        agents.map((agent) => [agent.agentKey, agent.provider, agent.isSubagent])
      ]),
    [theme.id, zoneGroups, floor, agents, selectedAgentKey, speakingAgentKey]
  )
  // The detail level in use: how sharply and how often the scene is drawn. The plan thins the
  // town by that level itself.
  const quality = useQualitySettings()
  const town = useTownPlan(floor)
  // In walk mode the owner's character may set off at any moment, so the walking rate holds.
  const pace = useMemo(
    () => ({ idleFps: isWalking ? quality.walkFps : quality.idleFps, walkFps: quality.walkFps }),
    [isWalking, quality.idleFps, quality.walkFps]
  )
  // What the player and the citizens go round: the town's lots and the plots of the belt.
  const solids = useMemo(
    () => (settings.town ? [...town.plan.lots, ...town.green] : []),
    [town, settings.town]
  )
  // How far the scene reaches: the town to its last road, or the floor alone without one.
  const reach = useMemo(
    () => (settings.town ? town.plan.extent : sceneExtent(floor, [])),
    [town.plan, floor, settings.town]
  )
  const walkTo = useMemo(
    () =>
      isWalking && player
        ? (point: { x: number; z: number }) => sendPlayer(player, point)
        : undefined,
    [isWalking, player]
  )
  const storeyCount = props.floors.length
  const sceneBox = useMemo(
    () => ({
      ...reach,
      minY: GROUND_Y,
      maxY: MAX_LOT_HEIGHT_M + storeyCount * TOWER_STOREY_M
    }),
    [reach, storeyCount]
  )
  const liveSessionKeys = useMemo(
    () => new Set(props.sessions.map((session) => session.key)),
    [props.sessions]
  )
  return (
    <div className="absolute inset-0" data-scene-root="">
      {/* The image role sits on the canvas alone: around the card layer it would hide its buttons. */}
      <Canvas
        role="img"
        aria-label={`Isometric view of the ${props.floor.label} floor`}
        orthographic
        frameloop="demand"
        flat
        dpr={[1, quality.maxPixelRatio]}
        gl={{ powerPreference: 'low-power', alpha: false, antialias: true }}
        camera={{ zoom: BAND_ZOOM.floor, near: 1, far: 200, position: INITIAL_CAMERA_POSITION }}
        onPointerMissed={() => props.onSelectAgent(null)}
      >
        <color attach="background" args={[SCENE_BACKGROUND]} />
        <hemisphereLight args={['#FFF3DD', '#3A3A40', 2.2]} />
        <directionalLight position={[10, 20, 6]} intensity={1.8} />
        <Horizon box={sceneBox} color={theme.palette.stone} />
        {settings.town && <TownGround plan={town.plan} dress={dressOf(theme)} />}
        <BatchedScene revision={revision}>
          <FloorView
            floorTheme={theme}
            zoneGroups={zoneGroups}
            floor={floor}
            wallsMode={props.wallsMode}
            isReducedMotion={isReducedMotion}
          />
          <RobotCrew
            agents={agents}
            zoneGroups={zoneGroups}
            floorTheme={theme}
            selectedAgentKey={selectedAgentKey}
            speakingAgentKey={speakingAgentKey}
            isReducedMotion={isReducedMotion}
            onSelect={props.onSelectAgent}
            onFly={props.onFlyToAgent}
          />
        </BatchedScene>
        {settings.town && (
          <>
            <TowerView plan={town.plan} theme={theme} floors={props.floors} band={band} />
            <TownView town={town} floor={floor} floorTheme={theme} zoneGroups={zoneGroups} />
            {settings.ambient && (
              <TownAmbient
                town={town}
                floor={floor}
                floorTheme={theme}
                zoneGroups={zoneGroups}
                share={quality.ambientShare}
                isReducedMotion={isReducedMotion}
              />
            )}
          </>
        )}
        <ZonePickers
          floor={props.floor}
          onFly={props.onFlyToZone}
          onMiss={() => props.onSelectAgent(null)}
          onWalk={walkTo}
        />
        {settings.citizens && settings.town && (
          <MoverLayer
            floor={floor}
            plan={town.plan}
            owners={town.owners}
            floorTheme={theme}
            zoneGroups={zoneGroups}
            player={player}
            isReducedMotion={isReducedMotion}
            // The layer reads the detail level itself: a share here would cut the count twice.
            citizenShare={1}
            hasVehicles={settings.vehicles}
          />
        )}
        {player && (
          <PlayerLayer
            player={player}
            isWalking={isWalking}
            floor={floor}
            solids={solids}
            extent={reach}
            agents={agents}
            palette={theme.palette}
            isReducedMotion={isReducedMotion}
            onSelectAgent={props.onSelectAgent}
          />
        )}
        <CardProjector
          cards={props.cards}
          stacks={props.stacks}
          anchors={anchors}
          band={band}
          selectedAgentKey={props.selectedAgentKey}
        />
        <CameraRig
          floorCount={props.floors.length}
          scene={sceneBox}
          floor={props.floor}
          agents={props.agents}
          liveSessionKeys={liveSessionKeys}
          request={props.cameraRequest}
          isReducedMotion={isReducedMotion}
          isWalking={isWalking}
          onBandChange={setBand}
        />
        <FrameGovernor pace={pace} agents={agents} />
        <MetricsProbe metrics={props.metrics} />
      </Canvas>
      <NameCardLayer
        cards={props.cards}
        stacks={props.stacks}
        onFlyToZone={props.onFlyToZone}
        reviewableKeys={props.reviewableKeys}
        onReview={props.onReview}
        band={band}
        selectedAgentKey={props.selectedAgentKey}
        anchors={anchors}
      />
    </div>
  )
}

// Selecting, notices and the HUD's own state re-render the app; the scene follows its props.
export default memo(OfficeScene)
