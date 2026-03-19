import SwiftUI
import WidgetKit

/// A single instance row showing status dot, project name, and elapsed time
struct InstanceRow: View {
    let instance: WidgetStatsPayload.InstanceData
    var showMetrics: Bool = false
    var renderingMode: WidgetRenderingMode = .fullColor

    var body: some View {
        HStack(spacing: 10) {
            StatusDot(status: instance.status, renderingMode: renderingMode)

            Text(instance.projectName)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(WidgetColors.textPrimary(for: renderingMode))
                .lineLimit(1)

            Spacer()

            if showMetrics {
                HStack(spacing: 8) {
                    Text(String(format: "%.0f%%", instance.cpuPercent))
                        .font(.system(size: 10, weight: .medium, design: .monospaced))
                        .foregroundStyle(WidgetColors.textTertiary(for: renderingMode))

                    Text(formatElapsed(instance.elapsedSeconds))
                        .font(.system(size: 11, weight: .medium, design: .monospaced))
                        .foregroundStyle(WidgetColors.textSecondary(for: renderingMode))
                        .monospacedDigit()
                }
            } else {
                Text(formatElapsed(instance.elapsedSeconds))
                    .font(.system(size: 11, weight: .medium, design: .monospaced))
                    .foregroundStyle(WidgetColors.textSecondary(for: renderingMode))
                    .monospacedDigit()
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 5)
    }
}
