import SwiftUI
import WidgetKit

/// A small colored circle indicating instance status
struct StatusDot: View {
    let status: String
    var size: CGFloat = 6
    var renderingMode: WidgetRenderingMode = .fullColor

    var body: some View {
        Circle()
            .fill(WidgetColors.statusColor(for: status, mode: renderingMode))
            .frame(width: size, height: size)
    }
}
