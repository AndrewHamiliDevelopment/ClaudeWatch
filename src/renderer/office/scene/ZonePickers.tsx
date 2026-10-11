import type { ThreeEvent } from '@react-three/fiber'
import type { FloorGeometry, ZoneGeometry } from '../scene-model'

const FLAT = -Math.PI / 2
// Just above each zone's plate; projects sit higher so the innermost zone is hit first.
const PICK_Y = { company: 0.02, project: 0.03 }

// A pan ends with a click on the plate under the pointer; only a still click counts.
const CLICK_SLOP_PX = 4

interface PickerProps {
  zone: ZoneGeometry
  y: number
  onFly: (zoneId: string) => void
  onMiss: () => void
}

// One pointer at a time, and kept outside the component so a re-render mid-click cannot reset it.
const pressed = { x: 0, y: 0 }

function Picker({ zone, y, onFly, onMiss }: PickerProps) {
  return (
    <mesh
      position={[zone.x, y, zone.z]}
      rotation={[FLAT, 0, 0]}
      onPointerDown={(event: ThreeEvent<PointerEvent>) => {
        pressed.x = event.clientX
        pressed.y = event.clientY
      }}
      // The plates catch every click on a zone's floor, so the canvas never reports a miss there.
      onClick={(event: ThreeEvent<MouseEvent>) => {
        const moved = Math.hypot(event.clientX - pressed.x, event.clientY - pressed.y)
        if (moved <= CLICK_SLOP_PX) onMiss()
      }}
      onDoubleClick={(event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation()
        onFly(zone.id)
      }}
    >
      <planeGeometry args={[zone.width, zone.depth]} />
      <meshBasicMaterial visible={false} />
    </mesh>
  )
}

// Invisible plates over company and project zones: double-click flies the camera to that zone,
// a click on bare floor clears the selection. Keyboard users use the Offices panel and Escape.
export function ZonePickers({
  floor,
  onFly,
  onMiss
}: {
  floor: FloorGeometry
  onFly: (zoneId: string) => void
  onMiss: () => void
}) {
  return (
    <group>
      {floor.zones
        .filter((zone) => zone.kind === 'company')
        .flatMap((company) => [
          <Picker
            key={company.id}
            zone={company}
            y={PICK_Y.company}
            onFly={onFly}
            onMiss={onMiss}
          />,
          ...company.children
            .filter((child) => child.kind === 'project')
            .map((project) => (
              <Picker
                key={project.id}
                zone={project}
                y={PICK_Y.project}
                onFly={onFly}
                onMiss={onMiss}
              />
            ))
        ])}
    </group>
  )
}
