import SwiftUI

/// Minimal host app that exists to register the WidgetKit extension with macOS.
/// In production, the Electron app serves as the host — this is for development only.
@main
struct ClaudeWatchHostApp: App {
    var body: some Scene {
        WindowGroup {
            VStack(spacing: 16) {
                Image(systemName: "widget.small")
                    .font(.system(size: 48))
                    .foregroundStyle(.secondary)

                Text("ClaudeWatch Widget Host")
                    .font(.title2.bold())

                Text("This app registers the widget extension.\nAdd the widget via Desktop → Edit Widgets.")
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
            .padding(40)
            .frame(width: 360, height: 240)
        }
        .windowResizability(.contentSize)
    }
}
