import { Canvas } from '@react-three/fiber'
import { memo, useMemo, useState } from 'react'
import type { AgentView, SessionRef } from '../../../shared/office/types'
import type { FrameMetrics } from '../frame-metrics'
import { usePrefersReducedMotion } from '../hooks'
import { BAND_ZOOM, ISO_POLAR, ISO_START_AZIMUTH, type ZoomBand } from '../logic/camera-bands'
import type { NameCard, ProjectStack } from '../logic/name-cards'
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
import { SurroundingsView, WorldView } from './WorldView'
import { ZonePickers } from './ZonePickers'
import { CitizenLayer } from '../citizens/CitizenLayer'
import { districtLots } from '../player/district-lots'
import { PlayerLayer } from '../player/PlayerLayer'
import { Streets } from '../player/Streets'
import { sendPlayer, type Player } from '../player/walking'
import { TOWER_STOREY_M } from '../themes/layout'
import { GROUND_Y, MAX_LOT_HEIGHT_M, sceneExtent, surroundingLots } from '../themes/surroundings'
import type { OfficeTheme, TowerFloor } from '../themes/types'

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
  const {
    theme,
    floor,
    agents,
    selectedAgentKey,
    speakingAgentKey,
    player,
    isWalking = false
  } = props
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
  const lots = useMemo(() => surroundingLots(floor), [floor])
  // What the player and the streets go round: the ring's lots and the floor theme's district.
  const solids = useMemo(() => [...lots, ...districtLots(theme.id, floor)], [lots, theme.id, floor])
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
      ...sceneExtent(floor, lots),
      minY: GROUND_Y,
      maxY: MAX_LOT_HEIGHT_M + storeyCount * TOWER_STOREY_M
    }),
    [floor, lots, storeyCount]
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
        dpr={[1, 1.5]}
        gl={{ powerPreference: 'low-power', alpha: false, antialias: true }}
        camera={{ zoom: BAND_ZOOM.floor, near: 1, far: 200, position: INITIAL_CAMERA_POSITION }}
        onPointerMissed={() => props.onSelectAgent(null)}
      >
        <color attach="background" args={[SCENE_BACKGROUND]} />
        <hemisphereLight args={['#FFF3DD', '#3A3A40', 2.2]} />
        <directionalLight position={[10, 20, 6]} intensity={1.8} />
        <Horizon box={sceneBox} color={theme.palette.stone} />
        <Streets floor={floor} solids={solids} color={theme.palette.ink} />
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
        <WorldView theme={props.theme} floor={props.floor} floors={props.floors} band={band} />
        <SurroundingsView
          floor={floor}
          floorTheme={theme}
          zoneGroups={zoneGroups}
          lots={lots}
          isReducedMotion={isReducedMotion}
        />
        <ZonePickers
          floor={props.floor}
          onFly={props.onFlyToZone}
          onMiss={() => props.onSelectAgent(null)}
          onWalk={walkTo}
        />
        <CitizenLayer
          floor={floor}
          solids={solids}
          floorTheme={theme}
          zoneGroups={zoneGroups}
          player={player}
          isReducedMotion={isReducedMotion}
        />
        {player && (
          <PlayerLayer
            player={player}
            isWalking={isWalking}
            floor={floor}
            solids={solids}
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
        <FrameGovernor />
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
