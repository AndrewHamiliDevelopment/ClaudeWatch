import { cn } from '../../lib/utils'

interface LedgerTableRow {
  key: string
  name: string
  cells: readonly string[]
}

interface LedgerTableProps {
  label: string
  columns: readonly string[]
  rows: readonly LedgerTableRow[]
  // Set where the first number is the one the others add up to.
  leadCellClassName?: string
}

// Token counts in rows and columns: a real table, so each number is read with both its headers.
export function LedgerTable({ label, columns, rows, leadCellClassName }: LedgerTableProps) {
  return (
    <table aria-label={label} className="w-full border-collapse text-body tabular-nums">
      <thead>
        <tr>
          <td />
          {columns.map((column) => (
            <th
              key={column}
              scope="col"
              className="whitespace-nowrap pb-0.5 pl-3 text-right text-caption font-normal text-text-tertiary"
            >
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key} className="border-t border-border">
            <th
              scope="row"
              className="w-full max-w-0 truncate py-1 text-left font-normal text-text-secondary"
            >
              {row.name}
            </th>
            {row.cells.map((cell, columnIndex) => (
              <td
                key={columns[columnIndex]}
                className={cn(
                  'whitespace-nowrap py-1 pl-3 text-right',
                  columnIndex === 0 && leadCellClassName
                )}
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
