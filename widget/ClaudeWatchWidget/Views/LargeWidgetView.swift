import SwiftUI
import WidgetKit

/// Large widget: full stats bar + instance list with CPU/MEM metrics
struct LargeWidgetView: View {
    let data: WidgetStatsPayload

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            HStack {
                Text("ClaudeWatch")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(WidgetColors.textPrimary)

                Spacer()

                if data.isStale {
                    Text("stale")
                        .font(.system(size: 9, weight: .semibold))
                        .foregroundStyle(WidgetColors.statusExited)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(WidgetColors.statusExited.opacity(0.15))
                        .clipShape(Capsule())
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 14)
            .padding(.bottom, 10)

            // Stats cards row
            HStack(spacing: 8) {
                StatCard(
                    label: "Active",
                    count: data.stats.active,
                    color: WidgetColors.statusActive
                )
                StatCard(
                    label: "Idle",
                    count: data.stats.idle,
                    color: WidgetColors.statusIdle
                )
                StatCard(
                    label: "Total",
                    count: data.stats.total,
                    color: WidgetColors.accent
                )
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 10)

            // Separator
            Rectangle()
                .fill(WidgetColors.border)
                .frame(height: 1)
                .padding(.horizontal, 16)

            if data.instances.isEmpty {
                Spacer()
                VStack(spacing: 4) {
                    Text("No instances detected")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(WidgetColors.textTertiary)
                    Text("Start a Claude Code session to see it here")
                        .font(.system(size: 10, weight: .regular))
                        .foregroundStyle(WidgetColors.textTertiary.opacity(0.7))
                }
                .frame(maxWidth: .infinity)
                Spacer()
            } else {
                // Instance list (max 8)
                VStack(spacing: 0) {
                    ForEach(Array(data.instances.prefix(8))) { instance in
                        InstanceRow(instance: instance, showMetrics: true)
                    }
                }
                .padding(.top, 4)

                Spacer()

                // Footer with overflow count and update time
                HStack {
                    if data.instances.count > 8 {
                        Text("+\(data.instances.count - 8) more")
                            .font(.system(size: 10, weight: .medium))
                            .foregroundStyle(WidgetColors.textTertiary)
                    }

                    Spacer()

                    Text(stalenessText)
                        .font(.system(size: 9, weight: .medium))
                        .foregroundStyle(WidgetColors.textTertiary)
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 10)
            }
        }
        .containerBackground(for: .widget) {
            WidgetColors.surface
        }
    }

    private var stalenessText: String {
        let seconds = Int(data.staleness)
        if seconds < 60 { return "Updated just now" }
        let minutes = seconds / 60
        if minutes < 60 { return "Updated \(minutes)m ago" }
        return "Updated \(minutes / 60)h ago"
    }
}

/// A compact stat card for the large widget header
struct StatCard: View {
    let label: String
    let count: Int
    let color: Color

    var body: some View {
        VStack(spacing: 3) {
            Text("\(count)")
                .font(.system(size: 22, weight: .bold, design: .rounded))
                .foregroundStyle(color)

            Text(label)
                .font(.system(size: 10, weight: .medium))
                .foregroundStyle(WidgetColors.textSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
        .background(WidgetColors.surfaceRaised)
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}
