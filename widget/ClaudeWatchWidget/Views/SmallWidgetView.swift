import SwiftUI
import WidgetKit

/// Small widget: active count with pulsing dot + top project name
struct SmallWidgetView: View {
    let data: WidgetStatsPayload

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            // Active count with green dot
            HStack(spacing: 6) {
                Circle()
                    .fill(data.stats.active > 0 ? WidgetColors.statusActive : WidgetColors.textTertiary)
                    .frame(width: 8, height: 8)

                Text("\(data.stats.active)")
                    .font(.system(size: 34, weight: .bold, design: .rounded))
                    .foregroundStyle(WidgetColors.textPrimary)
            }

            Text(data.stats.active == 1 ? "active" : "active")
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(WidgetColors.textSecondary)

            Spacer()

            // Top active project name
            if let top = data.instances.first(where: { $0.isActive }) {
                HStack(spacing: 4) {
                    Text(top.projectName)
                        .font(.system(size: 11, weight: .medium, design: .monospaced))
                        .foregroundStyle(WidgetColors.textTertiary)
                        .lineLimit(1)
                }
            } else if data.instances.isEmpty {
                Text("No instances")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(WidgetColors.textTertiary)
            } else {
                Text("All idle")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(WidgetColors.statusIdle)
            }

            // Stale data indicator
            if data.isStale {
                Text("stale")
                    .font(.system(size: 9, weight: .medium))
                    .foregroundStyle(WidgetColors.statusExited.opacity(0.7))
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .containerBackground(for: .widget) {
            WidgetColors.surface
        }
    }
}
