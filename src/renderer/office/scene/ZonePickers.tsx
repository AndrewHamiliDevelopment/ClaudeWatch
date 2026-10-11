import type { ThreeEvent } from '@react-three/fiber'
import type { FloorGeometry, ZoneGeometry } from '../scene-model'

const FLAT = -Math.PI / 2
// Just above each zone's plate; projects sit higher so the innermost zone is hit first.
const PICK_Y = { company: 0.02, project: 0.03 }

function Picker({
  zone,
  y,
  onFly
}: {
  zone: ZoneGeometry
  y: number
  onFly: (zoneId: string) => void
}) {
  return (
    <mesh
      position={[zone.x, y, zone.z]}
      rotation={[FLAT, 0, 0]}
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

// Invisible plates over company and project zones: double-click flies the camera to that zone.
// Keyboard users reach the same zones through the Offices panel.
export function ZonePickers({
  floor,
  onFly
}: {
  floor: FloorGeometry
  onFly: (zoneId: string) => void
}) {
  return (
    <group>
      {floor.zones
        .filter((zone) => zone.kind === 'company')
        .flatMap((company) => [
          <Picker key={company.id} zone={company} y={PICK_Y.company} onFly={onFly} />,
          ...company.children
            .filter((child) => child.kind === 'project')
            .map((project) => (
              <Picker key={project.id} zone={project} y={PICK_Y.project} onFly={onFly} />
            ))
        ])}
    </group>
  )
}
