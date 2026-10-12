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
  onWalk?: (point: { x: number; z: number }) => void
}

// One pointer at a time, and kept outside the component so a re-render mid-click cannot reset it.
const pressed = { x: 0, y: 0 }

interface Press {
  clientX: number
  clientY: number
}

export function trackPress(event: Press): void {
  pressed.x = event.clientX
  pressed.y = event.clientY
}

export function isStillClick(event: Press): boolean {
  return Math.hypot(event.clientX - pressed.x, event.clientY - pressed.y) <= CLICK_SLOP_PX
}

function Picker({ zone, y, onFly, onMiss, onWalk }: PickerProps) {
  return (
    <mesh
      position={[zone.x, y, zone.z]}
      rotation={[FLAT, 0, 0]}
      onPointerDown={trackPress}
      // The plates catch every click on a zone's floor, so the canvas never reports a miss there.
      onClick={(event: ThreeEvent<MouseEvent>) => {
        if (!isStillClick(event)) return
        if (!onWalk) return onMiss()
        // The innermost plate takes the click, so the player is sent once.
        event.stopPropagation()
        onWalk(event.point)
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
// a click on bare floor clears the selection, or with `onWalk` sends the player there instead.
// Keyboard users use the Offices panel and Escape.
export function ZonePickers({
  floor,
  onFly,
  onMiss,
  onWalk
}: {
  floor: FloorGeometry
  onFly: (zoneId: string) => void
  onMiss: () => void
  onWalk?: (point: { x: number; z: number }) => void
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
            onWalk={onWalk}
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
                onWalk={onWalk}
              />
            ))
        ])}
    </group>
  )
}
