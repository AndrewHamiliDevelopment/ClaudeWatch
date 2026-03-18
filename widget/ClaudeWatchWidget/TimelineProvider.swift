import WidgetKit
import SwiftUI

/// Timeline entry carrying the stats payload
struct ClaudeWatchEntry: TimelineEntry {
    let date: Date
    let data: WidgetStatsPayload
}

/// Provides timeline entries by reading stats.json from the App Group container
struct ClaudeWatchTimelineProvider: TimelineProvider {

    func placeholder(in context: Context) -> ClaudeWatchEntry {
        ClaudeWatchEntry(
            date: Date(),
            data: .placeholder
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (ClaudeWatchEntry) -> Void) {
        let data = WidgetStatsPayload.load() ?? .empty
        completion(ClaudeWatchEntry(date: Date(), data: data))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<ClaudeWatchEntry>) -> Void) {
        let data = WidgetStatsPayload.load() ?? .empty
        let entry = ClaudeWatchEntry(date: Date(), data: data)

        // Refresh every 5 minutes (WidgetKit's minimum practical interval)
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 5, to: Date())!
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }
}

// MARK: - Placeholder data for widget gallery

extension WidgetStatsPayload {
    static let placeholder = WidgetStatsPayload(
        updatedAt: ISO8601DateFormatter().string(from: Date()),
        stats: Stats(total: 5, active: 3, idle: 2, exited: 0),
        instances: [
            InstanceData(pid: 1, projectName: "api-gateway", status: "active", cpuPercent: 42.1, memPercent: 2.3, elapsedSeconds: 3600),
            InstanceData(pid: 2, projectName: "web-dashboard", status: "active", cpuPercent: 28.5, memPercent: 1.8, elapsedSeconds: 1800),
            InstanceData(pid: 3, projectName: "auth-service", status: "active", cpuPercent: 15.2, memPercent: 0.9, elapsedSeconds: 900),
            InstanceData(pid: 4, projectName: "data-pipeline", status: "idle", cpuPercent: 0.1, memPercent: 1.1, elapsedSeconds: 7200),
            InstanceData(pid: 5, projectName: "mobile-app", status: "idle", cpuPercent: 0.0, memPercent: 0.5, elapsedSeconds: 5400)
        ]
    )
}
