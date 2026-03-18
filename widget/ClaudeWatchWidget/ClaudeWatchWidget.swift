import WidgetKit
import SwiftUI

/// The main widget definition supporting small, medium, and large sizes
struct ClaudeWatchWidget: Widget {
    let kind: String = "ClaudeWatchWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: ClaudeWatchTimelineProvider()) { entry in
            ClaudeWatchWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("ClaudeWatch")
        .description("Monitor your active Claude Code sessions at a glance.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

/// Routes to the correct view based on widget family size
struct ClaudeWatchWidgetEntryView: View {
    @Environment(\.widgetFamily) var family
    var entry: ClaudeWatchTimelineProvider.Entry

    var body: some View {
        switch family {
        case .systemSmall:
            SmallWidgetView(data: entry.data)
        case .systemMedium:
            MediumWidgetView(data: entry.data)
        case .systemLarge:
            LargeWidgetView(data: entry.data)
        default:
            SmallWidgetView(data: entry.data)
        }
    }
}

#Preview("Small", as: .systemSmall) {
    ClaudeWatchWidget()
} timeline: {
    ClaudeWatchEntry(date: .now, data: .placeholder)
    ClaudeWatchEntry(date: .now, data: .empty)
}

#Preview("Medium", as: .systemMedium) {
    ClaudeWatchWidget()
} timeline: {
    ClaudeWatchEntry(date: .now, data: .placeholder)
    ClaudeWatchEntry(date: .now, data: .empty)
}

#Preview("Large", as: .systemLarge) {
    ClaudeWatchWidget()
} timeline: {
    ClaudeWatchEntry(date: .now, data: .placeholder)
    ClaudeWatchEntry(date: .now, data: .empty)
}
