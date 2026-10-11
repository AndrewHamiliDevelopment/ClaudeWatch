import type { WorkOrder } from '../deck/work-orders'
import { PLATE_TITLE_CLASS } from './deck/deck-styles'
import { WorkOrderSlip } from './deck/WorkOrderSlip'

// `orders` is null while nobody can say who waits: an empty lane would claim nothing does.
export function NeedsYouLane({ orders }: { orders: readonly WorkOrder[] | null }) {
  if (orders === null) return null

  return (
    <section aria-labelledby="needs-you-heading" className="flex flex-col gap-1.5">
      <h2 id="needs-you-heading" className={PLATE_TITLE_CLASS}>
        Needs you
      </h2>
      {orders.length === 0 ? (
        <p className="text-body text-text-secondary">Nothing is waiting on you.</p>
      ) : (
        // Announces an arriving slip; "additions" keeps the ticking wait clocks quiet.
        <ol className="flex flex-col gap-1.5" aria-live="polite" aria-relevant="additions">
          {orders.map((order) => (
            <WorkOrderSlip key={order.sessionKey} order={order} />
          ))}
        </ol>
      )}
    </section>
  )
}
