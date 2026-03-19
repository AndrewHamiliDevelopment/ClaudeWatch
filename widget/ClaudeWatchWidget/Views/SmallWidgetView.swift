import SwiftUI
import WidgetKit

/// Small widget: active count with pulsing dot + cost + 2x badge
struct SmallWidgetView: View {
    let data: WidgetStatsPayload
    @Environment(\.widgetRenderingMode) var renderingMode

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            // Header: active count + 2x badge
            HStack(spacing: 6) {
                Circle()
                    .fill(data.stats.active > 0 ? WidgetColors.statusColor(for: "active", mode: renderingMode) : WidgetColors.textTertiary(for: renderingMode))
                    .frame(width: 8, height: 8)

                Text("\(data.stats.active)")
                    .font(.system(size: 34, weight: .bold, design: .rounded))
                    .foregroundStyle(WidgetColors.textPrimary(for: renderingMode))

                Spacer()

                if data.promo?.is2x == true {
                    Text("2x")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(WidgetColors.statusColor(for: "active", mode: renderingMode))
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(WidgetColors.statusColor(for: "active", mode: renderingMode).opacity(0.15))
                        .clipShape(Capsule())
                }
            }

            Text(data.stats.active == 1 ? "active" : "active")
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(WidgetColors.textSecondary(for: renderingMode))

            Spacer()

            // Cost line
            if let usage = data.usage, usage.dataAvailable {
                Text(formatCurrency(usage.totalCostUSD))
                    .font(.system(size: 13, weight: .semibold, design: .monospaced))
                    .foregroundStyle(WidgetColors.statusColor(for: "active", mode: renderingMode))
                    .monospacedDigit()
            }

            // Top active project name
            if let top = data.instances.first(where: { $0.isActive }) {
                Text(top.projectName)
                    .font(.system(size: 11, weight: .medium, design: .monospaced))
                    .foregroundStyle(WidgetColors.textTertiary(for: renderingMode))
                    .lineLimit(1)
            } else if data.instances.isEmpty {
                Text("No instances")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(WidgetColors.textTertiary(for: renderingMode))
            } else {
                Text("All idle")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(WidgetColors.statusColor(for: "idle", mode: renderingMode))
            }

            // Stale data indicator
            if data.isStale {
                Text("stale")
                    .font(.system(size: 9, weight: .medium))
                    .foregroundStyle(WidgetColors.statusColor(for: "exited", mode: renderingMode).opacity(0.7))
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .widgetAccentable()
        .containerBackground(for: .widget) {
            WidgetColors.surface
        }
    }
}
