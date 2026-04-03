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
        ['from' => $from, 'to' => $to] = self::get_range($req);
        $data = Database::get_overview($from, $to);
        $total = (int)($data['total'] ?? 0);
        $errors = (int)($data['s4xx'] ?? 0) + (int)($data['s5xx'] ?? 0);
        $data['errorRate'] = $total > 0 ? round(($errors / $total) * 100, 1) : 0;
        $data['avg_ttfb']  = $data['avg_ttfb'] ? round((float)$data['avg_ttfb']) : null;
        return rest_ensure_response($data);
    }

    public static function get_http_codes(\WP_REST_Request $req): \WP_REST_Response {
        global $wpdb;
        ['from' => $from, 'to' => $to] = self::get_range($req);
        $t = self::table('hits');

        $rows = $wpdb->get_results($wpdb->prepare(
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

        return rest_ensure_response($rows);
    }

    public static function get_top_pages(\WP_REST_Request $req): \WP_REST_Response {
        global $wpdb;
        ['from' => $from, 'to' => $to] = self::get_range($req);
        $t     = self::table('hits');
        $limit = (int) ($req->get_param('limit') ?: 50);
        $limit = min($limit, 500);

        $rows = $wpdb->get_results($wpdb->prepare(
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

        return rest_ensure_response($rows);
    }

    public static function get_top_404(\WP_REST_Request $req): \WP_REST_Response {
        global $wpdb;
        ['from' => $from, 'to' => $to] = self::get_range($req);
        $t     = self::table('hits');
        $limit = (int) ($req->get_param('limit') ?: 50);
        $limit = min($limit, 500);

        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT
                url,
                COUNT(*) AS hits,
                SUM(CASE WHEN is_bot = 0 THEN 1 ELSE 0 END) AS human_hits,
                SUM(CASE WHEN is_bot = 1 THEN 1 ELSE 0 END) AS bot_hits,
                MAX(timestamp) AS last_seen
            FROM `$t`
            WHERE timestamp BETWEEN %s AND %s AND status_code = 404
            GROUP BY url
            ORDER BY hits DESC
            LIMIT %d",
            $from, $to, $limit
        ), ARRAY_A);

        return rest_ensure_response($rows);
    }

    public static function get_bots(\WP_REST_Request $req): \WP_REST_Response {
        global $wpdb;
        ['from' => $from, 'to' => $to] = self::get_range($req);
        $t = self::table('hits');

        $rows = $wpdb->get_results($wpdb->prepare(
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

        return rest_ensure_response($rows);
    }

    public static function get_ttfb(\WP_REST_Request $req): \WP_REST_Response {
        global $wpdb;
        ['from' => $from, 'to' => $to] = self::get_range($req);
        $t = self::table('hits');

        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT
                DATE(timestamp)                   AS day,
                AVG(response_time)                AS avg_ttfb,
                MIN(response_time)                AS min_ttfb,
                MAX(response_time)                AS max_ttfb,
                COUNT(*)                          AS total
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

        return rest_ensure_response($rows);
    }

    public static function get_weekly_trends(\WP_REST_Request $req): \WP_REST_Response {
        global $wpdb;
        $t     = self::table('hits');
        $weeks = min((int)($req->get_param('weeks') ?: 12), 52);

        // Lundi de la semaine courante
        $now       = new \DateTime();
        $dow       = (int)$now->format('N'); // 1=lundi, 7=dimanche
        $monday    = clone $now;
        $monday->modify('-' . ($dow - 1) . ' days');
        $monday->setTime(0, 0, 0);

        $results = [];
        for ($i = $weeks - 1; $i >= 0; $i--) {
            $wStart = clone $monday;
            $wStart->modify("-{$i} weeks");
            $wEnd = clone $wStart;
            $wEnd->modify('+6 days')->setTime(23, 59, 59);

            $from = $wStart->format('Y-m-d H:i:s');
            $to   = $wEnd->format('Y-m-d H:i:s');

            $row = $wpdb->get_row($wpdb->prepare(
                "SELECT
                    COUNT(*) AS total,
                    SUM(CASE WHEN is_bot = 0 THEN 1 ELSE 0 END) AS humans,
                    SUM(CASE WHEN is_bot = 1 THEN 1 ELSE 0 END) AS bots,
                    SUM(CASE WHEN bot_name = 'Googlebot' THEN 1 ELSE 0 END) AS googlebot,
                    SUM(CASE WHEN status_code BETWEEN 400 AND 599 THEN 1 ELSE 0 END) AS errors,
                    AVG(CASE WHEN response_time IS NOT NULL AND is_bot = 0 THEN response_time END) AS avg_ttfb
                FROM `$t`
                WHERE timestamp BETWEEN %s AND %s",
                $from, $to
            ), ARRAY_A);

            $results[] = [
                'week'       => $wStart->format('Y-m-d'),
                'week_label' => $wStart->format('d/m'),
                'total'      => (int)($row['total'] ?? 0),
                'humans'     => (int)($row['humans'] ?? 0),
                'bots'       => (int)($row['bots'] ?? 0),
                'googlebot'  => (int)($row['googlebot'] ?? 0),
                'errors'     => (int)($row['errors'] ?? 0),
                'avg_ttfb'   => $row['avg_ttfb'] ? (int)round((float)$row['avg_ttfb']) : null,
            ];
        }

        return rest_ensure_response($results);
    }

    public static function get_ips(\WP_REST_Request $req): \WP_REST_Response {
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

        return rest_ensure_response(['rows' => $rows, 'total' => $total]);
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

        return rest_ensure_response(['rows' => $rows, 'total' => $total]);
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
        return rest_ensure_response($settings);
    }

    public static function save_settings(\WP_REST_Request $req): \WP_REST_Response {
        $allowed = [
            'retention_days', 'exclude_logged_in', 'exclude_admin',
            'webhook_url', 'webhook_enabled',
            'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_secure',
            'alert_email', 'weekly_report_enabled',
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
}
