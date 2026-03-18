import SwiftUI

/// Design tokens matching the ClaudeWatch dark glassmorphism aesthetic.
/// Translated from tailwind.config.ts color values.
enum WidgetColors {
    // Surfaces
    static let surface = Color(red: 14 / 255, green: 14 / 255, blue: 16 / 255)
    static let surfaceRaised = Color(red: 24 / 255, green: 24 / 255, blue: 28 / 255)
    static let surfaceHover = Color(red: 32 / 255, green: 32 / 255, blue: 38 / 255)

    // Accent
    static let accent = Color(red: 124 / 255, green: 92 / 255, blue: 252 / 255)

    // Status
    static let statusActive = Color(red: 48 / 255, green: 209 / 255, blue: 88 / 255)
    static let statusIdle = Color(red: 255 / 255, green: 214 / 255, blue: 10 / 255)
    static let statusExited = Color(red: 255 / 255, green: 69 / 255, blue: 58 / 255)

    // Text
    static let textPrimary = Color(red: 245 / 255, green: 245 / 255, blue: 247 / 255)
    static let textSecondary = Color(red: 161 / 255, green: 161 / 255, blue: 166 / 255)
    static let textTertiary = Color(red: 99 / 255, green: 99 / 255, blue: 102 / 255)

    // Border
    static let border = Color.white.opacity(0.08)

    /// Returns the appropriate status color for a given status string
    static func statusColor(for status: String) -> Color {
        switch status {
        case "active": return statusActive
        case "idle": return statusIdle
        default: return statusExited
        }
    }
}
