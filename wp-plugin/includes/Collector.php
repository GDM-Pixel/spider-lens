<?php
namespace SpiderLens;

defined('ABSPATH') || exit;

/**
 * Collecte les données de chaque requête via le hook shutdown.
 *
 * Stratégie buffer :
 * - Chaque hit est stocké dans un transient WP (liste JSON, max BUFFER_SIZE entrées).
 * - Un cron WP (toutes les minutes) flush le buffer en un seul INSERT batch vers MySQL.
 * - Si le buffer atteint BUFFER_SIZE avant le cron, il se flush immédiatement.
 *
 * Cela réduit drastiquement le nombre d'écritures MySQL sur mutualisé.
 */
class Collector {

    const BUFFER_OPTION  = 'spider_lens_hit_buffer';
    const BUFFER_SIZE    = 50;   // flush au-delà de N hits en attente
    const CRON_HOOK      = 'spider_lens_flush_buffer';

    public static function init(): void {
        add_action('shutdown', [self::class, 'capture'], 999);
        add_action(self::CRON_HOOK, [self::class, 'flush_buffer']);
    }

    /**
     * Capture la requête courante et l'ajoute au buffer.
     * Appelé sur shutdown (après que WP a envoyé la réponse).
     */
    public static function capture(): void {
        // Filtre URL immédiat — avant tout bootstrap WP (le plus fiable)
        $uri = isset($_SERVER['REQUEST_URI']) ? wp_unslash($_SERVER['REQUEST_URI']) : '/';
        if (BotDetector::should_skip_url($uri)) return;

        // Ignorer tout le trafic backend WP (admin, ajax, cron, REST, wp-login, xmlrpc)
        if (is_admin()) return;
        if (wp_doing_ajax()) return;
        if (wp_doing_cron()) return;
        if (defined('REST_REQUEST') && REST_REQUEST) return;

        // Appliquer les options d'exclusion
        $settings = get_option('spider_lens_settings', []);
        if (!empty($settings['exclude_logged_in']) && $settings['exclude_logged_in'] === '1' && is_user_logged_in()) return;
        if (!empty($settings['exclude_admin']) && $settings['exclude_admin'] === '1' && current_user_can('manage_options')) return;

        $url = esc_url_raw($uri);

        $user_agent = isset($_SERVER['HTTP_USER_AGENT']) ? sanitize_text_field(wp_unslash($_SERVER['HTTP_USER_AGENT'])) : '';
        $ip         = self::get_client_ip();
        $bot        = BotDetector::detect($user_agent);
        $status     = http_response_code() ?: 200;
        $referer    = isset($_SERVER['HTTP_REFERER']) ? esc_url_raw(wp_unslash($_SERVER['HTTP_REFERER'])) : null;
        $method     = isset($_SERVER['REQUEST_METHOD']) ? sanitize_text_field(wp_unslash($_SERVER['REQUEST_METHOD'])) : 'GET';

        // Temps de réponse en ms
        $response_time = null;
        if (isset($_SERVER['REQUEST_TIME_FLOAT'])) {
            $response_time = (int) round((microtime(true) - (float) $_SERVER['REQUEST_TIME_FLOAT']) * 1000);
        }

        // Contexte WP
        $post_id   = null;
        $post_type = null;
        if (function_exists('get_the_ID')) {
            $pid = get_the_ID();
            if ($pid) {
                $post_id   = $pid;
                $post_type = get_post_type($pid) ?: null;
            }
        }

        // GeoIP : Cloudflare fournit le code pays via header (zero overhead)
        $country_code = null;
        if (!empty($_SERVER['HTTP_CF_IPCOUNTRY'])) {
            $cc = strtoupper(sanitize_text_field(wp_unslash($_SERVER['HTTP_CF_IPCOUNTRY'])));
            if (strlen($cc) === 2 && $cc !== 'XX' && $cc !== 'T1') {
                $country_code = $cc;
            }
        }

        $hit = [
            'timestamp'     => current_time('mysql'),
            'ip'            => $ip,
            'url'           => $url,
            'method'        => $method,
            'status_code'   => $status,
            'user_agent'    => $user_agent ?: null,
            'referer'       => $referer ?: null,
            'response_time' => $response_time,
            'is_bot'        => $bot['is_bot'] ? 1 : 0,
            'bot_name'      => $bot['bot_name'],
            'post_id'       => $post_id,
            'post_type'     => $post_type,
            'is_logged_in'  => is_user_logged_in() ? 1 : 0,
            'country_code'  => $country_code,
        ];

        self::push_to_buffer($hit);
    }

    /**
     * Ajoute un hit au buffer en mémoire partagée (option WP).
     * Si le buffer dépasse BUFFER_SIZE, flush immédiatement.
     */
    private static function push_to_buffer(array $hit): void {
        // On utilise une option autoloaded=no pour éviter de surcharger le cache d'options
        $buffer = get_option(self::BUFFER_OPTION, []);
        if (!is_array($buffer)) $buffer = [];

        $buffer[] = $hit;

        if (count($buffer) >= self::BUFFER_SIZE) {
            // Flush immédiat et vide le buffer
            delete_option(self::BUFFER_OPTION);
            self::insert_batch($buffer);
        } else {
            update_option(self::BUFFER_OPTION, $buffer, false);
        }
    }

    /**
     * Flush le buffer : INSERT batch en MySQL.
     * Appelé par le cron toutes les minutes.
     */
    public static function flush_buffer(): void {
        $buffer = get_option(self::BUFFER_OPTION, []);
        if (empty($buffer) || !is_array($buffer)) return;

        delete_option(self::BUFFER_OPTION);
        self::insert_batch($buffer);
    }

    /**
     * INSERT multiple en une seule requête MySQL.
     */
    private static function insert_batch(array $hits): void {
        global $wpdb;
        if (empty($hits)) return;

        $table = $wpdb->prefix . 'spiderlens_hits';

        $placeholders = [];
        $values       = [];

        foreach ($hits as $h) {
            $placeholders[] = '(%s, %s, %s, %s, %d, %s, %s, %s, %d, %s, %s, %s, %d, %s)';
            $values[] = $h['timestamp'];
            $values[] = $h['ip'];
            $h['url'] = mb_substr($h['url'], 0, 2048);
            $values[] = $h['url'];
            $values[] = $h['method'];
            $values[] = $h['status_code'];
            $values[] = mb_substr((string)($h['user_agent'] ?? ''), 0, 512) ?: null;
            $values[] = mb_substr((string)($h['referer'] ?? ''), 0, 512) ?: null;
            $values[] = $h['response_time'] !== null ? (string)$h['response_time'] : null;
            $values[] = $h['is_bot'];
            $values[] = $h['bot_name'];
            $values[] = $h['post_id'] !== null ? (string)$h['post_id'] : null;
            $values[] = $h['post_type'];
            $values[] = $h['is_logged_in'];
            $values[] = $h['country_code'] ?? null;
        }

        $sql = "INSERT INTO `$table`
            (timestamp, ip, url, method, status_code, user_agent, referer, response_time, is_bot, bot_name, post_id, post_type, is_logged_in, country_code)
            VALUES " . implode(', ', $placeholders);

        // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
        $wpdb->query($wpdb->prepare($sql, $values));
    }

    /**
     * Récupère l'IP client en tenant compte des proxies courants.
     */
    private static function get_client_ip(): string {
        $headers = [
            'HTTP_CF_CONNECTING_IP', // Cloudflare
            'HTTP_X_FORWARDED_FOR',
            'HTTP_X_REAL_IP',
            'REMOTE_ADDR',
        ];

        foreach ($headers as $header) {
            if (!empty($_SERVER[$header])) {
                $ip = sanitize_text_field(wp_unslash($_SERVER[$header]));
                // X-Forwarded-For peut contenir une liste
                if (strpos($ip, ',') !== false) {
                    $ip = trim(explode(',', $ip)[0]);
                }
                if (filter_var($ip, FILTER_VALIDATE_IP)) {
                    return $ip;
                }
            }
        }

        return '0.0.0.0';
    }

}
