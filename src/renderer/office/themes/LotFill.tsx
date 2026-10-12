import type { PlacedGroup } from './lot-kit'
import { Parts } from './parts'

// Every lot's building or prop, as unit parts that merge into a draw per shape and colour.
export function LotFill({ placed }: { placed: readonly PlacedGroup[] }) {
  return (
    <>
      {placed.map(({ key, at, turn, scale, parts }) => (
        <group key={key} position={at} rotation={[0, turn, 0]} scale={scale}>
          <Parts parts={parts} />
        </group>
      ))}
    </>
  )
}
