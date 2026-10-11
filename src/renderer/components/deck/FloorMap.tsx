import type { AgentState, Squad } from '../../deck/roster'

const MAP_WIDTH = 260
const MAP_HEIGHT = 86
const MAX_SQUADS_DRAWN = 4
const TILE_HALF_WIDTH = 30
const TILE_HALF_HEIGHT = 15
const TILE_CENTER_Y = 52
// Where up to four agents stand on a tile, as offsets from its centre.
const PIP_OFFSETS = [
  [-11, 0],
  [11, 0],
  [0, -7],
  [0, 7]
] as const

function Pip({ state, x, y }: { state: AgentState; x: number; y: number }) {
  if (state === 'needs-you') {
    return (
      <rect
        x={x - 3.5}
        y={y - 3.5}
        width={7}
        height={7}
        transform={`rotate(45 ${x} ${y})`}
        className="fill-seal stroke-paper"
        strokeWidth={1.5}
      />
    )
  }
  if (state === 'working') return <circle cx={x} cy={y} r={3} className="fill-status-active" />
  return (
    <circle cx={x} cy={y} r={2.5} className="fill-none stroke-text-tertiary" strokeWidth={1.5} />
  )
}

// dry-new: a pocket view of the Office floor, one tile per squad. Decorative: the caption
// beside it says the same thing in words.
export function FloorMap({ squads }: { squads: readonly Squad[] }) {
  const drawnSquads = squads.slice(0, MAX_SQUADS_DRAWN)
  const columnWidth = MAP_WIDTH / Math.max(1, drawnSquads.length)

  return (
    <svg
      viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
      className="block h-[86px] w-full bg-surface"
      aria-hidden="true"
    >
      {drawnSquads.map((squad, squadIndex) => {
        const centerX = (squadIndex + 0.5) * columnWidth
        const tile = [
          [centerX, TILE_CENTER_Y - TILE_HALF_HEIGHT],
          [centerX + TILE_HALF_WIDTH, TILE_CENTER_Y],
          [centerX, TILE_CENTER_Y + TILE_HALF_HEIGHT],
          [centerX - TILE_HALF_WIDTH, TILE_CENTER_Y]
        ]
        return (
          <g key={squad.key}>
            <polygon
              points={tile.map((corner) => corner.join(',')).join(' ')}
              className={
                squad.needsYouCount > 0
                  ? 'fill-surface-raised stroke-brass'
                  : 'fill-surface-raised stroke-border'
              }
            />
            <text
              x={centerX}
              y={24}
              textAnchor="middle"
              className="fill-gold font-plate text-[11px] font-bold"
            >
              {squad.crest}
            </text>
            {squad.agents.slice(0, PIP_OFFSETS.length).map((agent, agentIndex) => (
              <Pip
                key={agent.pid}
                state={agent.state}
                x={centerX + PIP_OFFSETS[agentIndex][0]}
                y={TILE_CENTER_Y + PIP_OFFSETS[agentIndex][1]}
              />
            ))}
          </g>
        )
      })}
    </svg>
  )
}
