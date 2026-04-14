<?php
namespace SpiderLens;

defined('ABSPATH') || exit;

class Cron {

    public static function init(): void {
        add_action('spider_lens_flush_buffer',      [Collector::class, 'flush_buffer']);
        // Invalidation du cache stats après chaque flush (priorité 20 → après le flush buffer)
        add_action('spider_lens_flush_buffer',      [Cache::class, 'flush_all'], 20);
        add_action('spider_lens_detect_anomalies',  [self::class, 'detect_anomalies']);
        add_action('spider_lens_weekly_report',     [self::class, 'send_weekly_report']);
        add_action('spider_lens_purge_old_hits',    [self::class, 'purge_old_hits']);
        add_action('spider_lens_crawl_batch',       [Crawler::class, 'process_batch']);
        add_action('spider_lens_auto_crawl',        [self::class, 'auto_crawl']);

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
        // Auto-crawl hebdomadaire (dimanche 3h UTC) — si activé dans les settings
        $settings = get_option('spider_lens_settings', []);
        if (!empty($settings['auto_crawl_enabled'])) {
            if (!wp_next_scheduled('spider_lens_auto_crawl')) {
                $next_sunday_3h = self::next_weekday_at(7, 3);
                wp_schedule_event($next_sunday_3h, 'weekly', 'spider_lens_auto_crawl');
            }
        }
    }

    public static function unschedule_events(): void {
        foreach ([
            'spider_lens_flush_buffer',
            'spider_lens_detect_anomalies',
            'spider_lens_weekly_report',
            'spider_lens_purge_old_hits',
            'spider_lens_auto_crawl',
        ] as $hook) {
            $ts = wp_next_scheduled($hook);
            if ($ts) wp_unschedule_event($ts, $hook);
        }
        wp_clear_scheduled_hook('spider_lens_crawl_batch');
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

        // ── 1. Traffic spike ─────────────────────────────────
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

        if ($baseline && $baseline['mean'] && (float)$baseline['stddev'] >= 5) {
            $mean      = (float) $baseline['mean'];
            $stddev    = (float) $baseline['stddev'];
            $threshold = $mean + 2.5 * $stddev;

            $current = (int) $wpdb->get_var($wpdb->prepare(
                "SELECT COUNT(*) FROM `$t`
                WHERE timestamp >= DATE_FORMAT(NOW(), %s)
                  AND timestamp <  DATE_FORMAT(NOW(), %s)",
                '%Y-%m-%d ' . str_pad($h, 2, '0', STR_PAD_LEFT) . ':00:00',
                '%Y-%m-%d ' . str_pad($h, 2, '0', STR_PAD_LEFT) . ':59:59'
            ));

            if ($threshold > 0 && $current > $threshold && !self::was_recently_detected($ta, 'traffic_spike', 2)) {
                $severity = $current > ($mean + 4 * $stddev) ? 'critical' : 'warning';
                $wpdb->insert($ta, [
                    'type'        => 'traffic_spike',
                    'severity'    => $severity,
                    'observed'    => $current,
                    'baseline'    => $mean,
                    'message'     => sprintf('Trafic heure %dh : %d req (baseline : %.0f ± %.0f)', $h, $current, $mean, $stddev),
                    'detected_at' => $now,
                ]);
                self::maybe_send_webhook('traffic_spike', $severity, $current, $mean);
            }
        }

        // ── 2. Error rate spike (5xx statistique) ─────────────
        $err_stats = $wpdb->get_row($wpdb->prepare(
            "SELECT COUNT(*) AS total,
                    SUM(CASE WHEN status_code >= 500 THEN 1 ELSE 0 END) AS err5xx
             FROM `$t` WHERE timestamp >= DATE_FORMAT(NOW(), %s)",
            '%Y-%m-%d ' . str_pad($h, 2, '0', STR_PAD_LEFT) . ':00:00'
        ), ARRAY_A);

        if ($err_stats && (int)$err_stats['total'] >= 20) {
            $rate5xx = (int)$err_stats['err5xx'] / (int)$err_stats['total'];

            // Baseline taux 5xx sur 7j (slots horaires avec > 10 req)
            $rate_history = $wpdb->get_results(
                "SELECT COUNT(*) AS total,
                        SUM(CASE WHEN status_code >= 500 THEN 1 ELSE 0 END) AS err5xx
                 FROM `$t`
                 WHERE timestamp BETWEEN DATE_SUB(NOW(), INTERVAL 8 DAY)
                                     AND DATE_SUB(NOW(), INTERVAL 1 DAY)
                 GROUP BY DATE_FORMAT(timestamp, '%Y-%m-%d %H')
                 HAVING total > 10
                 ORDER BY 1 DESC LIMIT 168",
                ARRAY_A
            );

            if (count($rate_history) >= 10) {
                $rates   = array_map(fn($r) => (int)$r['err5xx'] / (int)$r['total'], $rate_history);
                $mean5xx = array_sum($rates) / count($rates);
                $var5xx  = array_sum(array_map(fn($v) => ($v - $mean5xx) ** 2, $rates)) / count($rates);
                $std5xx  = sqrt($var5xx);
                $thr5xx  = $mean5xx + 2.5 * $std5xx;

                if ($rate5xx > $thr5xx && !self::was_recently_detected($ta, 'error_rate_spike', 2)) {
                    $severity = $rate5xx > $mean5xx + 4 * $std5xx ? 'critical' : 'warning';
                    $wpdb->insert($ta, [
                        'type'        => 'error_rate_spike',
                        'severity'    => $severity,
                        'observed'    => round($rate5xx * 100, 1),
                        'baseline'    => round($mean5xx * 100, 1),
                        'message'     => sprintf('Taux 5xx : %.1f%% (baseline : %.1f%%)', $rate5xx * 100, $mean5xx * 100),
                        'detected_at' => $now,
                    ]);
                    self::maybe_send_webhook('error_rate_spike', $severity, $rate5xx * 100, $mean5xx * 100);
                }
            }
        }

        // ── 3. Googlebot absent ───────────────────────────────
        $settings = get_option('spider_lens_settings', []);
        if (!empty($settings['alert_googlebot_enabled'])) {
            $days   = max(1, (int)($settings['alert_googlebot_days'] ?? 7));
            $cutoff = date('Y-m-d H:i:s', strtotime("-{$days} days"));

            // Vérifier qu'il y a du trafic récent (évite faux positifs si site silencieux)
            $has_traffic = (int) $wpdb->get_var($wpdb->prepare(
                "SELECT COUNT(*) FROM `$t` WHERE timestamp >= %s", $cutoff
            )) > 0;

            if ($has_traffic) {
                $last_googlebot = $wpdb->get_var(
                    "SELECT MAX(timestamp) FROM `$t` WHERE bot_name = 'Googlebot'"
                );
                if (!$last_googlebot || $last_googlebot < $cutoff) {
                    if (!self::was_recently_detected($ta, 'googlebot_absent', 24)) {
                        $wpdb->insert($ta, [
                            'type'        => 'googlebot_absent',
                            'severity'    => 'warning',
                            'observed'    => 0,
                            'baseline'    => $days,
                            'message'     => sprintf(
                                'Googlebot absent depuis %d jours (dernière visite : %s)',
                                $days,
                                $last_googlebot ?: 'inconnue'
                            ),
                            'detected_at' => $now,
                        ]);
                        self::maybe_send_webhook('googlebot_absent', 'warning', 0, $days);
                    }
                }
            }
        }

        // ── 4. Unknown bot spike ──────────────────────────────
        $ub_stats = $wpdb->get_row($wpdb->prepare(
            "SELECT COUNT(*) AS total,
                    SUM(CASE WHEN is_bot = 1 AND (bot_name IS NULL OR bot_name = 'Generic Bot') THEN 1 ELSE 0 END) AS unknown_bots
             FROM `$t` WHERE timestamp >= DATE_FORMAT(NOW(), %s)",
            '%Y-%m-%d ' . str_pad($h, 2, '0', STR_PAD_LEFT) . ':00:00'
        ), ARRAY_A);

        if ($ub_stats && (int)$ub_stats['total'] >= 20) {
            $ub_rate = (int)$ub_stats['unknown_bots'] / (int)$ub_stats['total'];

            if ($ub_rate >= 0.15) {
                $ub_history = $wpdb->get_results(
                    "SELECT COUNT(*) AS total,
                            SUM(CASE WHEN is_bot = 1 AND (bot_name IS NULL OR bot_name = 'Generic Bot') THEN 1 ELSE 0 END) AS ub
                     FROM `$t`
                     WHERE timestamp BETWEEN DATE_SUB(NOW(), INTERVAL 8 DAY)
                                         AND DATE_SUB(NOW(), INTERVAL 1 DAY)
                     GROUP BY DATE_FORMAT(timestamp, '%Y-%m-%d %H')
                     HAVING total > 5
                     LIMIT 168",
                    ARRAY_A
                );

                if (count($ub_history) >= 10) {
                    $ub_rates   = array_map(fn($r) => (int)$r['ub'] / (int)$r['total'], $ub_history);
                    $ub_mean    = array_sum($ub_rates) / count($ub_rates);
                    $ub_var     = array_sum(array_map(fn($v) => ($v - $ub_mean) ** 2, $ub_rates)) / count($ub_rates);
                    $ub_std     = sqrt($ub_var);
                    $ub_thresh  = $ub_mean + 2.5 * $ub_std;

                    if ($ub_rate > $ub_thresh && !self::was_recently_detected($ta, 'unknown_bot_spike', 4)) {
                        $wpdb->insert($ta, [
                            'type'        => 'unknown_bot_spike',
                            'severity'    => 'warning',
                            'observed'    => round($ub_rate * 100, 1),
                            'baseline'    => round($ub_mean * 100, 1),
                            'message'     => sprintf(
                                'Bots inconnus : %.1f%% du trafic (baseline : %.1f%%)',
                                $ub_rate * 100, $ub_mean * 100
                            ),
                            'detected_at' => $now,
                        ]);
                        self::maybe_send_webhook('unknown_bot_spike', 'warning', $ub_rate * 100, $ub_mean * 100);
                    }
                }
            }
        }
    }

    /**
     * Vérifie si une anomalie de ce type a déjà été détectée récemment (déduplication).
     */
    private static function was_recently_detected(string $ta, string $type, int $window_hours): bool {
        global $wpdb;
        $since = date('Y-m-d H:i:s', strtotime("-{$window_hours} hours"));
        $count = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM `$ta` WHERE type = %s AND detected_at >= %s",
            $type, $since
        ));
        return $count > 0;
    }

    // ── Auto-crawl hebdomadaire ───────────────────────────

    public static function auto_crawl(): void {
        global $wpdb;
        $settings = get_option('spider_lens_settings', []);
        if (empty($settings['auto_crawl_enabled'])) return;

        // Vérifier qu'au moins un sitemap est configuré
        $ts = $wpdb->prefix . 'spiderlens_sitemaps';
        $sitemap_count = (int) $wpdb->get_var("SELECT COUNT(*) FROM `$ts`");
        if ($sitemap_count === 0) return;

        // Ne pas lancer si un crawl est déjà en cours
        if (get_option('spider_lens_crawl_run_id')) return;

        Crawler::start_crawl();
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
            'error_rate_spike' => "Taux d'erreurs 5xx élevé",
            'googlebot_absent' => 'Googlebot absent',
            'unknown_bot_spike' => 'Spike de bots inconnus',
        ];
        $descriptions = [
            'traffic_spike'    => sprintf("Observé : **%.0f req/h** — Baseline : **%.0f req/h**", $observed, $baseline),
            'error_rate_spike' => sprintf("Taux 5xx actuel : **%.1f%%** — Baseline : **%.1f%%**", $observed, $baseline),
            'googlebot_absent' => sprintf("Googlebot n'a pas été détecté depuis **%d jours**.", (int)$baseline),
            'unknown_bot_spike' => sprintf("Bots inconnus : **%.1f%%** du trafic — Baseline : **%.1f%%**", $observed, $baseline),
        ];

        $payload = ['embeds' => [[
            'title'       => '⚠️ ' . ($labels[$type] ?? $type),
            'color'       => $color,
            'description' => $descriptions[$type] ?? sprintf("Observé : **%.1f** — Baseline : **%.1f**", $observed, $baseline),
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
