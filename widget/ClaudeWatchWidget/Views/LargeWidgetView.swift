import SwiftUI
import WidgetKit

/// Large widget: promo bar + stats + usage cards + instance list
struct LargeWidgetView: View {
    let data: WidgetStatsPayload
    @Environment(\.widgetRenderingMode) var renderingMode

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            HStack {
                Text("ClaudeWatch")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(WidgetColors.textPrimary(for: renderingMode))

                if data.promo?.is2x == true {
                    Text("2x")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(WidgetColors.statusColor(for: "active", mode: renderingMode))
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(WidgetColors.statusColor(for: "active", mode: renderingMode).opacity(0.15))
                        .clipShape(Capsule())
                }

                Spacer()

                if data.isStale {
                    Text("stale")
                        .font(.system(size: 9, weight: .semibold))
                        .foregroundStyle(WidgetColors.statusColor(for: "exited", mode: renderingMode))
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(WidgetColors.statusColor(for: "exited", mode: renderingMode).opacity(0.15))
                        .clipShape(Capsule())
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 14)
            .padding(.bottom, 10)

            // Promo banner
            if let promo = data.promo, promo.promoActive {
                PromoBannerView(promo: promo, renderingMode: renderingMode)
                    .padding(.horizontal, 16)
                    .padding(.bottom, 8)
            }

            // Instance stats row
            HStack(spacing: 8) {
                StatCard(
                    label: "Active",
                    count: data.stats.active,
                    color: WidgetColors.statusColor(for: "active", mode: renderingMode),
                    renderingMode: renderingMode
                )
                StatCard(
                    label: "Idle",
                    count: data.stats.idle,
                    color: WidgetColors.statusColor(for: "idle", mode: renderingMode),
                    renderingMode: renderingMode
                )
                StatCard(
                    label: "Total",
                    count: data.stats.total,
                    color: renderingMode == .accented ? .white : WidgetColors.accent,
                    renderingMode: renderingMode
                )
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 6)

            // Usage stats row
            if let usage = data.usage, usage.dataAvailable {
                HStack(spacing: 8) {
                    UsageStatCard(label: "Cost", value: formatCurrency(usage.totalCostUSD), color: WidgetColors.statusColor(for: "active", mode: renderingMode), renderingMode: renderingMode)
                    UsageStatCard(label: "Input", value: formatCompactNumber(usage.totalInputTokens), color: renderingMode == .accented ? .white : Color(red: 34/255, green: 211/255, blue: 238/255), renderingMode: renderingMode)
                    UsageStatCard(label: "Output", value: formatCompactNumber(usage.totalOutputTokens), color: renderingMode == .accented ? .white : Color(red: 192/255, green: 132/255, blue: 252/255), renderingMode: renderingMode)
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 10)
            }

            // Separator
            Rectangle()
                .fill(WidgetColors.border)
                .frame(height: 1)
                .padding(.horizontal, 16)

            if data.instances.isEmpty {
                Spacer()
                VStack(spacing: 4) {
                    Text("No instances detected")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(WidgetColors.textTertiary(for: renderingMode))
                    Text("Start a Claude Code session to see it here")
                        .font(.system(size: 10, weight: .regular))
                        .foregroundStyle(WidgetColors.textTertiary(for: renderingMode).opacity(0.7))
                }
                .frame(maxWidth: .infinity)
                Spacer()
            } else {
                // Instance list (max 6 to make room for usage cards)
                VStack(spacing: 0) {
                    ForEach(Array(data.instances.prefix(6))) { instance in
                        InstanceRow(instance: instance, showMetrics: true, renderingMode: renderingMode)
                    }
                }
                .padding(.top, 4)

                Spacer()

                // Footer with overflow count and update time
                HStack {
                    if data.instances.count > 6 {
                        Text("+\(data.instances.count - 6) more")
                            .font(.system(size: 10, weight: .medium))
                            .foregroundStyle(WidgetColors.textTertiary(for: renderingMode))
                    }

                    Spacer()

                    Text(stalenessText)
                        .font(.system(size: 9, weight: .medium))
                        .foregroundStyle(WidgetColors.textTertiary(for: renderingMode))
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 10)
            }
        }
        .widgetAccentable()
        .containerBackground(for: .widget) {
            WidgetColors.surface
        }
    }

    private var stalenessText: String {
        let seconds = Int(data.staleness)
        if seconds < 60 { return "Updated just now" }
        let minutes = seconds / 60
        if minutes < 60 { return "Updated \(minutes)m ago" }
        return "Updated \(minutes / 60)h ago"
    }
}

/// A compact stat card for the large widget header
struct StatCard: View {
    let label: String
    let count: Int
    let color: Color
    var renderingMode: WidgetRenderingMode = .fullColor

    var body: some View {
        VStack(spacing: 3) {
            Text("\(count)")
                .font(.system(size: 22, weight: .bold, design: .rounded))
                .foregroundStyle(color)

            Text(label)
                .font(.system(size: 10, weight: .medium))
                .foregroundStyle(WidgetColors.textSecondary(for: renderingMode))
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
        .background(WidgetColors.surfaceRaised(for: renderingMode))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

/// A compact usage stat card showing a value + label
struct UsageStatCard: View {
    let label: String
    let value: String
    let color: Color
    var renderingMode: WidgetRenderingMode = .fullColor

    var body: some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.system(size: 12, weight: .bold, design: .monospaced))
                .foregroundStyle(color)
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.7)

            Text(label)
                .font(.system(size: 9, weight: .medium))
                .foregroundStyle(WidgetColors.textTertiary(for: renderingMode))
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 6)
        .background(WidgetColors.surfaceRaised(for: renderingMode))
        .clipShape(RoundedRectangle(cornerRadius: 6))
    }
}

/// Promo banner for the large widget
struct PromoBannerView: View {
    let promo: WidgetStatsPayload.PromoData
    var renderingMode: WidgetRenderingMode = .fullColor

    var body: some View {
        HStack(spacing: 6) {
            if promo.is2x {
                Circle()
                    .fill(WidgetColors.statusColor(for: "active", mode: renderingMode))
                    .frame(width: 6, height: 6)

                Text("2x ACTIVE")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(WidgetColors.statusColor(for: "active", mode: renderingMode))

                if let expires = promo.expiresInSeconds {
                    Text("· \(formatCountdown(expires))")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundStyle(WidgetColors.textSecondary(for: renderingMode))
                }
            } else {
                Circle()
                    .fill(WidgetColors.textTertiary(for: renderingMode))
                    .frame(width: 6, height: 6)

                Text("1x Standard")
                    .font(.system(size: 10, weight: .medium))
                    .foregroundStyle(WidgetColors.textSecondary(for: renderingMode))
            }

            Spacer()

            Text(promo.promoPeriod)
                .font(.system(size: 9, weight: .medium))
                .foregroundStyle(WidgetColors.textTertiary(for: renderingMode))
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(
            promo.is2x
                ? WidgetColors.statusColor(for: "active", mode: renderingMode).opacity(0.1)
                : WidgetColors.surfaceRaised(for: renderingMode)
        )
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}
