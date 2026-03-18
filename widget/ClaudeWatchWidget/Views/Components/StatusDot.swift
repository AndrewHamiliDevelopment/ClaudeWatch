import SwiftUI

/// A small colored circle indicating instance status
struct StatusDot: View {
    let status: String
    var size: CGFloat = 6

    var body: some View {
        Circle()
            .fill(WidgetColors.statusColor(for: status))
            .frame(width: size, height: size)
    }
}
