import SwiftUI
import WidgetKit

/// A compact status pill showing a colored dot and count
struct StatPill: View {
    let color: Color
    let count: Int
    let label: String
    var renderingMode: WidgetRenderingMode = .fullColor

    var body: some View {
        HStack(spacing: 5) {
            Circle()
                .fill(color)
                .frame(width: 6, height: 6)

            Text("\(count)")
                .font(.system(size: 13, weight: .semibold, design: .rounded))
                .foregroundStyle(WidgetColors.textPrimary(for: renderingMode))

            Text(label)
                .font(.system(size: 10, weight: .medium))
                .foregroundStyle(WidgetColors.textSecondary(for: renderingMode))
        }
    }
}
