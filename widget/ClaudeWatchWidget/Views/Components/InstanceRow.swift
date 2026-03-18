import SwiftUI

/// A single instance row showing status dot, project name, and elapsed time
struct InstanceRow: View {
    let instance: WidgetStatsPayload.InstanceData
    var showMetrics: Bool = false

    var body: some View {
        HStack(spacing: 10) {
            StatusDot(status: instance.status)

            Text(instance.projectName)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(WidgetColors.textPrimary)
                .lineLimit(1)

            Spacer()

            if showMetrics {
                HStack(spacing: 8) {
                    Text(String(format: "%.0f%%", instance.cpuPercent))
                        .font(.system(size: 10, weight: .medium, design: .monospaced))
                        .foregroundStyle(WidgetColors.textTertiary)

                    Text(formatElapsed(instance.elapsedSeconds))
                        .font(.system(size: 11, weight: .medium, design: .monospaced))
                        .foregroundStyle(WidgetColors.textSecondary)
                        .monospacedDigit()
                }
            } else {
                Text(formatElapsed(instance.elapsedSeconds))
                    .font(.system(size: 11, weight: .medium, design: .monospaced))
                    .foregroundStyle(WidgetColors.textSecondary)
                    .monospacedDigit()
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 5)
    }
}
