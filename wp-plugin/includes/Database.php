<?php
namespace SpiderLens;

defined('ABSPATH') || exit;

class Database {

    const DB_VERSION = '1.1';
    const DB_VERSION_OPTION = 'spider_lens_db_version';

    public static function install(): void {
        global $wpdb;
        $charset = $wpdb->get_charset_collate();
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';

        // Table principale des hits
        $sql_hits = "CREATE TABLE IF NOT EXISTS {$wpdb->prefix}spiderlens_hits (
            id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            timestamp     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            ip            VARCHAR(45)     NOT NULL DEFAULT '',
            url           TEXT            NOT NULL,
            method        VARCHAR(10)     NOT NULL DEFAULT 'GET',
            status_code   SMALLINT        NOT NULL DEFAULT 200,
            user_agent    TEXT,
            referer       TEXT,
            response_time INT             DEFAULT NULL COMMENT 'ms',
            is_bot        TINYINT(1)      NOT NULL DEFAULT 0,
            bot_name      VARCHAR(100)    DEFAULT NULL,
            post_id       BIGINT UNSIGNED DEFAULT NULL,
            post_type     VARCHAR(50)     DEFAULT NULL,
            is_logged_in  TINYINT(1)      NOT NULL DEFAULT 0,
            PRIMARY KEY (id),
            KEY idx_timestamp  (timestamp),
            KEY idx_ip         (ip(20)),
            KEY idx_status     (status_code),
            KEY idx_is_bot     (is_bot),
            KEY idx_url        (url(255))
        ) $charset;";

        // Table anomalies
        $sql_anomalies = "CREATE TABLE IF NOT EXISTS {$wpdb->prefix}spiderlens_anomalies (
            id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            type        VARCHAR(50)  NOT NULL,
            severity    VARCHAR(20)  NOT NULL DEFAULT 'warning',
            observed    FLOAT        NOT NULL DEFAULT 0,
            baseline    FLOAT        NOT NULL DEFAULT 0,
            message     TEXT,
            detected_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_detected_at (detected_at),
            KEY idx_type        (type)
        ) $charset;";

        // Table blocklist
        $sql_blocklist = "CREATE TABLE IF NOT EXISTS {$wpdb->prefix}spiderlens_blocklist (
            id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            ip         VARCHAR(45)  NOT NULL,
            reason     VARCHAR(255) DEFAULT NULL,
            blocked_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            blocked_by VARCHAR(100) NOT NULL DEFAULT 'admin',
            PRIMARY KEY (id),
            UNIQUE KEY uq_ip (ip)
        ) $charset;";

        // Table sitemaps du crawler
        $sql_sitemaps = "CREATE TABLE IF NOT EXISTS {$wpdb->prefix}spiderlens_sitemaps (
            id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            url        TEXT            NOT NULL,
            created_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id)
        ) $charset;";

        // Table historique des crawls
        $sql_crawl_runs = "CREATE TABLE IF NOT EXISTS {$wpdb->prefix}spiderlens_crawl_runs (
            id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            status        VARCHAR(20)     NOT NULL DEFAULT 'idle',
            pages_found   INT             NOT NULL DEFAULT 0,
            pages_crawled INT             NOT NULL DEFAULT 0,
            started_at    DATETIME        DEFAULT NULL,
            finished_at   DATETIME        DEFAULT NULL,
            error         TEXT            DEFAULT NULL,
            PRIMARY KEY (id),
            KEY idx_status (status)
        ) $charset;";

        // Table pages crawlées (dernier crawl uniquement)
        $sql_crawl_pages = "CREATE TABLE IF NOT EXISTS {$wpdb->prefix}spiderlens_crawl_pages (
            id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            url         TEXT            NOT NULL,
            status_code INT             DEFAULT NULL,
            title       TEXT            DEFAULT NULL,
            h1          TEXT            DEFAULT NULL,
            word_count  INT             NOT NULL DEFAULT 0,
            canonical   TEXT            DEFAULT NULL,
            meta_robots VARCHAR(100)    DEFAULT NULL,
            depth       INT             NOT NULL DEFAULT 0,
            source      VARCHAR(20)     NOT NULL DEFAULT 'sitemap',
            crawled_at  DATETIME        DEFAULT NULL,
            error       TEXT            DEFAULT NULL,
            PRIMARY KEY (id),
            KEY idx_url (url(255))
        ) $charset;";

        dbDelta($sql_hits);
        dbDelta($sql_anomalies);
        dbDelta($sql_blocklist);
        dbDelta($sql_sitemaps);
        dbDelta($sql_crawl_runs);
        dbDelta($sql_crawl_pages);

        update_option(self::DB_VERSION_OPTION, self::DB_VERSION);
    }

    public static function maybe_upgrade(): void {
        $installed = get_option(self::DB_VERSION_OPTION, '0');
        if (version_compare($installed, self::DB_VERSION, '<')) {
            self::install();
        }
    }

    public static function uninstall(): void {
        global $wpdb;
        $wpdb->query("DROP TABLE IF EXISTS {$wpdb->prefix}spiderlens_hits");
        $wpdb->query("DROP TABLE IF EXISTS {$wpdb->prefix}spiderlens_anomalies");
        $wpdb->query("DROP TABLE IF EXISTS {$wpdb->prefix}spiderlens_blocklist");
        $wpdb->query("DROP TABLE IF EXISTS {$wpdb->prefix}spiderlens_sitemaps");
        $wpdb->query("DROP TABLE IF EXISTS {$wpdb->prefix}spiderlens_crawl_runs");
        $wpdb->query("DROP TABLE IF EXISTS {$wpdb->prefix}spiderlens_crawl_pages");
        delete_option(self::DB_VERSION_OPTION);
        delete_option('spider_lens_settings');
        delete_option('spider_lens_crawl_queue');
        delete_option('spider_lens_crawl_seen');
        wp_clear_scheduled_hook('spider_lens_flush_buffer');
        wp_clear_scheduled_hook('spider_lens_detect_anomalies');
        wp_clear_scheduled_hook('spider_lens_weekly_report');
        wp_clear_scheduled_hook('spider_lens_purge_old_hits');
        wp_clear_scheduled_hook('spider_lens_crawl_batch');
    }

    /**
     * Retourne le nombre total de hits sur la période
     */
    public static function get_overview(string $from, string $to): array {
        global $wpdb;
        $t = $wpdb->prefix . 'spiderlens_hits';

        return (array) $wpdb->get_row($wpdb->prepare(
            "SELECT
                COUNT(*)                                                         AS total,
                SUM(CASE WHEN is_bot = 0 THEN 1 ELSE 0 END)                    AS humans,
                SUM(CASE WHEN is_bot = 1 THEN 1 ELSE 0 END)                    AS bots,
                SUM(CASE WHEN status_code BETWEEN 200 AND 299 THEN 1 ELSE 0 END) AS s2xx,
                SUM(CASE WHEN status_code BETWEEN 300 AND 399 THEN 1 ELSE 0 END) AS s3xx,
                SUM(CASE WHEN status_code BETWEEN 400 AND 499 THEN 1 ELSE 0 END) AS s4xx,
                SUM(CASE WHEN status_code BETWEEN 500 AND 599 THEN 1 ELSE 0 END) AS s5xx,
                COUNT(DISTINCT CASE WHEN status_code = 404 THEN url END)         AS unique404,
                AVG(CASE WHEN response_time IS NOT NULL THEN response_time END)  AS avg_ttfb
            FROM `$t`
            WHERE timestamp BETWEEN %s AND %s",
            $from, $to
        ), ARRAY_A);
    }
}
