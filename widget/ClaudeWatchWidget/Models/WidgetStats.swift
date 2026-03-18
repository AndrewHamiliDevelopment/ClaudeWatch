import Foundation

/// Data model matching the stats.json written by the Electron main process.
/// Must stay in sync with WidgetStatsPayload in widget-stats-writer.ts.
struct WidgetStatsPayload: Codable {
    let updatedAt: String
    let stats: Stats
    let instances: [InstanceData]

    struct Stats: Codable {
        let total: Int
        let active: Int
        let idle: Int
        let exited: Int
    }

    struct InstanceData: Codable, Identifiable {
        let pid: Int
        let projectName: String
        let status: String
        let cpuPercent: Double
        let memPercent: Double
        let elapsedSeconds: Int

        var id: Int { pid }

        var isActive: Bool { status == "active" }
        var isIdle: Bool { status == "idle" }
    }

    /// Time since last update, in seconds
    var staleness: TimeInterval {
        guard let date = ISO8601DateFormatter().date(from: updatedAt) else { return .infinity }
        return Date().timeIntervalSince(date)
    }

    /// Whether the data is considered stale (older than 5 minutes)
    var isStale: Bool { staleness > 300 }

    /// Read stats.json from the App Group shared container
    static func load() -> WidgetStatsPayload? {
        guard let containerURL = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: "group.com.zkidzdev.claudewatch"
        ) else { return nil }

        let fileURL = containerURL.appendingPathComponent("stats.json")

        guard let data = try? Data(contentsOf: fileURL) else { return nil }

        return try? JSONDecoder().decode(WidgetStatsPayload.self, from: data)
    }

    /// Empty/default payload for when no data is available
    static let empty = WidgetStatsPayload(
        updatedAt: ISO8601DateFormatter().string(from: Date()),
        stats: Stats(total: 0, active: 0, idle: 0, exited: 0),
        instances: []
    )
}

/// Format elapsed seconds into human-readable string
func formatElapsed(_ seconds: Int) -> String {
    let hours = seconds / 3600
    let minutes = (seconds % 3600) / 60
    let secs = seconds % 60

    if hours > 0 {
        return String(format: "%d:%02d:%02d", hours, minutes, secs)
    } else {
        return String(format: "%d:%02d", minutes, secs)
    }
}
