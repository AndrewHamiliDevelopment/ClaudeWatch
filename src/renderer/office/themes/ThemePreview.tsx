import { Canvas, useFrame } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import { useMemo, useState } from 'react'
import type { AgentView } from '../../../shared/office/types'
import { deskSlots } from '../logic/room-layout'
import { moodFor, robotPose } from '../logic/character-pose'
import { DEFAULT_THEME_ID, getTheme } from './registry'
import { useRobotRig, applyThemePose } from './rig'
import { previewFixture } from './preview-fixture'
import type { OfficeTheme } from './types'

function PreviewRobot({
  agent,
  theme,
  isReducedMotion
}: {
  agent: AgentView
  theme: OfficeTheme
  isReducedMotion: boolean
}) {
  const rig = useRobotRig()
  const [selected, setSelected] = useState(false)
  const Model = theme.robot.Model
  useFrame(({ clock }, delta) => {
    const mood = moodFor(agent, false)
    const phase = agent.isSubagent ? 0.7 : agent.provider === 'claude' ? 0.2 : 0.4
    applyThemePose(rig, robotPose(mood, clock.elapsedTime, phase, { isReducedMotion }), {
      mood,
      time: clock.elapsedTime,
      phase,
      delta,
      isReducedMotion
    })
  })
  return (
    <group position={[agent.x, 0, agent.z]} rotation={[0, agent.heading, 0]}>
      <group scale={agent.isSubagent ? 0.9 : 1.3}>
        <Model
          agent={agent}
          skin={theme.robot.skins[agent.provider]}
          rig={rig}
          isReducedMotion={isReducedMotion}
        />
        {selected && (
          <mesh position={[0, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.42, 0.52, 24]} />
            <meshBasicMaterial color={theme.palette.glow} />
          </mesh>
        )}
        <mesh
          position={[0, 0.6, 0]}
          onClick={(event) => {
            event.stopPropagation()
            setSelected(!selected)
          }}
        >
          <capsuleGeometry args={[0.32, 0.6, 2, 8]} />
          <meshBasicMaterial visible={false} />
        </mesh>
      </group>
      <Html
        position={[0, agent.isSubagent ? 1.25 : 1.8, 0]}
        center
        style={{ pointerEvents: 'none' }}
      >
        <div
          style={{
            background: '#FFFFFF',
            color: '#1C1A1E',
            borderRadius: 4,
            padding: '3px 7px',
            fontSize: 10,
            whiteSpace: 'nowrap',
            fontWeight: 700
          }}
        >
          {agent.label}
        </div>
      </Html>
    </group>
  )
}

export function ThemePreviewContent({
  themeId = DEFAULT_THEME_ID,
  isReducedMotion = false
}: {
  themeId?: string
  isReducedMotion?: boolean
}) {
  const theme = getTheme(themeId)
  const { floor, agents, towerFloors } = useMemo(previewFixture, [])
  const { Floor, Walls, Doorway, Desk, RoomDressing, Elevator, RoomSign } = theme.kit
  const { District, Hangar, Tower } = theme.world
  return (
    <group key={theme.id}>
      <Floor floor={floor} />
      <Walls floor={floor} mode="cutaway" isReducedMotion={isReducedMotion} />
      {floor.rooms.map((room) => (
        <group key={room.id}>
          <Doorway room={room} />
          <RoomSign room={room} />
          <RoomDressing room={room} />
          {deskSlots(room).map((slot) => (
            <Desk key={slot.slotId} room={room} slot={slot} />
          ))}
        </group>
      ))}
      <Elevator floor={floor} />
      <District floor={floor} />
      <Hangar floor={floor} />
      <group position={[floor.width / 2 + 7, 0, -floor.depth / 2 - 8]}>
        <Tower floors={towerFloors} />
      </group>
      {agents.map((agent) => (
        <PreviewRobot
          key={agent.agentKey}
          agent={agent}
          theme={theme}
          isReducedMotion={isReducedMotion}
        />
      ))}
    </group>
  )
}

// Content is exported separately so the lead can reuse an existing Canvas and camera.
export function ThemePreview(props: { themeId?: string; isReducedMotion?: boolean }) {
  return (
    <Canvas
      orthographic
      camera={{ position: [30, 26, 36], zoom: 18, near: 0.1, far: 200 }}
      shadows={false}
      style={{ background: '#0E0E10', width: '100%', height: '100%' }}
    >
      <ambientLight intensity={1.4} />
      <directionalLight position={[8, 18, 12]} intensity={2} />
      <ThemePreviewContent {...props} />
      <OrbitControls target={[0, 1, -3]} minZoom={8} maxZoom={70} maxPolarAngle={Math.PI / 2.2} />
    </Canvas>
  )
}
