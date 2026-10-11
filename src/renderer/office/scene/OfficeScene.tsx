import { Canvas } from '@react-three/fiber'
import { useState } from 'react'
import type { AgentView } from '../../../shared/office/types'
import type { FrameMetrics } from '../frame-metrics'
import { usePrefersReducedMotion } from '../hooks'
import { BAND_ZOOM, ISO_POLAR, ISO_START_AZIMUTH, type ZoomBand } from '../logic/camera-bands'
import type { NameCard } from '../logic/name-cards'
import type { CameraRequest } from '../logic/office-reducer'
import type { WallsMode } from '../logic/room-layout'
import { SCENE_BACKGROUND } from '../office-palette'
import type { FloorGeometry } from '../scene-model'
import { CameraRig } from './CameraRig'
import { FloorView } from './FloorView'
import { CardProjector, NameCardLayer, type CardAnchors } from './NameCards'
import { FrameGovernor, MetricsProbe } from './RenderLoop'
import { Robot } from './Robot'

interface OfficeSceneProps {
  floor: FloorGeometry
  agents: readonly AgentView[]
  cards: readonly NameCard[]
  selectedAgentKey: string | null
  wallsMode: WallsMode
  cameraRequest: CameraRequest | null
  metrics: FrameMetrics
  onSelectAgent: (agentKey: string | null) => void
  onFlyToAgent: (agentKey: string) => void
  reviewableKeys: ReadonlySet<string>
  onReview: (sessionKey: string) => void
  speakingAgentKey: string | null
}

// Orthographic distance only sets clipping, not size; zoom sets size.
const CAMERA_DISTANCE = 60
const INITIAL_CAMERA_POSITION: [number, number, number] = [
  CAMERA_DISTANCE * Math.sin(ISO_POLAR) * Math.sin(ISO_START_AZIMUTH),
  CAMERA_DISTANCE * Math.cos(ISO_POLAR),
  CAMERA_DISTANCE * Math.sin(ISO_POLAR) * Math.cos(ISO_START_AZIMUTH)
]

// Only the focused floor is 3D; other floors live in the elevator panel (research §11).
export default function OfficeScene(props: OfficeSceneProps) {
  const isReducedMotion = usePrefersReducedMotion()
  const [band, setBand] = useState<ZoomBand>('floor')
  const [anchors] = useState<CardAnchors>(() => new Map())
  return (
    <div
      className="absolute inset-0"
      role="img"
      aria-label={`Isometric view of the ${props.floor.label} floor`}
    >
      <Canvas
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
        <FloorView
          floor={props.floor}
          wallsMode={props.wallsMode}
          isReducedMotion={isReducedMotion}
        />
        {props.agents.map((agent) => (
          <Robot
            key={agent.agentKey}
            agent={agent}
            isSelected={agent.agentKey === props.selectedAgentKey}
            isSpeaking={agent.agentKey === props.speakingAgentKey}
            isReducedMotion={isReducedMotion}
            onSelect={props.onSelectAgent}
            onFly={props.onFlyToAgent}
          />
        ))}
        <CardProjector cards={props.cards} anchors={anchors} />
        <CameraRig
          floor={props.floor}
          agents={props.agents}
          selectedAgentKey={props.selectedAgentKey}
          request={props.cameraRequest}
          isReducedMotion={isReducedMotion}
          onBandChange={setBand}
        />
        <FrameGovernor />
        <MetricsProbe metrics={props.metrics} />
      </Canvas>
      <NameCardLayer
        cards={props.cards}
        reviewableKeys={props.reviewableKeys}
        onReview={props.onReview}
        band={band}
        selectedAgentKey={props.selectedAgentKey}
        anchors={anchors}
      />
    </div>
  )
}
