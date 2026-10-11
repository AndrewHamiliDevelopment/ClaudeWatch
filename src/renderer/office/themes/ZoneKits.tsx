import { STEAM } from '../office-palette'
import { Matte } from '../scene/InstancedParts'
import { Torii } from './EdoRoom'
import { BRASS, EDO } from './palettes'
import type { ZoneProps } from './types'
import { CompanyGrounds, ProjectRoom } from './ZoneArchitecture'

const BRASS_ARCH = { radius: 1.6, tube: 0.12, legHeight: 1.6 }

export function EdoCompanyZone({ zone }: ZoneProps) {
  return <CompanyGrounds zone={zone} palette={EDO} gate={<Torii scale={2} />} />
}

export function EdoProjectOffice({ zone }: ZoneProps) {
  return <ProjectRoom zone={zone} palette={EDO} />
}

function BrassGate() {
  return (
    <group>
      <mesh position={[0, BRASS_ARCH.legHeight, 0]}>
        <torusGeometry args={[BRASS_ARCH.radius, BRASS_ARCH.tube, 8, 24, Math.PI]} />
        <Matte color={STEAM.brass} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * BRASS_ARCH.radius, 0, 0]}>
          <mesh position={[0, BRASS_ARCH.legHeight / 2, 0]}>
            <cylinderGeometry args={[BRASS_ARCH.tube, BRASS_ARCH.tube, BRASS_ARCH.legHeight, 8]} />
            <Matte color={STEAM.brass} />
          </mesh>
          <mesh position={[0, BRASS_ARCH.legHeight + 0.05, 0]}>
            <sphereGeometry args={[0.1, 8, 6]} />
            <Matte color={STEAM.rivetLight} glow />
          </mesh>
        </group>
      ))}
    </group>
  )
}

export function BrassCompanyZone({ zone }: ZoneProps) {
  return <CompanyGrounds zone={zone} palette={BRASS} gate={<BrassGate />} />
}

export function BrassProjectOffice({ zone }: ZoneProps) {
  return <ProjectRoom zone={zone} palette={BRASS} />
}
