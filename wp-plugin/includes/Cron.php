<?php
namespace SpiderLens;

defined('ABSPATH') || exit;

class Cron {

    public static function init(): void {
        add_action('spider_lens_flush_buffer',      [Collector::class, 'flush_buffer']);
        add_action('spider_lens_detect_anomalies',  [self::class, 'detect_anomalies']);
        add_action('spider_lens_weekly_report',     [self::class, 'send_weekly_report']);
        add_action('spider_lens_purge_old_hits',    [self::class, 'purge_old_hits']);

        // Enregistrer l'intervalle "every_minute" si inexistant
        add_filter('cron_schedules', [self::class, 'add_schedules']);
    }

    public static function add_schedules(array $schedules): array {
        if (!isset($schedules['every_minute'])) {
            $schedules['every_minute'] = [
                'interval' => 60,
                'display'  => __('Toutes les minutes', 'spider-lens'),
            ];
        }
        return $schedules;
    }

    public static function schedule_events(): void {
        if (!wp_next_scheduled('spider_lens_flush_buffer')) {
            wp_schedule_event(time(), 'every_minute', 'spider_lens_flush_buffer');
        }
        if (!wp_next_scheduled('spider_lens_detect_anomalies')) {
            wp_schedule_event(time(), 'hourly', 'spider_lens_detect_anomalies');
        }
        if (!wp_next_scheduled('spider_lens_weekly_report')) {
            // Lundi à 8h UTC
            $next_monday_8h = self::next_weekday_at(1, 8);
            wp_schedule_event($next_monday_8h, 'weekly', 'spider_lens_weekly_report');
        }
        if (!wp_next_scheduled('spider_lens_purge_old_hits')) {
            wp_schedule_event(time(), 'daily', 'spider_lens_purge_old_hits');
        }
    }

    public static function unschedule_events(): void {
        foreach (['spider_lens_flush_buffer', 'spider_lens_detect_anomalies', 'spider_lens_weekly_report', 'spider_lens_purge_old_hits'] as $hook) {
            $ts = wp_next_scheduled($hook);
            if ($ts) wp_unschedule_event($ts, $hook);
        }
    }

    // ── Purge ─────────────────────────────────────────────

    public static function purge_old_hits(): void {
        global $wpdb;
        $settings = get_option('spider_lens_settings', []);
        $days     = (int)($settings['retention_days'] ?? 90);
        if ($days < 7) $days = 90;

        $t = $wpdb->prefix . 'spiderlens_hits';
        $wpdb->query($wpdb->prepare(
            "DELETE FROM `$t` WHERE timestamp < %s LIMIT 10000",
            date('Y-m-d H:i:s', strtotime("-{$days} days"))
        ));
    }

    // ── Détection d'anomalies ─────────────────────────────

    public static function detect_anomalies(): void {
        global $wpdb;
        $t   = $wpdb->prefix . 'spiderlens_hits';
        $ta  = $wpdb->prefix . 'spiderlens_anomalies';
        $now = current_time('mysql');
        $h   = (int) date('H');

        // Baseline : moyenne + écart-type des 7 derniers jours à la même heure
        $baseline = $wpdb->get_row($wpdb->prepare(
            "SELECT AVG(cnt) AS mean, STDDEV(cnt) AS stddev
            FROM (
                SELECT COUNT(*) AS cnt
                FROM `$t`
                WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 8 DAY)
                  AND timestamp <  DATE_SUB(NOW(), INTERVAL 1 DAY)
                  AND HOUR(timestamp) = %d
                GROUP BY DATE(timestamp)
            ) sub",
            $h
        ), ARRAY_A);

        if (!$baseline || !$baseline['mean']) return;

        $mean   = (float) $baseline['mean'];
        $stddev = (float) $baseline['stddev'];
        $threshold = $mean + 2.5 * $stddev;

        // Trafic de l'heure courante
        $current = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM `$t`
            WHERE timestamp >= DATE_FORMAT(NOW(), %s)
              AND timestamp <  DATE_FORMAT(NOW(), %s)",
            '%Y-%m-%d ' . str_pad($h, 2, '0', STR_PAD_LEFT) . ':00:00',
            '%Y-%m-%d ' . str_pad($h, 2, '0', STR_PAD_LEFT) . ':59:59'
        ));

        if ($threshold > 0 && $current > $threshold) {
            $severity = $current > ($mean + 4 * $stddev) ? 'critical' : 'warning';
            $wpdb->insert($ta, [
                'type'        => 'traffic_spike',
                'severity'    => $severity,
                'observed'    => $current,
                'baseline'    => $mean,
                'message'     => sprintf('Trafic heure %dh : %d requêtes (baseline : %.0f ± %.0f)', $h, $current, $mean, $stddev),
                'detected_at' => $now,
            ]);
            self::maybe_send_webhook('traffic_spike', $severity, $current, $mean);
        }

        // Taux d'erreurs élevé
        $err_row = $wpdb->get_row($wpdb->prepare(
            "SELECT COUNT(*) AS total,
                    SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) AS errors
            FROM `$t`
            WHERE timestamp >= DATE_FORMAT(NOW(), %s)",
            '%Y-%m-%d ' . str_pad($h, 2, '0', STR_PAD_LEFT) . ':00:00'
        ), ARRAY_A);

        if ($err_row && $err_row['total'] > 50) {
            $error_rate = ($err_row['errors'] / $err_row['total']) * 100;
            if ($error_rate > 20) {
                $severity = $error_rate > 50 ? 'critical' : 'warning';
                $wpdb->insert($ta, [
                    'type'        => 'error_rate_spike',
                    'severity'    => $severity,
                    'observed'    => round($error_rate, 1),
                    'baseline'    => 5,
                    'message'     => sprintf('Taux d\'erreurs : %.1f%%', $error_rate),
                    'detected_at' => $now,
                ]);
                self::maybe_send_webhook('error_rate_spike', $severity, $error_rate, 5);
            }
        }
    }

    // ── Rapport hebdomadaire ──────────────────────────────

    public static function send_weekly_report(): void {
        $settings = get_option('spider_lens_settings', []);
        if (empty($settings['weekly_report_enabled'])) return;

        $now      = new \DateTime();
        $dow      = (int)$now->format('N');
        $monday   = clone $now;
        $monday->modify('-' . ($dow - 1) . ' days')->setTime(0, 0, 0);
        $sunday   = clone $monday;
        $sunday->modify('+6 days')->setTime(23, 59, 59);

        $from = $monday->format('Y-m-d H:i:s');
        $to   = $sunday->format('Y-m-d H:i:s');

        $data     = Database::get_overview($from, $to);
        $siteName = get_bloginfo('name');
        $weekLabel = $monday->format('d/m/Y') . ' – ' . $sunday->format('d/m/Y');

        // Webhook Discord/Slack
        if (!empty($settings['webhook_enabled']) && !empty($settings['webhook_url'])) {
            $total  = (int)($data['total']  ?? 0);
            $humans = (int)($data['humans'] ?? 0);
            $bots   = (int)($data['bots']   ?? 0);
            $errors = (int)($data['s4xx'] ?? 0) + (int)($data['s5xx'] ?? 0);
            $rate   = $total > 0 ? round(($errors / $total) * 100, 1) : 0;

            $payload = [
                'embeds' => [[
                    'title'       => "📊 Rapport hebdomadaire — {$siteName}",
                    'color'       => 0x00c6e0,
                    'description' => "**{$weekLabel}**",
                    'fields'      => [
                        ['name' => '📈 Trafic', 'value' => "Requêtes : **{$total}**\nHumains : **{$humans}**\nBots : **{$bots}**\nTaux erreurs : **{$rate}%**", 'inline' => false],
                    ],
                    'footer'    => ['text' => 'Spider-Lens WP Plugin'],
                    'timestamp' => (new \DateTime())->format(\DateTime::ATOM),
                ]],
            ];

            wp_remote_post($settings['webhook_url'], [
                'headers'     => ['Content-Type' => 'application/json'],
                'body'        => wp_json_encode($payload),
                'data_format' => 'body',
                'timeout'     => 10,
            ]);
        }

        // Email
        if (!empty($settings['alert_email'])) {
            $subject = "[Spider-Lens] Rapport hebdomadaire — {$siteName} — {$weekLabel}";
            $message = "<h2>Rapport hebdomadaire — {$siteName}</h2>
                <p><strong>{$weekLabel}</strong></p>
                <table>
                    <tr><td>Requêtes totales</td><td><strong>" . number_format((int)($data['total'] ?? 0)) . "</strong></td></tr>
                    <tr><td>Visiteurs humains</td><td><strong>" . number_format((int)($data['humans'] ?? 0)) . "</strong></td></tr>
                    <tr><td>Bots</td><td><strong>" . number_format((int)($data['bots'] ?? 0)) . "</strong></td></tr>
                    <tr><td>Taux d'erreurs</td><td><strong>" . (isset($data['errorRate']) ? $data['errorRate'] : '?') . "%</strong></td></tr>
                </table>
                <p><small>Spider-Lens WP Plugin — " . get_site_url() . "</small></p>";

            wp_mail(
                $settings['alert_email'],
                $subject,
                $message,
                ['Content-Type: text/html; charset=UTF-8']
            );
        }
    }

    // ── Webhook helper ────────────────────────────────────

    private static function maybe_send_webhook(string $type, string $severity, float $observed, float $baseline): void {
        $settings = get_option('spider_lens_settings', []);
        if (empty($settings['webhook_enabled']) || empty($settings['webhook_url'])) return;

        $color  = $severity === 'critical' ? 0xd62246 : 0xf59e0b;
        $labels = [
            'traffic_spike'    => 'Spike de trafic',
            'error_rate_spike' => "Taux d'erreurs élevé",
        ];

        $payload = ['embeds' => [[
            'title'       => '⚠️ ' . ($labels[$type] ?? $type),
            'color'       => $color,
            'description' => sprintf("Observé : **%.0f** — Baseline : **%.0f**", $observed, $baseline),
            'footer'      => ['text' => 'Spider-Lens WP — ' . get_bloginfo('name')],
            'timestamp'   => (new \DateTime())->format(\DateTime::ATOM),
        ]]];

        wp_remote_post($settings['webhook_url'], [
            'headers'     => ['Content-Type' => 'application/json'],
            'body'        => wp_json_encode($payload),
            'data_format' => 'body',
            'timeout'     => 5,
        ]);
    }

    // ── Helpers ───────────────────────────────────────────

    private static function next_weekday_at(int $weekday, int $hour): int {
        $dt = new \DateTime('now', new \DateTimeZone('UTC'));
        $dt->setTime($hour, 0, 0);
        $current_dow = (int)$dt->format('N');
        $diff = ($weekday - $current_dow + 7) % 7;
        if ($diff === 0) $diff = 7; // Toujours dans le futur
        $dt->modify("+{$diff} days");
        return $dt->getTimestamp();
    }
}
