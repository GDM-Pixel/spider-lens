<?php
namespace SpiderLens;

defined('ABSPATH') || exit;

class RestApi {

    const API_NAMESPACE = 'spider-lens/v1';

    public static function init(): void {
        add_action('rest_api_init', [self::class, 'register_routes']);
    }

    public static function register_routes(): void {
        $ns = self::API_NAMESPACE;

        // Stats générales
        register_rest_route($ns, '/stats/overview',       ['methods' => 'GET', 'callback' => [self::class, 'get_overview'],       'permission_callback' => [self::class, 'check_permission']]);
        register_rest_route($ns, '/stats/http-codes',     ['methods' => 'GET', 'callback' => [self::class, 'get_http_codes'],     'permission_callback' => [self::class, 'check_permission']]);
        register_rest_route($ns, '/stats/top-pages',      ['methods' => 'GET', 'callback' => [self::class, 'get_top_pages'],      'permission_callback' => [self::class, 'check_permission']]);
        register_rest_route($ns, '/stats/top-404',        ['methods' => 'GET', 'callback' => [self::class, 'get_top_404'],        'permission_callback' => [self::class, 'check_permission']]);
        register_rest_route($ns, '/stats/bots',           ['methods' => 'GET', 'callback' => [self::class, 'get_bots'],           'permission_callback' => [self::class, 'check_permission']]);
        register_rest_route($ns, '/stats/ttfb',           ['methods' => 'GET', 'callback' => [self::class, 'get_ttfb'],           'permission_callback' => [self::class, 'check_permission']]);
        register_rest_route($ns, '/stats/weekly-trends',  ['methods' => 'GET', 'callback' => [self::class, 'get_weekly_trends'],  'permission_callback' => [self::class, 'check_permission']]);
        register_rest_route($ns, '/stats/timeline',       ['methods' => 'GET', 'callback' => [self::class, 'get_timeline'],       'permission_callback' => [self::class, 'check_permission']]);

        // Réseau
        register_rest_route($ns, '/network/ips',          ['methods' => 'GET', 'callback' => [self::class, 'get_ips'],            'permission_callback' => [self::class, 'check_permission']]);
        register_rest_route($ns, '/network/ips/(?P<ip>[^/]+)/urls', ['methods' => 'GET', 'callback' => [self::class, 'get_ip_urls'], 'permission_callback' => [self::class, 'check_permission']]);
        register_rest_route($ns, '/network/user-agents',  ['methods' => 'GET', 'callback' => [self::class, 'get_user_agents'],    'permission_callback' => [self::class, 'check_permission']]);

        // Anomalies
        register_rest_route($ns, '/anomalies',            ['methods' => 'GET', 'callback' => [self::class, 'get_anomalies'],      'permission_callback' => [self::class, 'check_permission']]);
        register_rest_route($ns, '/anomalies/recent',     ['methods' => 'GET', 'callback' => [self::class, 'get_anomalies_recent'], 'permission_callback' => [self::class, 'check_permission']]);

        // Blocklist
        register_rest_route($ns, '/blocklist',            ['methods' => 'GET',    'callback' => [self::class, 'get_blocklist'],    'permission_callback' => [self::class, 'check_permission']]);
        register_rest_route($ns, '/blocklist',            ['methods' => 'POST',   'callback' => [self::class, 'add_blocklist'],    'permission_callback' => [self::class, 'check_permission']]);
        register_rest_route($ns, '/blocklist/(?P<ip>[^/]+)', ['methods' => 'DELETE', 'callback' => [self::class, 'del_blocklist'], 'permission_callback' => [self::class, 'check_permission']]);
        register_rest_route($ns, '/blocklist/export/(?P<format>nginx|apache)', ['methods' => 'GET', 'callback' => [self::class, 'export_blocklist'], 'permission_callback' => [self::class, 'check_permission']]);

        // Paramètres
        register_rest_route($ns, '/settings',             ['methods' => 'GET',  'callback' => [self::class, 'get_settings'],      'permission_callback' => [self::class, 'check_permission']]);
        register_rest_route($ns, '/settings',             ['methods' => 'POST', 'callback' => [self::class, 'save_settings'],     'permission_callback' => [self::class, 'check_permission']]);

        // Flush buffer manuel
        register_rest_route($ns, '/flush',                ['methods' => 'POST', 'callback' => [self::class, 'flush_now'],         'permission_callback' => [self::class, 'check_permission']]);

        // Test webhook
        register_rest_route($ns, '/settings/test-webhook', ['methods' => 'POST', 'callback' => [self::class, 'test_webhook'],    'permission_callback' => [self::class, 'check_permission']]);

        // Exports CSV
        register_rest_route($ns, '/stats/http-codes/export',  ['methods' => 'GET', 'callback' => [self::class, 'export_http_codes'], 'permission_callback' => [self::class, 'check_permission']]);
        register_rest_route($ns, '/stats/url-detail',         ['methods' => 'GET', 'callback' => [self::class, 'get_url_detail'],    'permission_callback' => [self::class, 'check_permission']]);
        register_rest_route($ns, '/stats/url-detail/export',  ['methods' => 'GET', 'callback' => [self::class, 'export_url_detail'], 'permission_callback' => [self::class, 'check_permission']]);
        register_rest_route($ns, '/stats/bots/export',       ['methods' => 'GET', 'callback' => [self::class, 'export_bots'],       'permission_callback' => [self::class, 'check_permission']]);
        register_rest_route($ns, '/stats/top-pages/export',  ['methods' => 'GET', 'callback' => [self::class, 'export_top_pages'],  'permission_callback' => [self::class, 'check_permission']]);
        register_rest_route($ns, '/stats/top-404/export',    ['methods' => 'GET', 'callback' => [self::class, 'export_top_404'],    'permission_callback' => [self::class, 'check_permission']]);
        register_rest_route($ns, '/stats/ttfb/export',       ['methods' => 'GET', 'callback' => [self::class, 'export_ttfb'],       'permission_callback' => [self::class, 'check_permission']]);
        register_rest_route($ns, '/network/ips/export',      ['methods' => 'GET', 'callback' => [self::class, 'export_ips'],        'permission_callback' => [self::class, 'check_permission']]);
        register_rest_route($ns, '/network/user-agents/export', ['methods' => 'GET', 'callback' => [self::class, 'export_user_agents'], 'permission_callback' => [self::class, 'check_permission']]);

        // Crawler SEO on-page
        register_rest_route($ns, '/crawler/sitemaps',                      ['methods' => 'GET',    'callback' => [self::class, 'get_sitemaps'],     'permission_callback' => [self::class, 'check_permission']]);
        register_rest_route($ns, '/crawler/sitemaps',                      ['methods' => 'POST',   'callback' => [self::class, 'add_sitemap'],      'permission_callback' => [self::class, 'check_permission']]);
        register_rest_route($ns, '/crawler/sitemaps/(?P<id>\d+)',          ['methods' => 'DELETE', 'callback' => [self::class, 'delete_sitemap'],   'permission_callback' => [self::class, 'check_permission']]);
        register_rest_route($ns, '/crawler/start',                         ['methods' => 'POST',   'callback' => [self::class, 'start_crawl'],      'permission_callback' => [self::class, 'check_permission']]);
        register_rest_route($ns, '/crawler/cancel',                        ['methods' => 'POST',   'callback' => [self::class, 'cancel_crawl'],     'permission_callback' => [self::class, 'check_permission']]);
        register_rest_route($ns, '/crawler/status',                        ['methods' => 'GET',    'callback' => [self::class, 'get_crawl_status'], 'permission_callback' => [self::class, 'check_permission']]);
        register_rest_route($ns, '/crawler/runs',                          ['methods' => 'GET',    'callback' => [self::class, 'get_crawl_runs'],   'permission_callback' => [self::class, 'check_permission']]);
        register_rest_route($ns, '/crawler/pages',                         ['methods' => 'GET',    'callback' => [self::class, 'get_crawl_pages'],  'permission_callback' => [self::class, 'check_permission']]);
        register_rest_route($ns, '/crawler/summary',                       ['methods' => 'GET',    'callback' => [self::class, 'get_crawl_summary'], 'permission_callback' => [self::class, 'check_permission']]);

        // Re-check URL 404
        register_rest_route($ns, '/crawler/recheck-url', ['methods' => 'POST', 'callback' => [self::class, 'recheck_url'], 'permission_callback' => [self::class, 'check_permission']]);

        // Assistant IA
        register_rest_route($ns, '/assistant/analyze',     ['methods' => 'POST', 'callback' => [self::class, 'ai_analyze'],     'permission_callback' => [self::class, 'check_permission']]);
        register_rest_route($ns, '/assistant/chat',        ['methods' => 'POST', 'callback' => [self::class, 'ai_chat'],        'permission_callback' => [self::class, 'check_permission']]);
        register_rest_route($ns, '/assistant/chat-stream', ['methods' => 'POST', 'callback' => [self::class, 'ai_chat_stream'], 'permission_callback' => [self::class, 'check_permission']]);
    }

    public static function check_permission(): bool {
        return current_user_can('manage_options');
    }

    // ── Helpers ──────────────────────────────────────────────

    private static function get_range(\WP_REST_Request $req): array {
        $from = sanitize_text_field($req->get_param('from') ?: date('Y-m-d', strtotime('-30 days')));
        $to   = sanitize_text_field($req->get_param('to')   ?: date('Y-m-d'));
        return [
            'from' => $from . ' 00:00:00',
            'to'   => $to   . ' 23:59:59',
        ];
    }

    private static function table(string $name): string {
        global $wpdb;
        return $wpdb->prefix . 'spiderlens_' . $name;
    }

    // ── Endpoints ────────────────────────────────────────────

    public static function get_overview(\WP_REST_Request $req): \WP_REST_Response {
        $params = (array) $req->get_params();
        $key    = Cache::key('overview', $params);
        $ttl    = Cache::ttl_for_range($params['to'] ?? date('Y-m-d'));
        $data   = Cache::remember($key, $ttl, function () use ($req) {
            ['from' => $from, 'to' => $to] = self::get_range($req);
            $data   = Database::get_overview($from, $to);
            $total  = (int)($data['total'] ?? 0);
            $errors = (int)($data['s4xx'] ?? 0) + (int)($data['s5xx'] ?? 0);
            $data['errorRate'] = $total > 0 ? round(($errors / $total) * 100, 1) : 0;
            $data['avg_ttfb']  = $data['avg_ttfb'] ? round((float)$data['avg_ttfb']) : null;
            return $data;
        });
        return rest_ensure_response($data);
    }

    public static function get_http_codes(\WP_REST_Request $req): \WP_REST_Response {
        $params = (array) $req->get_params();
        $key    = Cache::key('http-codes', $params);
        $ttl    = Cache::ttl_for_range($params['to'] ?? date('Y-m-d'));
        $rows   = Cache::remember($key, $ttl, function () use ($req) {
            global $wpdb;
            ['from' => $from, 'to' => $to] = self::get_range($req);
            $t = self::table('hits');
            return $wpdb->get_results($wpdb->prepare(
                "SELECT
                    DATE(timestamp) AS day,
                    SUM(CASE WHEN status_code BETWEEN 200 AND 299 THEN 1 ELSE 0 END) AS s2xx,
                    SUM(CASE WHEN status_code BETWEEN 300 AND 399 THEN 1 ELSE 0 END) AS s3xx,
                    SUM(CASE WHEN status_code BETWEEN 400 AND 499 THEN 1 ELSE 0 END) AS s4xx,
                    SUM(CASE WHEN status_code BETWEEN 500 AND 599 THEN 1 ELSE 0 END) AS s5xx
                FROM `$t`
                WHERE timestamp BETWEEN %s AND %s
                GROUP BY DATE(timestamp)
                ORDER BY day ASC",
                $from, $to
            ), ARRAY_A);
        });
        return rest_ensure_response($rows);
    }

    public static function get_top_pages(\WP_REST_Request $req): \WP_REST_Response {
        $params = (array) $req->get_params();
        $key    = Cache::key('top-pages', $params);
        $ttl    = Cache::ttl_for_range($params['to'] ?? date('Y-m-d'));
        $rows   = Cache::remember($key, $ttl, function () use ($req) {
            global $wpdb;
            ['from' => $from, 'to' => $to] = self::get_range($req);
            $t     = self::table('hits');
            $limit = min((int)($req->get_param('limit') ?: 50), 500);
            return $wpdb->get_results($wpdb->prepare(
                "SELECT
                    url,
                    COUNT(*) AS hits,
                    SUM(CASE WHEN is_bot = 0 THEN 1 ELSE 0 END) AS human_hits,
                    SUM(CASE WHEN is_bot = 1 THEN 1 ELSE 0 END) AS bot_hits,
                    MAX(timestamp) AS last_seen
                FROM `$t`
                WHERE timestamp BETWEEN %s AND %s AND status_code = 200
                GROUP BY url
                ORDER BY hits DESC
                LIMIT %d",
                $from, $to, $limit
            ), ARRAY_A);
        });
        return rest_ensure_response($rows);
    }

    public static function get_top_404(\WP_REST_Request $req): \WP_REST_Response {
        $params = (array) $req->get_params();
        $key    = Cache::key('top-404', $params);
        $ttl    = Cache::ttl_for_range($params['to'] ?? date('Y-m-d'));
        $rows   = Cache::remember($key, $ttl, function () use ($req) {
            global $wpdb;
            ['from' => $from, 'to' => $to] = self::get_range($req);
            $t  = self::table('hits');
            $tr = self::table('url_rechecks');
            $limit = min((int)($req->get_param('limit') ?: 50), 500);
            return $wpdb->get_results($wpdb->prepare(
                "SELECT
                    h.url,
                    COUNT(*) AS hits,
                    SUM(CASE WHEN h.is_bot = 0 THEN 1 ELSE 0 END) AS human_hits,
                    SUM(CASE WHEN h.is_bot = 1 THEN 1 ELSE 0 END) AS bot_hits,
                    MAX(h.timestamp) AS last_seen,
                    ur.status_code AS recheck_status,
                    ur.final_url   AS recheck_final_url,
                    ur.checked_at  AS recheck_checked_at
                FROM `$t` h
                LEFT JOIN `$tr` ur ON ur.url_hash = SHA2(h.url, 256)
                WHERE h.timestamp BETWEEN %s AND %s AND h.status_code = 404
                GROUP BY h.url, ur.status_code, ur.final_url, ur.checked_at
                ORDER BY hits DESC
                LIMIT %d",
                $from, $to, $limit
            ), ARRAY_A);
        });
        return rest_ensure_response($rows);
    }

    public static function get_bots(\WP_REST_Request $req): \WP_REST_Response {
        $params = (array) $req->get_params();
        $key    = Cache::key('bots', $params);
        $ttl    = Cache::ttl_for_range($params['to'] ?? date('Y-m-d'));
        $rows   = Cache::remember($key, $ttl, function () use ($req) {
            global $wpdb;
            ['from' => $from, 'to' => $to] = self::get_range($req);
            $t = self::table('hits');
            return $wpdb->get_results($wpdb->prepare(
                "SELECT
                    bot_name AS name,
                    is_bot,
                    COUNT(*) AS hits,
                    MAX(timestamp) AS last_seen
                FROM `$t`
                WHERE timestamp BETWEEN %s AND %s AND is_bot = 1 AND bot_name IS NOT NULL
                GROUP BY bot_name, is_bot
                ORDER BY hits DESC",
                $from, $to
            ), ARRAY_A);
        });
        return rest_ensure_response($rows);
    }

    public static function get_ttfb(\WP_REST_Request $req): \WP_REST_Response {
        $params = (array) $req->get_params();
        $key    = Cache::key('ttfb', $params);
        $ttl    = Cache::ttl_for_range($params['to'] ?? date('Y-m-d'));
        $rows   = Cache::remember($key, $ttl, function () use ($req) {
            global $wpdb;
            ['from' => $from, 'to' => $to] = self::get_range($req);
            $t    = self::table('hits');
            $rows = $wpdb->get_results($wpdb->prepare(
                "SELECT
                    DATE(timestamp)  AS day,
                    AVG(response_time) AS avg_ttfb,
                    MIN(response_time) AS min_ttfb,
                    MAX(response_time) AS max_ttfb,
                    COUNT(*)           AS total
                FROM `$t`
                WHERE timestamp BETWEEN %s AND %s AND response_time IS NOT NULL AND is_bot = 0
                GROUP BY DATE(timestamp)
                ORDER BY day ASC",
                $from, $to
            ), ARRAY_A);
            foreach ($rows as &$r) {
                $r['avg_ttfb'] = $r['avg_ttfb'] ? round((float)$r['avg_ttfb']) : null;
                $r['min_ttfb'] = $r['min_ttfb'] ? (int)$r['min_ttfb'] : null;
                $r['max_ttfb'] = $r['max_ttfb'] ? (int)$r['max_ttfb'] : null;
            }
            return $rows;
        });
        return rest_ensure_response($rows);
    }

    public static function get_weekly_trends(\WP_REST_Request $req): \WP_REST_Response {
        $params = (array) $req->get_params();
        $key    = Cache::key('weekly-trends', $params);
        // weekly-trends couvre toujours la semaine courante → TTL court
        $ttl    = 300;
        $data   = Cache::remember($key, $ttl, function () use ($req) {
            global $wpdb;
            $t     = self::table('hits');
            $weeks = min((int)($req->get_param('weeks') ?: 12), 52);

            // Lundi de la semaine courante
            $now    = new \DateTime();
            $dow    = (int)$now->format('N');
            $monday = clone $now;
            $monday->modify('-' . ($dow - 1) . ' days')->setTime(0, 0, 0);
            $since  = (clone $monday)->modify('-' . ($weeks - 1) . ' weeks')->format('Y-m-d H:i:s');
            $until  = (clone $monday)->modify('+6 days')->setTime(23, 59, 59)->format('Y-m-d H:i:s');

            // Une seule requête avec GROUP BY semaine au lieu de N requêtes en boucle
            // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
            $rows = $wpdb->get_results($wpdb->prepare(
                "SELECT
                    DATE_FORMAT(timestamp, '%%X-%%V') AS iso_week,
                    STR_TO_DATE(CONCAT(YEAR(timestamp), ' ', WEEK(timestamp, 3), ' 1'), '%%X %%V %%w') AS week_start,
                    COUNT(*) AS total,
                    SUM(CASE WHEN is_bot = 0 THEN 1 ELSE 0 END) AS humans,
                    SUM(CASE WHEN is_bot = 1 THEN 1 ELSE 0 END) AS bots,
                    SUM(CASE WHEN bot_name = 'Googlebot' THEN 1 ELSE 0 END) AS googlebot,
                    SUM(CASE WHEN status_code BETWEEN 400 AND 599 THEN 1 ELSE 0 END) AS errors,
                    AVG(CASE WHEN response_time IS NOT NULL AND is_bot = 0 THEN response_time END) AS avg_ttfb
                FROM `$t`
                WHERE timestamp BETWEEN %s AND %s
                GROUP BY iso_week, week_start
                ORDER BY iso_week ASC",
                $since, $until
            ), ARRAY_A);

            return array_map(fn($r) => [
                'week'       => $r['week_start'] ?? '',
                'week_label' => $r['week_start'] ? date('d/m', strtotime($r['week_start'])) : '',
                'total'      => (int)($r['total'] ?? 0),
                'humans'     => (int)($r['humans'] ?? 0),
                'bots'       => (int)($r['bots'] ?? 0),
                'googlebot'  => (int)($r['googlebot'] ?? 0),
                'errors'     => (int)($r['errors'] ?? 0),
                'avg_ttfb'   => $r['avg_ttfb'] ? (int)round((float)$r['avg_ttfb']) : null,
            ], $rows);
        });
        return rest_ensure_response($data);
    }

    public static function get_timeline(\WP_REST_Request $req): \WP_REST_Response {
        $params = (array) $req->get_params();
        $key    = Cache::key('timeline', $params);
        $ttl    = Cache::ttl_for_range($params['to'] ?? date('Y-m-d'));
        $data   = Cache::remember($key, $ttl, function () use ($req) {
            global $wpdb;
            ['from' => $from, 'to' => $to] = self::get_range($req);
            $t    = self::table('hits');
            // MySQL DAYOFWEEK() : 1=dimanche … 7=samedi → -1 → 0=dim … 6=sam
            $rows = $wpdb->get_results($wpdb->prepare(
                "SELECT
                    HOUR(timestamp)          AS hour,
                    DAYOFWEEK(timestamp) - 1 AS weekday,
                    COUNT(*)                 AS hits
                 FROM `$t`
                 WHERE timestamp BETWEEN %s AND %s
                 GROUP BY hour, weekday
                 ORDER BY weekday, hour",
                $from, $to
            ), ARRAY_A) ?: [];
            return array_map(fn($r) => [
                'hour'    => str_pad((string)(int)$r['hour'], 2, '0', STR_PAD_LEFT),
                'weekday' => (string)(int)$r['weekday'],
                'hits'    => (int)$r['hits'],
            ], $rows);
        });
        return rest_ensure_response($data);
    }

    public static function get_ips(\WP_REST_Request $req): \WP_REST_Response {
        $req_params = (array) $req->get_params();
        $key    = Cache::key('network-ips', $req_params);
        $ttl    = Cache::ttl_for_range($req_params['to'] ?? date('Y-m-d'));
        $result = Cache::remember($key, $ttl, fn() => self::compute_ips($req));
        return rest_ensure_response($result);
    }

    private static function compute_ips(\WP_REST_Request $req): array {
        global $wpdb;
        ['from' => $from, 'to' => $to] = self::get_range($req);
        $t      = self::table('hits');
        $limit  = min((int)($req->get_param('limit') ?: 50), 500);
        $offset = (int)($req->get_param('offset') ?: 0);
        $search = sanitize_text_field($req->get_param('search') ?: '');
        $bot    = $req->get_param('bot');

        $where  = 'WHERE h.timestamp BETWEEN %s AND %s';
        $params = [$from, $to];

        if ($bot !== null && $bot !== '') {
            $where   .= ' AND h.is_bot = ' . ($bot === '1' ? '1' : '0');
        }
        if ($search) {
            $where   .= ' AND h.ip LIKE %s';
            $params[] = '%' . $wpdb->esc_like($search) . '%';
        }

        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT
                h.ip,
                COUNT(*) AS hits,
                SUM(CASE WHEN h.is_bot = 1 THEN 1 ELSE 0 END) AS bot_hits,
                SUM(CASE WHEN h.is_bot = 0 THEN 1 ELSE 0 END) AS human_hits,
                SUM(CASE WHEN h.status_code BETWEEN 200 AND 299 THEN 1 ELSE 0 END) AS s2xx,
                SUM(CASE WHEN h.status_code BETWEEN 300 AND 399 THEN 1 ELSE 0 END) AS s3xx,
                SUM(CASE WHEN h.status_code BETWEEN 400 AND 499 THEN 1 ELSE 0 END) AS s4xx,
                SUM(CASE WHEN h.status_code BETWEEN 500 AND 599 THEN 1 ELSE 0 END) AS s5xx,
                MAX(h.timestamp) AS last_seen,
                MAX(CASE WHEN h.is_bot = 1 THEN h.bot_name END) AS bot_name,
                MAX(CASE WHEN b.ip IS NOT NULL THEN 1 ELSE 0 END) AS is_blocked
            FROM `$t` h
            LEFT JOIN `{$wpdb->prefix}spiderlens_blocklist` b ON b.ip = h.ip
            $where
            GROUP BY h.ip
            ORDER BY hits DESC
            LIMIT %d OFFSET %d",
            array_merge($params, [$limit, $offset])
        ), ARRAY_A);

        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $total = (int)$wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(DISTINCT ip) FROM `$t` $where",
            $params
        ));

        return ['rows' => $rows ?: [], 'total' => $total];
    }

    public static function get_ip_urls(\WP_REST_Request $req): \WP_REST_Response {
        global $wpdb;
        ['from' => $from, 'to' => $to] = self::get_range($req);
        $t  = self::table('hits');
        $ip = sanitize_text_field(urldecode($req->get_param('ip')));

        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT url, status_code, COUNT(*) AS hits, MAX(timestamp) AS last_seen
            FROM `$t`
            WHERE ip = %s AND timestamp BETWEEN %s AND %s
            GROUP BY url, status_code
            ORDER BY hits DESC
            LIMIT 50",
            $ip, $from, $to
        ), ARRAY_A);

        return rest_ensure_response($rows);
    }

    public static function get_user_agents(\WP_REST_Request $req): \WP_REST_Response {
        $req_params = (array) $req->get_params();
        $key    = Cache::key('network-ua', $req_params);
        $ttl    = Cache::ttl_for_range($req_params['to'] ?? date('Y-m-d'));
        $result = Cache::remember($key, $ttl, function () use ($req) {
            global $wpdb;
            ['from' => $from, 'to' => $to] = self::get_range($req);
            $t      = self::table('hits');
            $limit  = min((int)($req->get_param('limit') ?: 50), 500);
            $offset = (int)($req->get_param('offset') ?: 0);
            $search = sanitize_text_field($req->get_param('search') ?: '');
            $bot    = $req->get_param('bot');

            $where  = 'WHERE timestamp BETWEEN %s AND %s AND user_agent IS NOT NULL';
            $params = [$from, $to];

            if ($bot !== null && $bot !== '') {
                $where .= ' AND is_bot = ' . ($bot === '1' ? '1' : '0');
            }
            if ($search) {
                $where   .= ' AND user_agent LIKE %s';
                $params[] = '%' . $wpdb->esc_like($search) . '%';
            }

            // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
            $rows = $wpdb->get_results($wpdb->prepare(
                "SELECT user_agent, is_bot, MAX(bot_name) AS bot_name, COUNT(*) AS hits, MAX(timestamp) AS last_seen
                FROM `$t` $where
                GROUP BY user_agent, is_bot
                ORDER BY hits DESC
                LIMIT %d OFFSET %d",
                array_merge($params, [$limit, $offset])
            ), ARRAY_A);

            // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
            $total = (int)$wpdb->get_var($wpdb->prepare(
                "SELECT COUNT(DISTINCT user_agent) FROM `$t` $where",
                $params
            ));

            return ['rows' => $rows ?: [], 'total' => $total];
        });
        return rest_ensure_response($result);
    }

    public static function get_anomalies(\WP_REST_Request $req): \WP_REST_Response {
        global $wpdb;
        $t      = self::table('anomalies');
        $limit  = min((int)($req->get_param('limit') ?: 50), 200);
        $offset = (int)($req->get_param('offset') ?: 0);
        $type   = sanitize_text_field($req->get_param('type') ?: '');

        $where  = $type ? $wpdb->prepare('WHERE type = %s', $type) : '';

        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT * FROM `$t` $where ORDER BY detected_at DESC LIMIT %d OFFSET %d",
            $limit, $offset
        ), ARRAY_A);

        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $total = (int)$wpdb->get_var("SELECT COUNT(*) FROM `$t` $where");

        return rest_ensure_response(['rows' => $rows, 'total' => $total]);
    }

    public static function get_anomalies_recent(): \WP_REST_Response {
        global $wpdb;
        $t    = self::table('anomalies');
        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT * FROM `$t` WHERE detected_at >= %s ORDER BY detected_at DESC LIMIT 10",
            date('Y-m-d H:i:s', strtotime('-48 hours'))
        ), ARRAY_A);
        return rest_ensure_response($rows);
    }

    public static function get_blocklist(\WP_REST_Request $req): \WP_REST_Response {
        global $wpdb;
        $t      = self::table('blocklist');
        $limit  = min((int)($req->get_param('limit') ?: 100), 1000);
        $offset = (int)($req->get_param('offset') ?: 0);
        $search = sanitize_text_field($req->get_param('search') ?: '');

        $where  = $search ? $wpdb->prepare('WHERE ip LIKE %s', '%' . $wpdb->esc_like($search) . '%') : '';

        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $rows  = $wpdb->get_results($wpdb->prepare(
            "SELECT * FROM `$t` $where ORDER BY blocked_at DESC LIMIT %d OFFSET %d",
            $limit, $offset
        ), ARRAY_A);

        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $total = (int)$wpdb->get_var("SELECT COUNT(*) FROM `$t` $where");

        return rest_ensure_response(['rows' => $rows, 'total' => $total]);
    }

    public static function add_blocklist(\WP_REST_Request $req): \WP_REST_Response {
        global $wpdb;
        $t      = self::table('blocklist');
        $ip     = sanitize_text_field($req->get_param('ip') ?: '');
        $reason = sanitize_text_field($req->get_param('reason') ?: '');

        if (!$ip || !filter_var($ip, FILTER_VALIDATE_IP)) {
            return new \WP_REST_Response(['error' => 'IP invalide'], 400);
        }

        $existing = $wpdb->get_var($wpdb->prepare("SELECT id FROM `$t` WHERE ip = %s", $ip));
        if ($existing) {
            return new \WP_REST_Response(['error' => 'IP déjà bloquée'], 409);
        }

        $user = wp_get_current_user();
        $wpdb->insert($t, [
            'ip'         => $ip,
            'reason'     => $reason ?: null,
            'blocked_by' => $user->user_login ?: 'admin',
        ]);

        return new \WP_REST_Response($wpdb->get_row($wpdb->prepare("SELECT * FROM `$t` WHERE ip = %s", $ip), ARRAY_A), 201);
    }

    public static function del_blocklist(\WP_REST_Request $req): \WP_REST_Response {
        global $wpdb;
        $t  = self::table('blocklist');
        $ip = sanitize_text_field(urldecode($req->get_param('ip')));

        $deleted = $wpdb->delete($t, ['ip' => $ip]);
        if (!$deleted) {
            return new \WP_REST_Response(['error' => 'IP non trouvée'], 404);
        }

        return rest_ensure_response(['success' => true]);
    }

    public static function export_blocklist(\WP_REST_Request $req): void {
        global $wpdb;
        $t      = self::table('blocklist');
        $format = $req->get_param('format');
        $rows   = $wpdb->get_results("SELECT ip, reason FROM `$t` ORDER BY blocked_at DESC", ARRAY_A);

        $date = date_i18n('d/m/Y H:i');

        if ($format === 'nginx') {
            $lines = [
                "# Spider-Lens — Blocklist IPs (nginx)",
                "# Généré le $date",
                "# " . count($rows) . " IP(s) bloquée(s)",
                '',
            ];
            foreach ($rows as $r) {
                $lines[] = 'deny ' . $r['ip'] . ';' . ($r['reason'] ? '  # ' . $r['reason'] : '');
            }
            $lines[] = '';
            $lines[] = '# include /etc/nginx/spider-lens-blocklist.conf;';
            header('Content-Type: text/plain; charset=utf-8');
            header('Content-Disposition: attachment; filename="spider-lens-blocklist.nginx.conf"');
        } else {
            $lines = [
                "# Spider-Lens — Blocklist IPs (Apache)",
                "# Généré le $date",
                "# " . count($rows) . " IP(s) bloquée(s)",
                '',
                '<RequireAll>',
                '  Require all granted',
            ];
            foreach ($rows as $r) {
                $lines[] = '  Require not ip ' . $r['ip'] . ($r['reason'] ? '  # ' . $r['reason'] : '');
            }
            $lines[] = '</RequireAll>';
            header('Content-Type: text/plain; charset=utf-8');
            header('Content-Disposition: attachment; filename="spider-lens-blocklist.apache.conf"');
        }

        echo implode("\n", $lines);
        exit;
    }

    public static function get_settings(): \WP_REST_Response {
        $settings = get_option('spider_lens_settings', []);
        // Ne jamais exposer les mots de passe en clair
        if (isset($settings['smtp_pass'])) $settings['smtp_pass'] = '';
        // Indiquer si la clé Gemini est configurée sans l'exposer
        $settings['gemini_api_key_set'] = !empty($settings['gemini_api_key']);
        if (isset($settings['gemini_api_key'])) $settings['gemini_api_key'] = '';
        return rest_ensure_response($settings);
    }

    public static function save_settings(\WP_REST_Request $req): \WP_REST_Response {
        $allowed = [
            'retention_days', 'exclude_logged_in', 'exclude_admin',
            'webhook_url', 'webhook_enabled',
            'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_secure',
            'alert_email', 'weekly_report_enabled',
            'gemini_api_key', 'gemini_model',
        ];

        $current = get_option('spider_lens_settings', []);

        foreach ($allowed as $key) {
            $val = $req->get_param($key);
            if ($val !== null) {
                // Ne pas écraser le mot de passe si champ vide
                if ($key === 'smtp_pass' && $val === '') continue;
                $current[$key] = sanitize_text_field((string)$val);
            }
        }

        update_option('spider_lens_settings', $current);
        return rest_ensure_response(['success' => true]);
    }

    public static function flush_now(): \WP_REST_Response {
        Collector::flush_buffer();
        return rest_ensure_response(['success' => true]);
    }

    // ── Exports CSV ──────────────────────────────────────────

    private static function send_csv(string $filename, array $headers, array $rows): void {
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="' . $filename . '"');
        $out = fopen('php://output', 'w');
        fputcsv($out, $headers);
        foreach ($rows as $row) {
            fputcsv($out, $row);
        }
        fclose($out);
        exit;
    }

    public static function get_url_detail(\WP_REST_Request $req): \WP_REST_Response {
        $req_params = (array) $req->get_params();
        $key = Cache::key('url-detail', $req_params);
        $ttl = Cache::ttl_for_range($req_params['to'] ?? date('Y-m-d'));
        $result = Cache::remember($key, $ttl, function () use ($req) {
            return self::compute_url_detail($req);
        });
        return rest_ensure_response($result);
    }

    private static function compute_url_detail(\WP_REST_Request $req): array {
        global $wpdb;
        ['from' => $from, 'to' => $to] = self::get_range($req);
        $t      = self::table('hits');
        $limit  = min((int)($req->get_param('limit') ?: 50), 500);
        $offset = (int)($req->get_param('offset') ?: 0);
        $search = sanitize_text_field($req->get_param('search') ?: '');
        $bot    = $req->get_param('bot');
        $status = sanitize_text_field($req->get_param('status') ?: '');
        $sort   = in_array($req->get_param('sort'), ['hits', 'url', 'status_code', 'last_seen', 'bot_hits', 'human_hits'], true)
                    ? $req->get_param('sort') : 'hits';
        $dir    = $req->get_param('dir') === 'asc' ? 'ASC' : 'DESC';

        $where  = 'WHERE timestamp BETWEEN %s AND %s';
        $params = [$from, $to];

        if ($status !== '') {
            if (strlen($status) === 3 && substr($status, -2) === 'xx') {
                $family = (int)substr($status, 0, 1);
                $where .= ' AND status_code BETWEEN ' . ($family * 100) . ' AND ' . ($family * 100 + 99);
            } elseif (is_numeric($status)) {
                $where   .= ' AND status_code = %d';
                $params[] = (int)$status;
            }
        }
        if ($bot !== null && $bot !== '') {
            $where .= ' AND is_bot = ' . ($bot === '1' ? '1' : '0');
        }
        if ($search) {
            $where   .= ' AND url LIKE %s';
            $params[] = '%' . $wpdb->esc_like($search) . '%';
        }

        $tr = self::table('url_rechecks');

        // MySQL 8+ : window function COUNT(*) OVER() retourne le total des groupes en une passe.
        // Fallback MySQL 5.7 : SQL_CALC_FOUND_ROWS + FOUND_ROWS() (déprécié 8.0.17 mais fonctionnel).
        if (self::mysql_supports_window_functions()) {
            // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
            $rows = $wpdb->get_results($wpdb->prepare(
                "SELECT h.url, h.status_code,
                    COUNT(*) AS hits,
                    SUM(CASE WHEN h.is_bot=0 THEN 1 ELSE 0 END) AS human_hits,
                    SUM(CASE WHEN h.is_bot=1 THEN 1 ELSE 0 END) AS bot_hits,
                    MAX(h.timestamp) AS last_seen,
                    COUNT(*) OVER() AS _total_groups,
                    CASE WHEN h.status_code = 404 THEN ur.status_code ELSE NULL END AS recheck_status,
                    CASE WHEN h.status_code = 404 THEN ur.final_url   ELSE NULL END AS recheck_final_url,
                    CASE WHEN h.status_code = 404 THEN ur.checked_at  ELSE NULL END AS recheck_checked_at
                FROM `$t` h
                LEFT JOIN `$tr` ur ON h.status_code = 404 AND ur.url_hash = SHA2(h.url, 256)
                $where
                GROUP BY h.url, h.status_code
                ORDER BY $sort $dir
                LIMIT %d OFFSET %d",
                array_merge($params, [$limit, $offset])
            ), ARRAY_A);

            $total = !empty($rows) ? (int)$rows[0]['_total_groups'] : 0;
            foreach ($rows as &$r) { unset($r['_total_groups']); }
            unset($r);
        } else {
            // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
            $rows = $wpdb->get_results($wpdb->prepare(
                "SELECT SQL_CALC_FOUND_ROWS h.url, h.status_code,
                    COUNT(*) AS hits,
                    SUM(CASE WHEN h.is_bot=0 THEN 1 ELSE 0 END) AS human_hits,
                    SUM(CASE WHEN h.is_bot=1 THEN 1 ELSE 0 END) AS bot_hits,
                    MAX(h.timestamp) AS last_seen,
                    CASE WHEN h.status_code = 404 THEN ur.status_code ELSE NULL END AS recheck_status,
                    CASE WHEN h.status_code = 404 THEN ur.final_url   ELSE NULL END AS recheck_final_url,
                    CASE WHEN h.status_code = 404 THEN ur.checked_at  ELSE NULL END AS recheck_checked_at
                FROM `$t` h
                LEFT JOIN `$tr` ur ON h.status_code = 404 AND ur.url_hash = SHA2(h.url, 256)
                $where
                GROUP BY h.url, h.status_code
                ORDER BY $sort $dir
                LIMIT %d OFFSET %d",
                array_merge($params, [$limit, $offset])
            ), ARRAY_A);

            $total = (int)$wpdb->get_var('SELECT FOUND_ROWS()');
        }

        return ['rows' => $rows ?: [], 'total' => $total];
    }

    /**
     * Détecte si MySQL >= 8.0 (window functions supportées).
     * Résultat mis en cache statique — appelé 1 fois par requête PHP.
     */
    private static function mysql_supports_window_functions(): bool {
        static $cache = null;
        if ($cache !== null) return $cache;
        global $wpdb;
        $cache = version_compare($wpdb->db_version(), '8.0', '>=');
        return $cache;
    }

    public static function export_url_detail(\WP_REST_Request $req): void {
        global $wpdb;
        ['from' => $from, 'to' => $to] = self::get_range($req);
        $t      = self::table('hits');
        $status = sanitize_text_field($req->get_param('status') ?: '');
        $bot    = $req->get_param('bot');

        $where  = 'WHERE timestamp BETWEEN %s AND %s';
        $params = [$from, $to];

        if ($status !== '') {
            if (strlen($status) === 3 && substr($status, -2) === 'xx') {
                $family = (int)substr($status, 0, 1);
                $where .= ' AND status_code BETWEEN ' . ($family * 100) . ' AND ' . ($family * 100 + 99);
            } elseif (is_numeric($status)) {
                $where   .= ' AND status_code = %d';
                $params[] = (int)$status;
            }
        }
        if ($bot !== null && $bot !== '') {
            $where .= ' AND is_bot = ' . ($bot === '1' ? '1' : '0');
        }

        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT url, status_code, COUNT(*) AS hits,
                SUM(CASE WHEN is_bot=0 THEN 1 ELSE 0 END) AS human_hits,
                SUM(CASE WHEN is_bot=1 THEN 1 ELSE 0 END) AS bot_hits,
                MAX(timestamp) AS last_seen
            FROM `$t` $where
            GROUP BY url, status_code ORDER BY hits DESC LIMIT 5000",
            $params
        ), ARRAY_A);

        self::send_csv("spider-lens-url-detail-{$from}-{$to}.csv",
            ['URL', 'Status', 'Hits', 'Human Hits', 'Bot Hits', 'Last Seen'],
            array_map(fn($r) => [$r['url'], $r['status_code'], $r['hits'], $r['human_hits'], $r['bot_hits'], $r['last_seen']], $rows)
        );
    }

    public static function export_http_codes(\WP_REST_Request $req): void {
        global $wpdb;
        ['from' => $from, 'to' => $to] = self::get_range($req);
        $t = self::table('hits');
        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT DATE(timestamp) AS day,
                SUM(CASE WHEN status_code BETWEEN 200 AND 299 THEN 1 ELSE 0 END) AS s2xx,
                SUM(CASE WHEN status_code BETWEEN 300 AND 399 THEN 1 ELSE 0 END) AS s3xx,
                SUM(CASE WHEN status_code BETWEEN 400 AND 499 THEN 1 ELSE 0 END) AS s4xx,
                SUM(CASE WHEN status_code BETWEEN 500 AND 599 THEN 1 ELSE 0 END) AS s5xx
            FROM `$t` WHERE timestamp BETWEEN %s AND %s
            GROUP BY DATE(timestamp) ORDER BY day ASC",
            $from, $to
        ), ARRAY_A);
        self::send_csv("spider-lens-http-codes-{$from}-{$to}.csv", ['Day', '2xx', '3xx', '4xx', '5xx'], array_map(fn($r) => [$r['day'], $r['s2xx'], $r['s3xx'], $r['s4xx'], $r['s5xx']], $rows));
    }

    public static function export_bots(\WP_REST_Request $req): void {
        global $wpdb;
        ['from' => $from, 'to' => $to] = self::get_range($req);
        $t = self::table('hits');
        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT bot_name AS name, COUNT(*) AS hits, MAX(timestamp) AS last_seen
            FROM `$t` WHERE timestamp BETWEEN %s AND %s AND is_bot = 1 AND bot_name IS NOT NULL
            GROUP BY bot_name ORDER BY hits DESC",
            $from, $to
        ), ARRAY_A);
        self::send_csv("spider-lens-bots-{$from}-{$to}.csv", ['Bot', 'Hits', 'Last Seen'], array_map(fn($r) => [$r['name'], $r['hits'], $r['last_seen']], $rows));
    }

    public static function export_top_pages(\WP_REST_Request $req): void {
        global $wpdb;
        ['from' => $from, 'to' => $to] = self::get_range($req);
        $t = self::table('hits');
        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT url, COUNT(*) AS hits, SUM(CASE WHEN is_bot=0 THEN 1 ELSE 0 END) AS human_hits, SUM(CASE WHEN is_bot=1 THEN 1 ELSE 0 END) AS bot_hits, MAX(timestamp) AS last_seen
            FROM `$t` WHERE timestamp BETWEEN %s AND %s AND status_code = 200
            GROUP BY url ORDER BY hits DESC LIMIT 500",
            $from, $to
        ), ARRAY_A);
        self::send_csv("spider-lens-top-pages-{$from}-{$to}.csv", ['URL', 'Hits', 'Humans', 'Bots', 'Last Seen'], array_map(fn($r) => [$r['url'], $r['hits'], $r['human_hits'], $r['bot_hits'], $r['last_seen']], $rows));
    }

    public static function export_top_404(\WP_REST_Request $req): void {
        global $wpdb;
        ['from' => $from, 'to' => $to] = self::get_range($req);
        $t = self::table('hits');
        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT url, COUNT(*) AS hits, SUM(CASE WHEN is_bot=0 THEN 1 ELSE 0 END) AS human_hits, SUM(CASE WHEN is_bot=1 THEN 1 ELSE 0 END) AS bot_hits, MAX(timestamp) AS last_seen
            FROM `$t` WHERE timestamp BETWEEN %s AND %s AND status_code = 404
            GROUP BY url ORDER BY hits DESC LIMIT 500",
            $from, $to
        ), ARRAY_A);
        self::send_csv("spider-lens-404-{$from}-{$to}.csv", ['URL', 'Hits', 'Humans', 'Bots', 'Last Seen'], array_map(fn($r) => [$r['url'], $r['hits'], $r['human_hits'], $r['bot_hits'], $r['last_seen']], $rows));
    }

    public static function export_ttfb(\WP_REST_Request $req): void {
        global $wpdb;
        ['from' => $from, 'to' => $to] = self::get_range($req);
        $t = self::table('hits');
        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT DATE(timestamp) AS day, ROUND(AVG(response_time)) AS avg_ms, MIN(response_time) AS min_ms, MAX(response_time) AS max_ms, COUNT(*) AS total
            FROM `$t` WHERE timestamp BETWEEN %s AND %s AND response_time IS NOT NULL AND is_bot = 0
            GROUP BY DATE(timestamp) ORDER BY day ASC",
            $from, $to
        ), ARRAY_A);
        self::send_csv("spider-lens-ttfb-{$from}-{$to}.csv", ['Day', 'Avg (ms)', 'Min (ms)', 'Max (ms)', 'Requests'], array_map(fn($r) => [$r['day'], $r['avg_ms'], $r['min_ms'], $r['max_ms'], $r['total']], $rows));
    }

    public static function export_ips(\WP_REST_Request $req): void {
        global $wpdb;
        ['from' => $from, 'to' => $to] = self::get_range($req);
        $t = self::table('hits');
        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT ip, COUNT(*) AS hits, SUM(CASE WHEN is_bot=1 THEN 1 ELSE 0 END) AS bot_hits, SUM(CASE WHEN is_bot=0 THEN 1 ELSE 0 END) AS human_hits, MAX(timestamp) AS last_seen
            FROM `$t` WHERE timestamp BETWEEN %s AND %s
            GROUP BY ip ORDER BY hits DESC LIMIT 500",
            $from, $to
        ), ARRAY_A);
        self::send_csv("spider-lens-ips-{$from}-{$to}.csv", ['IP', 'Hits', 'Bot Hits', 'Human Hits', 'Last Seen'], array_map(fn($r) => [$r['ip'], $r['hits'], $r['bot_hits'], $r['human_hits'], $r['last_seen']], $rows));
    }

    public static function export_user_agents(\WP_REST_Request $req): void {
        global $wpdb;
        ['from' => $from, 'to' => $to] = self::get_range($req);
        $t = self::table('hits');
        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT user_agent, is_bot, MAX(bot_name) AS bot_name, COUNT(*) AS hits, MAX(timestamp) AS last_seen
            FROM `$t` WHERE timestamp BETWEEN %s AND %s AND user_agent IS NOT NULL
            GROUP BY user_agent, is_bot ORDER BY hits DESC LIMIT 500",
            $from, $to
        ), ARRAY_A);
        self::send_csv("spider-lens-user-agents-{$from}-{$to}.csv", ['User Agent', 'Is Bot', 'Bot Name', 'Hits', 'Last Seen'], array_map(fn($r) => [$r['user_agent'], $r['is_bot'] ? 'Yes' : 'No', $r['bot_name'] ?? '', $r['hits'], $r['last_seen']], $rows));
    }

    public static function test_webhook(\WP_REST_Request $req): \WP_REST_Response {
        $settings = get_option('spider_lens_settings', []);
        $url = sanitize_text_field($req->get_param('webhook_url') ?: ($settings['webhook_url'] ?? ''));

        if (empty($url)) {
            return rest_ensure_response(['success' => false, 'message' => 'No webhook URL configured.']);
        }

        $payload = json_encode([
            'embeds' => [[
                'title'       => '✅ Spider-Lens — Test Webhook',
                'description' => 'This is a test notification from your Spider-Lens WordPress plugin.',
                'color'       => 3066993,
            ]],
        ]);

        $response = wp_remote_post($url, [
            'headers' => ['Content-Type' => 'application/json'],
            'body'    => $payload,
            'timeout' => 10,
        ]);

        if (is_wp_error($response)) {
            return rest_ensure_response(['success' => false, 'message' => $response->get_error_message()]);
        }

        $code = wp_remote_retrieve_response_code($response);
        if ($code >= 200 && $code < 300) {
            return rest_ensure_response(['success' => true]);
        }

        return rest_ensure_response(['success' => false, 'message' => "Webhook returned HTTP $code"]);
    }

    // ══════════════════════════════════════════════════════════════
    // Crawler SEO on-page
    // ══════════════════════════════════════════════════════════════

    public static function get_sitemaps(\WP_REST_Request $req): \WP_REST_Response {
        global $wpdb;
        $rows = $wpdb->get_results(
            "SELECT id, url, created_at FROM {$wpdb->prefix}spiderlens_sitemaps ORDER BY id ASC",
            ARRAY_A
        );
        return rest_ensure_response($rows ?: []);
    }

    public static function add_sitemap(\WP_REST_Request $req): \WP_REST_Response|\WP_Error {
        global $wpdb;
        $url = sanitize_url(trim($req->get_param('url') ?? ''));

        if (empty($url) || !filter_var($url, FILTER_VALIDATE_URL)) {
            return new \WP_Error('invalid_url', 'URL invalide.', ['status' => 400]);
        }

        $wpdb->insert(
            "{$wpdb->prefix}spiderlens_sitemaps",
            ['url' => $url, 'created_at' => current_time('mysql')]
        );

        if ($wpdb->last_error) {
            return new \WP_Error('db_error', 'Erreur lors de l\'ajout.', ['status' => 500]);
        }

        return rest_ensure_response([
            'id'         => (int) $wpdb->insert_id,
            'url'        => $url,
            'created_at' => current_time('mysql'),
        ]);
    }

    public static function delete_sitemap(\WP_REST_Request $req): \WP_REST_Response|\WP_Error {
        global $wpdb;
        $id = (int) $req->get_param('id');
        $deleted = $wpdb->delete("{$wpdb->prefix}spiderlens_sitemaps", ['id' => $id]);

        if (!$deleted) {
            return new \WP_Error('not_found', 'Sitemap introuvable.', ['status' => 404]);
        }

        return rest_ensure_response(['success' => true]);
    }

    public static function start_crawl(\WP_REST_Request $req): \WP_REST_Response|\WP_Error {
        $result = Crawler::start_crawl();

        if (is_wp_error($result)) {
            return new \WP_Error($result->get_error_code(), $result->get_error_message(), ['status' => 409]);
        }

        return rest_ensure_response(['runId' => $result, 'status' => 'running']);
    }

    public static function cancel_crawl(\WP_REST_Request $req): \WP_REST_Response {
        Crawler::cancel_crawl();
        return rest_ensure_response(['success' => true]);
    }

    public static function get_crawl_status(\WP_REST_Request $req): \WP_REST_Response {
        return rest_ensure_response(Crawler::get_status());
    }

    public static function get_crawl_runs(\WP_REST_Request $req): \WP_REST_Response {
        return rest_ensure_response(Crawler::get_runs());
    }

    public static function get_crawl_pages(\WP_REST_Request $req): \WP_REST_Response {
        $filter = sanitize_text_field($req->get_param('filter') ?? '');
        $limit  = max(1, min(200, (int) ($req->get_param('limit') ?? 50)));
        $page   = max(1, (int) ($req->get_param('page') ?? 1));
        $offset = ($page - 1) * $limit;

        return rest_ensure_response(Crawler::get_pages($filter, $limit, $offset));
    }

    public static function get_crawl_summary(\WP_REST_Request $req): \WP_REST_Response {
        return rest_ensure_response(Crawler::get_summary());
    }

    // ══════════════════════════════════════════════════════════════
    // Assistant IA
    // ══════════════════════════════════════════════════════════════

    public static function ai_analyze(\WP_REST_Request $req): \WP_REST_Response|\WP_Error {
        $language = sanitize_text_field($req->get_param('language') ?? 'fr');
        $result   = AiAnalyzer::analyze_structured($language);

        if (is_wp_error($result)) {
            return $result;
        }

        return rest_ensure_response($result);
    }

    public static function ai_chat(\WP_REST_Request $req): \WP_REST_Response|\WP_Error {
        $messages     = $req->get_param('messages') ?? [];
        $page_context = $req->get_param('pageContext') ?? null;

        if (!is_array($messages) || empty($messages)) {
            return new \WP_Error('invalid_messages', 'Messages requis.', ['status' => 400]);
        }

        $result = AiAnalyzer::chat($messages, $page_context);

        if (is_wp_error($result)) {
            return $result;
        }

        return rest_ensure_response(['reply' => $result]);
    }

    /**
     * Chat streaming SSE — envoie les chunks Gemini au fil de l'eau.
     * Court-circuite le système de réponse WP REST pour émettre du text/event-stream.
     */
    public static function ai_chat_stream(\WP_REST_Request $req): void {
        $messages     = $req->get_param('messages') ?? [];
        $page_context = $req->get_param('pageContext') ?? null;

        if (!is_array($messages) || empty($messages)) {
            header('Content-Type: text/event-stream');
            echo "data: " . wp_json_encode(['error' => 'Messages requis.']) . "\n\n";
            flush();
            exit;
        }

        AiAnalyzer::chat_stream($messages, $page_context);
        exit;
    }

    // ── Re-check URL ─────────────────────────────────────────

    /**
     * POST /spider-lens/v1/crawler/recheck-url
     * Body JSON : { "url": "/path/to/page" }
     * Vérifie le statut HTTP actuel de l'URL et persiste le résultat.
     */
    public static function recheck_url(\WP_REST_Request $req): \WP_REST_Response|\WP_Error {
        global $wpdb;

        $url = sanitize_text_field($req->get_param('url') ?: '');
        if (empty($url)) {
            return new \WP_Error('missing_url', 'Le paramètre url est requis.', ['status' => 400]);
        }

        // Construire l'URL absolue
        $base     = rtrim(get_site_url(), '/');
        $path     = '/' . ltrim($url, '/');
        $full_url = $base . $path;

        $result = Crawler::recheck_url($full_url);

        $tr       = self::table('url_rechecks');
        $url_hash = hash('sha256', $url); // Équivalent PHP de SHA2(url, 256)
        $now      = current_time('mysql');

        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $wpdb->query($wpdb->prepare(
            "INSERT INTO `$tr` (url, url_hash, status_code, final_url, checked_at)
             VALUES (%s, %s, %d, %s, %s)
             ON DUPLICATE KEY UPDATE
               status_code = VALUES(status_code),
               final_url   = VALUES(final_url),
               checked_at  = VALUES(checked_at)",
            $url,
            $url_hash,
            $result['status'],
            $result['final_url'],
            $now
        ));

        return rest_ensure_response([
            'status'    => $result['status'],
            'finalUrl'  => $result['final_url'],
            'checkedAt' => $now,
        ]);
    }
}
