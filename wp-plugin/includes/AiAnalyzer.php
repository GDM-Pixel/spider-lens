<?php
namespace SpiderLens;

defined('ABSPATH') || exit;

class AiAnalyzer {

    const CACHE_TTL      = 300; // 5 minutes
    const DEFAULT_MODEL  = 'gemini-2.5-flash';
    const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent';

    // ---------------------------------------------------------------------------
    // Public API
    // ---------------------------------------------------------------------------

    /**
     * Lance une analyse structurée SEO et retourne un tableau JSON.
     * Résultat mis en cache 5 min via transient WP.
     */
    public static function analyze_structured(string $language = 'fr'): array|\WP_Error {
        $cache_key = 'spider_lens_analysis_' . $language;
        $cached    = get_transient($cache_key);
        if ($cached !== false) {
            return $cached;
        }

        $settings  = get_option('spider_lens_settings', []);
        $api_key   = $settings['gemini_api_key'] ?? '';
        $model     = $settings['gemini_model'] ?? self::DEFAULT_MODEL;

        if (empty($api_key)) {
            return new \WP_Error('no_api_key', 'GEMINI_API_KEY non configurée.', ['status' => 422]);
        }

        $summary = self::build_site_summary();
        $prompt  = self::build_analysis_prompt($summary, $language);

        $response = self::call_gemini($api_key, $model, [
            ['role' => 'user', 'parts' => [['text' => $prompt]]],
        ]);

        if (is_wp_error($response)) {
            return $response;
        }

        $text = self::extract_text($response);
        $data = self::parse_json_response($text);

        if ($data === null) {
            return new \WP_Error('parse_error', 'Réponse IA invalide.', ['status' => 500]);
        }

        set_transient($cache_key, $data, self::CACHE_TTL);
        return $data;
    }

    /**
     * Chat multi-turn avec Nova.
     * Retourne la réponse textuelle complète.
     */
    public static function chat(array $messages, ?array $page_context = null): string|\WP_Error {
        $settings = get_option('spider_lens_settings', []);
        $api_key  = $settings['gemini_api_key'] ?? '';
        $model    = $settings['gemini_model'] ?? self::DEFAULT_MODEL;

        if (empty($api_key)) {
            return new \WP_Error('no_api_key', 'GEMINI_API_KEY non configurée.', ['status' => 422]);
        }

        $summary      = self::build_site_summary();
        $system_prompt = self::build_system_prompt($summary, $page_context);

        // Construire l'historique Gemini (max 10 messages)
        $history = array_slice($messages, -10);
        $contents = [];

        // Injecter le system prompt comme premier message user/model
        $contents[] = ['role' => 'user',  'parts' => [['text' => $system_prompt]]];
        $contents[] = ['role' => 'model', 'parts' => [['text' => "Compris. Je suis Nova, prête à analyser vos données."]]];

        foreach ($history as $msg) {
            $role = ($msg['role'] ?? 'user') === 'user' ? 'user' : 'model';
            $contents[] = [
                'role'  => $role,
                'parts' => [['text' => $msg['content'] ?? '']],
            ];
        }

        $response = self::call_gemini($api_key, $model, $contents);

        if (is_wp_error($response)) {
            return $response;
        }

        return self::extract_text($response);
    }

    /**
     * Chat streaming SSE avec Nova.
     * Utilise cURL pour lire le stream Gemini et relayer les chunks en Server-Sent Events.
     */
    public static function chat_stream(array $messages, ?array $page_context = null): void {
        $settings = get_option('spider_lens_settings', []);
        $api_key  = $settings['gemini_api_key'] ?? '';
        $model    = $settings['gemini_model'] ?? self::DEFAULT_MODEL;

        @ini_set('output_buffering', 'off');
        @ini_set('zlib.output_compression', false);
        header('Content-Type: text/event-stream');
        header('Cache-Control: no-cache');
        header('X-Accel-Buffering: no');
        header('Connection: keep-alive');

        if (empty($api_key)) {
            echo "data: " . wp_json_encode(['error' => 'GEMINI_API_KEY non configurée.']) . "\n\n";
            flush();
            return;
        }

        $summary       = self::build_site_summary();
        $system_prompt = self::build_system_prompt($summary, $page_context);

        $history  = array_slice($messages, -10);
        $contents = [];
        $contents[] = ['role' => 'user',  'parts' => [['text' => $system_prompt]]];
        $contents[] = ['role' => 'model', 'parts' => [['text' => 'Compris. Je suis Nova, prête à analyser vos données.']]];
        foreach ($history as $msg) {
            $role       = ($msg['role'] ?? 'user') === 'user' ? 'user' : 'model';
            $contents[] = ['role' => $role, 'parts' => [['text' => $msg['content'] ?? '']]];
        }

        // URL stream Gemini (alt=sse pour recevoir les chunks au fil de l'eau)
        $base_url   = sprintf(self::GEMINI_API_URL, $model);
        $stream_url = str_replace(':generateContent', ':streamGenerateContent', $base_url);
        $stream_url = add_query_arg(['key' => $api_key, 'alt' => 'sse'], $stream_url);

        $body = wp_json_encode([
            'contents'         => $contents,
            'generationConfig' => ['temperature' => 0.7, 'maxOutputTokens' => 4096],
        ]);

        // cURL avec WRITEFUNCTION pour relayer les chunks au fil de l'eau
        $ch = curl_init($stream_url);
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $body,
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
            CURLOPT_TIMEOUT        => 120,
            CURLOPT_RETURNTRANSFER => false,
            CURLOPT_WRITEFUNCTION  => static function ($curl, $data): int {
                // Format Gemini SSE : "data: {...json...}\n\n"
                foreach (explode("\n", $data) as $line) {
                    $line = trim($line);
                    if (strpos($line, 'data:') !== 0) continue;
                    $json_str = trim(substr($line, 5));
                    if ($json_str === '' || $json_str === '[DONE]') continue;
                    $chunk = json_decode($json_str, true);
                    $text  = $chunk['candidates'][0]['content']['parts'][0]['text'] ?? null;
                    if ($text !== null) {
                        echo "data: " . wp_json_encode(['text' => $text]) . "\n\n";
                        @ob_flush();
                        flush();
                    }
                }
                return strlen($data);
            },
        ]);

        curl_exec($ch);
        $curl_err = curl_error($ch);
        curl_close($ch);

        if ($curl_err) {
            echo "data: " . wp_json_encode(['error' => $curl_err]) . "\n\n";
            flush();
        }
        echo "data: [DONE]\n\n";
        flush();
    }

    // ---------------------------------------------------------------------------
    // Build site summary (agrégation des données du site)
    // ---------------------------------------------------------------------------

    public static function build_site_summary(): array {
        global $wpdb;
        $t  = $wpdb->prefix . 'spiderlens_hits';
        $tc = $wpdb->prefix . 'spiderlens_crawl_pages';

        $from = date('Y-m-d H:i:s', strtotime('-30 days'));
        $to   = current_time('mysql');

        // ── Vue d'ensemble globale ────────────────────────────
        $overview = $wpdb->get_row($wpdb->prepare(
            "SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN is_bot = 0 THEN 1 ELSE 0 END) AS humans,
                SUM(CASE WHEN is_bot = 1 THEN 1 ELSE 0 END) AS bots,
                SUM(CASE WHEN status_code BETWEEN 200 AND 299 THEN 1 ELSE 0 END) AS s2xx,
                SUM(CASE WHEN status_code BETWEEN 300 AND 399 THEN 1 ELSE 0 END) AS s3xx,
                SUM(CASE WHEN status_code BETWEEN 400 AND 499 THEN 1 ELSE 0 END) AS s4xx,
                SUM(CASE WHEN status_code BETWEEN 500 AND 599 THEN 1 ELSE 0 END) AS s5xx,
                AVG(CASE WHEN response_time IS NOT NULL THEN response_time END) AS avg_ttfb
             FROM `$t` WHERE timestamp BETWEEN %s AND %s",
            $from, $to
        ), ARRAY_A);

        $total  = (int) ($overview['total'] ?? 0);
        $humans = (int) ($overview['humans'] ?? 0);
        $bots   = (int) ($overview['bots'] ?? 0);
        $s4xx   = (int) ($overview['s4xx'] ?? 0);
        $s5xx   = (int) ($overview['s5xx'] ?? 0);
        $error_rate = $total > 0 ? round(($s4xx + $s5xx) / $total * 100, 1) : 0;

        // ── Taux d'erreur humains seuls (plus pertinent SEO) ──
        // Filtre : UA non vides (exclut bots déguisés en humains)
        $human_overview = $wpdb->get_row($wpdb->prepare(
            "SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN status_code BETWEEN 400 AND 499 THEN 1 ELSE 0 END) AS s4xx,
                SUM(CASE WHEN status_code BETWEEN 500 AND 599 THEN 1 ELSE 0 END) AS s5xx
             FROM `$t`
             WHERE is_bot = 0 AND user_agent IS NOT NULL AND user_agent != ''
               AND timestamp BETWEEN %s AND %s",
            $from, $to
        ), ARRAY_A);

        $human_total = (int) ($human_overview['total'] ?? 0);
        $human_error_rate = $human_total > 0
            ? round((((int)($human_overview['s4xx'] ?? 0) + (int)($human_overview['s5xx'] ?? 0)) / $human_total) * 100, 1)
            : 0;

        // ── Estimation des requêtes scan (wp-login, .env, etc.) ──
        $scan_estimate = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM `$t`
             WHERE is_bot = 0 AND user_agent IS NOT NULL AND user_agent != ''
               AND (url LIKE '%wp-login%' OR url LIKE '%xmlrpc%' OR url LIKE '%%.env%'
                    OR url LIKE '%/.git%' OR url LIKE '%/phpmyadmin%'
                    OR url LIKE '%wlwmanifest%' OR url LIKE '%/actuator%'
                    OR url LIKE '%/info.php%')
               AND timestamp BETWEEN %s AND %s",
            $from, $to
        ));

        // ── Breakdown 404 : humains / googlebot / scans ───────
        $err404_detail = $wpdb->get_row($wpdb->prepare(
            "SELECT
                SUM(CASE WHEN is_bot = 0 THEN 1 ELSE 0 END) AS human404,
                SUM(CASE WHEN bot_name = 'Googlebot' THEN 1 ELSE 0 END) AS googlebot404,
                SUM(CASE WHEN is_bot = 1 AND bot_name != 'Googlebot'
                         AND (url LIKE '%wp-login%' OR url LIKE '%%.env%'
                              OR url LIKE '%/.git%' OR url LIKE '%/phpmyadmin%'
                              OR url LIKE '%xmlrpc%') THEN 1 ELSE 0 END) AS scan404,
                SUM(CASE WHEN is_bot = 1 THEN 1 ELSE 0 END) AS bot404
             FROM `$t`
             WHERE status_code = 404 AND timestamp BETWEEN %s AND %s",
            $from, $to
        ), ARRAY_A);

        // ── Top 5 pages 404 humains (hors UA vides) ───────────
        $top404_raw = $wpdb->get_results($wpdb->prepare(
            "SELECT url, COUNT(*) AS hits
             FROM `$t`
             WHERE status_code = 404 AND is_bot = 0
               AND user_agent IS NOT NULL AND user_agent != ''
               AND timestamp BETWEEN %s AND %s
             GROUP BY url ORDER BY hits DESC LIMIT 5",
            $from, $to
        ), ARRAY_A);

        // Cross-référence avec le crawler (inCrawl: true = vrai lien cassé interne)
        $crawl_count = (int) $wpdb->get_var("SELECT COUNT(*) FROM `$tc`");
        $top404 = array_map(function ($r) use ($wpdb, $tc, $crawl_count) {
            $in_crawl = null;
            if ($crawl_count > 0) {
                $url_pattern = rtrim($r['url'], '…') . '%';
                $found = $wpdb->get_var($wpdb->prepare(
                    "SELECT 1 FROM `$tc` WHERE url LIKE %s LIMIT 1",
                    $url_pattern
                ));
                $in_crawl = (bool) $found;
            }
            return ['url' => $r['url'], 'hits' => (int) $r['hits'], 'inCrawl' => $in_crawl];
        }, $top404_raw ?: []);

        // ── Stats Googlebot ───────────────────────────────────
        $googlebot = $wpdb->get_row($wpdb->prepare(
            "SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN status_code BETWEEN 200 AND 299 THEN 1 ELSE 0 END) AS s2xx,
                SUM(CASE WHEN status_code = 404 THEN 1 ELSE 0 END) AS s404,
                SUM(CASE WHEN status_code BETWEEN 500 AND 599 THEN 1 ELSE 0 END) AS s5xx,
                COUNT(DISTINCT DATE(timestamp)) AS active_days
             FROM `$t`
             WHERE bot_name = 'Googlebot' AND timestamp BETWEEN %s AND %s",
            $from, $to
        ), ARRAY_A);

        // Top 5 URLs 404 vues par Googlebot
        $googlebot_top404 = $wpdb->get_results($wpdb->prepare(
            "SELECT url, COUNT(*) AS hits
             FROM `$t`
             WHERE bot_name = 'Googlebot' AND status_code = 404
               AND timestamp BETWEEN %s AND %s
             GROUP BY url ORDER BY hits DESC LIMIT 5",
            $from, $to
        ), ARRAY_A) ?: [];

        // ── Stats bots SEO tiers (codes HTTP qu'ils voient) ──
        $seo_bots = [
            'bingbot'    => 'Bingbot',
            'ahrefsbot'  => 'AhrefsBot',
            'semrushbot' => 'SemrushBot',
            'mj12bot'    => 'MJ12bot',
            'claudebot'  => 'ClaudeBot',
            'gptbot'     => 'GPTBot',
        ];
        $seo_bot_stats = [];
        foreach ($seo_bots as $key => $bot_name) {
            $row = $wpdb->get_row($wpdb->prepare(
                "SELECT
                    COUNT(*) AS total,
                    SUM(CASE WHEN status_code BETWEEN 200 AND 299 THEN 1 ELSE 0 END) AS s2xx,
                    SUM(CASE WHEN status_code = 404 THEN 1 ELSE 0 END) AS s404,
                    SUM(CASE WHEN status_code BETWEEN 500 AND 599 THEN 1 ELSE 0 END) AS s5xx,
                    COUNT(DISTINCT DATE(timestamp)) AS active_days
                 FROM `$t`
                 WHERE bot_name = %s AND timestamp BETWEEN %s AND %s",
                $bot_name, $from, $to
            ), ARRAY_A);
            if ($row && (int) $row['total'] > 0) {
                $seo_bot_stats[$key] = [
                    'total'      => (int) $row['total'],
                    's2xx'       => (int) $row['s2xx'],
                    's404'       => (int) $row['s404'],
                    's5xx'       => (int) $row['s5xx'],
                    'activeDays' => (int) $row['active_days'],
                ];
            }
        }

        // ── Top 5 pages visitées (humains, 200) avec % bots ──
        $top_pages_raw = $wpdb->get_results($wpdb->prepare(
            "SELECT url,
                COUNT(*) AS hits,
                SUM(CASE WHEN is_bot = 1 THEN 1 ELSE 0 END) AS bot_hits
             FROM `$t`
             WHERE status_code = 200 AND timestamp BETWEEN %s AND %s
             GROUP BY url ORDER BY hits DESC LIMIT 5",
            $from, $to
        ), ARRAY_A) ?: [];
        $top_pages = array_map(fn($r) => [
            'url'    => $r['url'],
            'hits'   => (int) $r['hits'],
            'botPct' => $r['hits'] > 0 ? round((int)$r['bot_hits'] / (int)$r['hits'] * 100) . '%' : '0%',
        ], $top_pages_raw);

        // ── Top 5 bots ────────────────────────────────────────
        $top_bots = $wpdb->get_results($wpdb->prepare(
            "SELECT bot_name, COUNT(*) AS hits
             FROM `$t`
             WHERE is_bot = 1 AND bot_name IS NOT NULL AND timestamp BETWEEN %s AND %s
             GROUP BY bot_name ORDER BY hits DESC LIMIT 5",
            $from, $to
        ), ARRAY_A);

        // ── TTFB ─────────────────────────────────────────────
        $ttfb_raw = $wpdb->get_row($wpdb->prepare(
            "SELECT
                AVG(response_time) AS avg_ms,
                COUNT(*) AS total,
                SUM(CASE WHEN response_time > 800 THEN 1 ELSE 0 END) AS slow
             FROM `$t`
             WHERE response_time IS NOT NULL AND timestamp BETWEEN %s AND %s",
            $from, $to
        ), ARRAY_A);

        $slowest_url = $wpdb->get_row($wpdb->prepare(
            "SELECT url, AVG(response_time) AS avg_rt
             FROM `$t`
             WHERE response_time IS NOT NULL AND timestamp BETWEEN %s AND %s
             GROUP BY url HAVING COUNT(*) >= 3
             ORDER BY avg_rt DESC LIMIT 1",
            $from, $to
        ), ARRAY_A);

        $ttfb_total = (int) ($ttfb_raw['total'] ?? 0);
        $slow_pct   = $ttfb_total > 0
            ? round((int)($ttfb_raw['slow'] ?? 0) / $ttfb_total * 100, 1) . '%'
            : '0%';

        // ── Tendance hebdo : semaine courante vs précédente ───
        $week_start = date('Y-m-d H:i:s', strtotime('-7 days'));
        $prev_start = date('Y-m-d H:i:s', strtotime('-14 days'));

        $curr_week_row = $wpdb->get_row($wpdb->prepare(
            "SELECT COUNT(*) AS total,
                SUM(CASE WHEN status_code BETWEEN 400 AND 599 THEN 1 ELSE 0 END) AS errors
             FROM `$t` WHERE timestamp BETWEEN %s AND %s",
            $week_start, $to
        ), ARRAY_A);

        $prev_week_row = $wpdb->get_row($wpdb->prepare(
            "SELECT COUNT(*) AS total,
                SUM(CASE WHEN status_code BETWEEN 400 AND 599 THEN 1 ELSE 0 END) AS errors
             FROM `$t` WHERE timestamp BETWEEN %s AND %s",
            $prev_start, $week_start
        ), ARRAY_A);

        $curr_total = (int) ($curr_week_row['total'] ?? 0);
        $prev_total = (int) ($prev_week_row['total'] ?? 0);
        $delta = $prev_total > 0
            ? ($curr_total - $prev_total) / $prev_total * 100
            : null;
        $weekly_trend = [
            'prevTotal'  => $prev_total,
            'currTotal'  => $curr_total,
            'delta'      => $delta !== null ? ($delta >= 0 ? '+' . round($delta) . '%' : round($delta) . '%') : null,
            'prevErrors' => (int) ($prev_week_row['errors'] ?? 0),
            'currErrors' => (int) ($curr_week_row['errors'] ?? 0),
        ];

        // ── Top pays (GeoIP) ─────────────────────────────────
        // Priorité 1 : country_code capturé par Cloudflare (zéro overhead)
        $top_countries = [];
        $has_geo = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM `$t` WHERE country_code IS NOT NULL AND timestamp BETWEEN %s AND %s",
            $from, $to
        ));
        if ($has_geo > 0) {
            $country_rows = $wpdb->get_results($wpdb->prepare(
                "SELECT country_code AS code, COUNT(*) AS hits
                 FROM `$t`
                 WHERE country_code IS NOT NULL AND timestamp BETWEEN %s AND %s
                 GROUP BY country_code ORDER BY hits DESC LIMIT 5",
                $from, $to
            ), ARRAY_A) ?: [];
            $top_countries = array_map(fn($r) => ['code' => $r['code'], 'hits' => (int) $r['hits']], $country_rows);
        } else {
            // Priorité 2 : fallback batch ip-api.com (gratuit, 45 req/min)
            // Uniquement pour le summary IA — résolution des top 100 IPs distinctes
            $top_ips = $wpdb->get_results($wpdb->prepare(
                "SELECT ip, COUNT(*) AS hits
                 FROM `$t`
                 WHERE ip IS NOT NULL AND ip != '' AND ip != '0.0.0.0'
                   AND timestamp BETWEEN %s AND %s
                 GROUP BY ip ORDER BY hits DESC LIMIT 100",
                $from, $to
            ), ARRAY_A) ?: [];

            if (!empty($top_ips)) {
                $top_countries = self::resolve_countries_batch($wpdb, $t, $top_ips);
            }
        }

        // ── Anomalies récentes (3 max) ─────────────────────────
        $ta = $wpdb->prefix . 'spiderlens_anomalies';
        $anomalies = $wpdb->get_results(
            "SELECT type, severity, DATE(detected_at) AS date FROM `$ta` ORDER BY id DESC LIMIT 3",
            ARRAY_A
        ) ?: [];

        // ── Données crawl on-page ─────────────────────────────
        $crawl = null;
        if ($crawl_count > 0) {
            $crawl = $wpdb->get_row("
                SELECT
                    COUNT(*) AS total,
                    SUM(CASE WHEN (title IS NULL OR title = '') THEN 1 ELSE 0 END) AS missing_title,
                    SUM(CASE WHEN (h1 IS NULL OR h1 = '') THEN 1 ELSE 0 END) AS missing_h1,
                    SUM(CASE WHEN meta_robots LIKE '%noindex%' THEN 1 ELSE 0 END) AS noindex,
                    AVG(CASE WHEN word_count > 0 THEN word_count END) AS avg_word_count,
                    SUM(CASE WHEN word_count > 0 AND word_count < 300 THEN 1 ELSE 0 END) AS thin_content,
                    SUM(CASE WHEN error IS NOT NULL AND error != '' THEN 1 ELSE 0 END) AS errors,
                    MAX(crawled_at) AS last_crawl
                FROM `$tc`
            ", ARRAY_A);
        }

        return [
            'period'   => '30d',
            'siteUrl'  => get_site_url(),
            'siteName' => get_bloginfo('name'),
            'overview' => [
                'total'               => $total,
                'humans'              => $humans,
                'bots'                => $bots,
                's2xx'                => (int) ($overview['s2xx'] ?? 0),
                's3xx'                => (int) ($overview['s3xx'] ?? 0),
                's4xx'                => $s4xx,
                's5xx'                => $s5xx,
                'errorRate'           => $error_rate . '%',
                'humanErrorRate'      => $human_error_rate . '%',
                'scanRequestsEstimate' => $scan_estimate,
            ],
            'err404Detail' => [
                'human404'    => (int) ($err404_detail['human404'] ?? 0),
                'googlebot404' => (int) ($err404_detail['googlebot404'] ?? 0),
                'scan404'     => (int) ($err404_detail['scan404'] ?? 0),
                'bot404'      => (int) ($err404_detail['bot404'] ?? 0),
            ],
            'top404'   => $top404,
            'topPages' => $top_pages,
            'topBots'  => array_map(fn($r) => ['name' => $r['bot_name'], 'hits' => (int) $r['hits']], $top_bots ?: []),
            'googlebot' => [
                'total'      => (int) ($googlebot['total'] ?? 0),
                's2xx'       => (int) ($googlebot['s2xx'] ?? 0),
                's404'       => (int) ($googlebot['s404'] ?? 0),
                's5xx'       => (int) ($googlebot['s5xx'] ?? 0),
                'activeDays' => (int) ($googlebot['active_days'] ?? 0),
                'top404'     => array_map(fn($r) => ['url' => $r['url'], 'hits' => (int) $r['hits']], $googlebot_top404),
            ],
            'seoBotStats' => $seo_bot_stats,
            'ttfb' => [
                'avg'        => round((float) ($ttfb_raw['avg_ms'] ?? 0)),
                'slowPct'    => $slow_pct,
                'slowestUrl' => $slowest_url['url'] ?? null,
            ],
            'topCountries'    => $top_countries,
            'weeklyTrend'     => $weekly_trend,
            'recentAnomalies' => $anomalies,
            'crawlSummary'    => $crawl ? [
                'total'        => (int) $crawl['total'],
                'missingTitle' => (int) $crawl['missing_title'],
                'missingH1'    => (int) $crawl['missing_h1'],
                'noindex'      => (int) $crawl['noindex'],
                'avgWordCount' => round((float) ($crawl['avg_word_count'] ?? 0)),
                'thinContent'  => (int) $crawl['thin_content'],
                'errors'       => (int) $crawl['errors'],
                'lastCrawl'    => $crawl['last_crawl'],
            ] : null,
        ];
    }

    // ---------------------------------------------------------------------------
    // GeoIP fallback via ip-api.com/batch
    // ---------------------------------------------------------------------------

    /**
     * Résout les codes pays pour une liste d'IPs via ip-api.com/batch.
     * Met à jour la DB pour éviter de re-résoudre à chaque appel (cache permanent).
     * Retourne un tableau [['code' => 'FR', 'hits' => 123], ...] trié par hits desc.
     */
    private static function resolve_countries_batch($wpdb, string $table, array $top_ips): array {
        // Appel ip-api.com — max 100 IPs, gratuit, pas de clé requise
        $payload = array_map(fn($r) => ['query' => $r['ip'], 'fields' => 'countryCode,query'], $top_ips);

        $response = wp_remote_post('http://ip-api.com/batch?fields=countryCode,query', [
            'headers'     => ['Content-Type' => 'application/json'],
            'body'        => wp_json_encode($payload),
            'timeout'     => 10,
            'data_format' => 'body',
        ]);

        if (is_wp_error($response)) return [];

        $results = json_decode(wp_remote_retrieve_body($response), true);
        if (!is_array($results)) return [];

        // Construire un map ip → country_code et mettre à jour la DB
        $ip_country_map = [];
        foreach ($results as $item) {
            $ip = $item['query'] ?? null;
            $cc = $item['countryCode'] ?? null;
            if ($ip && $cc && strlen($cc) === 2) {
                $ip_country_map[$ip] = $cc;
            }
        }

        if (empty($ip_country_map)) return [];

        // Mettre à jour la DB par lot (cache permanent pour les prochains appels)
        foreach ($ip_country_map as $ip => $cc) {
            $wpdb->query($wpdb->prepare(
                "UPDATE `$table` SET country_code = %s WHERE ip = %s AND country_code IS NULL LIMIT 1000",
                $cc, $ip
            ));
        }

        // Agréger par pays en utilisant les hits connus
        $country_hits = [];
        foreach ($top_ips as $row) {
            $cc = $ip_country_map[$row['ip']] ?? null;
            if ($cc) {
                $country_hits[$cc] = ($country_hits[$cc] ?? 0) + (int) $row['hits'];
            }
        }

        // Trier et retourner le top 5
        arsort($country_hits);
        $top5 = array_slice($country_hits, 0, 5, true);
        return array_map(
            fn($code, $hits) => ['code' => $code, 'hits' => $hits],
            array_keys($top5),
            array_values($top5)
        );
    }

    // ---------------------------------------------------------------------------
    // Prompts
    // ---------------------------------------------------------------------------

    private static function build_analysis_prompt(array $summary, string $language): string {
        $summary_json = wp_json_encode($summary, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $lang = explode('-', $language)[0];

        $score_labels = [
            'great'    => ['fr' => 'Très Bon',  'en' => 'Great',    'es' => 'Muy Bueno', 'de' => 'Sehr Gut',  'it' => 'Ottimo',   'nl' => 'Uitstekend'],
            'good'     => ['fr' => 'Bon',       'en' => 'Good',     'es' => 'Bueno',     'de' => 'Gut',       'it' => 'Buono',    'nl' => 'Goed'      ],
            'average'  => ['fr' => 'Moyen',     'en' => 'Average',  'es' => 'Regular',   'de' => 'Mittel',    'it' => 'Medio',    'nl' => 'Gemiddeld' ],
            'bad'      => ['fr' => 'Mauvais',   'en' => 'Poor',     'es' => 'Malo',      'de' => 'Schlecht',  'it' => 'Scarso',   'nl' => 'Slecht'    ],
            'critical' => ['fr' => 'Critique',  'en' => 'Critical', 'es' => 'Crítico',   'de' => 'Kritisch',  'it' => 'Critico',  'nl' => 'Kritiek'   ],
        ];
        $get = fn($key) => $score_labels[$key][$lang] ?? $score_labels[$key]['en'];
        $lgreat = $get('great'); $lgood = $get('good'); $lavg = $get('average');
        $lbad = $get('bad'); $lcrit = $get('critical');

        return <<<PROMPT
You are an SEO expert analyzing the health of a WordPress website based on its traffic data captured by Spider-Lens (a server-side WordPress plugin).

SITE DATA (last 30 days):
{$summary_json}

IMPORTANT: All text fields in your response (summary, titles, details, actions, why, key names) MUST be written in "{$language}" language. Only JSON keys and enum values (scoreColor, impact, trend, icon names) must remain in English.

Generate a structured SEO analysis as strict JSON. Follow EXACTLY this format:

{
  "score": <integer 0-100>,
  "scoreLabel": <"{$lcrit}"|"{$lbad}"|"{$lavg}"|"{$lgood}"|"{$lgreat}">,
  "scoreColor": <"dustyred"|"amber"|"moonstone"|"green">,
  "summary": <short synthesis sentence, max 120 chars, pedagogical>,
  "problems": [
    {
      "id": <snake_case identifier>,
      "icon": <phosphor icon e.g. "ph:warning-diamond">,
      "color": <"dustyred"|"amber"|"moonstone">,
      "title": <short problem title>,
      "detail": <pedagogical explanation with analogy, max 150 chars>,
      "impact": <"critique"|"warning"|"info">
    }
  ],
  "recommendations": [
    {
      "id": <snake_case identifier>,
      "icon": <phosphor icon e.g. "ph:arrow-bend-up-right">,
      "title": <short recommendation title>,
      "action": <concrete action to take, max 150 chars>,
      "why": <why it matters for SEO, max 100 chars>
    }
  ],
  "highlights": [
    {
      "key": <metric name>,
      "value": <formatted value e.g. "11 344">,
      "trend": <"up"|"down"|"neutral">,
      "icon": <phosphor icon>
    }
  ]
}

SEO SCORING PHILOSOPHY — READ CAREFULLY:
This is an SEO-focused analysis. The score reflects what Google cares about, NOT raw server statistics.

WHAT MATTERS FOR SEO (affects the score):
1. Googlebot health (googlebot field): 404s and 5xx seen by Googlebot, activeDays — this is the PRIMARY SEO signal.
2. SEO bot health (seoBotStats field): HTTP codes seen by Bingbot, AhrefsBot, SemrushBot, MJ12bot, ClaudeBot, GPTBot. High 404/5xx rates across multiple bots = confirmed site health issue.
3. TTFB: server response time affects Core Web Vitals and crawl efficiency.
4. Crawl budget waste: Googlebot crawling 404 pages wastes crawl budget.
5. Human 404s (top404 field): only penalize those with inCrawl: true (real internal broken links confirmed by crawler).

WHAT DOES NOT AFFECT SEO SCORE:
- humanErrorRate may be inflated by automated scanners (bots hitting wp-login, .env, etc.). Do NOT use it as a primary scoring signal.
- scan404 in err404Detail: security scan attempts — NOT an SEO problem.
- The global errorRate includes all bot scans — do NOT use it for scoring.
- scanRequestsEstimate: if significant (> 50), humanErrorRate is likely inflated. Mention as info only.
- top404 entries with inCrawl: false — scanners or external links. Do NOT penalize the score for these.

CRAWLER DATA (top404 cross-reference — when crawlSummary is available):
- top404 entries with "inCrawl: true": real broken internal link → penalize score.
- top404 entries with "inCrawl: false": not a real page (scanner, external referrer) → do NOT penalize.
- top404 entries with "inCrawl: null": no crawl data yet, treat with caution.
- crawlSummary.missingTitle > 0: pages without <title> tag — critical SEO issue.
- crawlSummary.missingH1 > 0: pages without <h1> tag — important SEO issue.
- crawlSummary.thinContent: pages < 300 words — flag as warning if > 10% of total.
- crawlSummary.noindex: mention as info (may be intentional).
- If crawlSummary is null: no crawl has been run yet, do not mention crawl data.

SCORING RULES:
- 80-100 → "{$lgreat}", scoreColor: "green"
- 60-79 → "{$lgood}", scoreColor: "moonstone"
- 40-59 → "{$lavg}", scoreColor: "amber"
- 20-39 → "{$lbad}", scoreColor: "dustyred"
- 0-19 → "{$lcrit}", scoreColor: "dustyred"

PROBLEMS rules (3 to 5 problems):
- impact "critique": Googlebot seeing 5xx errors, or TTFB avg > 1000ms, or Googlebot absent (activeDays < 3)
- impact "warning": Googlebot 404s > 10 URLs, or humanErrorRate > 5%, or TTFB avg 500-1000ms
- impact "info": minor optimizations, security scans (mention as info only, not SEO-critical)

HIGHLIGHTS rules (2 to 4 positive signals or key metrics):
- Googlebot activity, human visit trends, fast TTFB, low human error rate, etc.

ICONS rules (use only @phosphor-icons):
- Errors/problems: ph:warning-diamond, ph:x-circle, ph:bug
- Performance: ph:lightning, ph:gauge, ph:clock
- Bots/crawl: ph:robot, ph:magnifying-glass
- SEO/links: ph:arrow-bend-up-right, ph:link, ph:files
- Positive: ph:check-circle, ph:trend-up, ph:star

Return ONLY the JSON, no markdown, no comments, no text before or after.
PROMPT;
    }

    private static function build_system_prompt(array $summary, ?array $page_context): string {
        $summary_json = wp_json_encode($summary, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $ctx_json     = $page_context ? wp_json_encode($page_context, JSON_UNESCAPED_UNICODE) : null;

        $page_ctx_block = $ctx_json
            ? "CONTEXTE PAGE ACTUELLE (ce que l'utilisateur voit en ce moment) :\n{$ctx_json}"
            : '';

        $site_name = $summary['siteName'] ?? '';
        $site_url  = $summary['siteUrl'] ?? '';

        return <<<PROMPT
Tu es Nova, une assistante SEO intégrée à Spider-Lens, un outil d'analyse de trafic WordPress.

COMPORTEMENT :
- Tu es conversationnelle et naturelle. Si l'utilisateur dit "Salut", tu réponds juste "Salut !" ou quelque chose de court et chaleureux — pas un rapport complet.
- Tu adaptes la longueur de ta réponse à la question posée. Question courte → réponse courte. Question technique → réponse détaillée.
- Tu n'envoies JAMAIS tout ce que tu sais d'emblée. Tu attends qu'on te pose une vraie question.
- Si on te demande une analyse ou un bilan, alors oui tu développes. Sinon, tu restes concise.
- Tu utilises le Markdown uniquement quand c'est utile (listes, code). Pas de titres H1/H2 pour une réponse de 2 phrases.
- Tu réponds dans la langue de l'utilisateur.
- Tu expliques les termes techniques simplement quand c'est pertinent.
- Si un contexte de page est fourni, mentionne naturellement la page dans ta première phrase (ex: "Sur la page TTFB, je vois que..."), puis concentre-toi sur ces données.

DONNÉES DU SITE (30 derniers jours — {$site_name} — {$site_url}) :
{$summary_json}

{$page_ctx_block}
PROMPT;
    }

    // ---------------------------------------------------------------------------
    // Gemini API call
    // ---------------------------------------------------------------------------

    private static function call_gemini(string $api_key, string $model, array $contents): array|\WP_Error {
        $url = sprintf(self::GEMINI_API_URL, $model) . '?key=' . $api_key;

        $body = wp_json_encode([
            'contents'         => $contents,
            'generationConfig' => [
                'temperature'     => 0.7,
                'maxOutputTokens' => 4096,
            ],
        ]);

        $response = wp_remote_post($url, [
            'headers'     => ['Content-Type' => 'application/json'],
            'body'        => $body,
            'timeout'     => 60,
            'data_format' => 'body',
        ]);

        if (is_wp_error($response)) {
            return $response;
        }

        $code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);

        if ($code === 400 && isset($data['error']['message'])) {
            return new \WP_Error('gemini_error', $data['error']['message'], ['status' => 400]);
        }

        if ($code !== 200) {
            return new \WP_Error('gemini_http', "Gemini API returned HTTP $code", ['status' => 500]);
        }

        return $data;
    }

    private static function extract_text(array $gemini_response): string {
        return $gemini_response['candidates'][0]['content']['parts'][0]['text'] ?? '';
    }

    private static function parse_json_response(string $text): ?array {
        // Extraire le JSON même s'il est entouré de markdown ```json ... ```
        if (preg_match('/```(?:json)?\s*([\s\S]+?)\s*```/i', $text, $m)) {
            $text = $m[1];
        }

        // Trouver le premier { et le dernier }
        $start = strpos($text, '{');
        $end   = strrpos($text, '}');
        if ($start === false || $end === false) {
            return null;
        }

        $json = substr($text, $start, $end - $start + 1);
        $data = json_decode($json, true);

        return is_array($data) ? $data : null;
    }
}
