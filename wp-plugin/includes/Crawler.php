<?php
namespace SpiderLens;

defined('ABSPATH') || exit;

class Crawler {

    const BATCH_SIZE         = 10;
    const MAX_DEPTH          = 3;
    const MAX_PAGES          = 500;
    const FETCH_TIMEOUT      = 10;
    const MAX_BODY_BYTES     = 2097152; // 2 MB
    const CRAWLER_UA         = 'SpiderLens-Crawler/1.0';
    const MAX_CHILD_SITEMAPS = 10;

    // ---------------------------------------------------------------------------
    // Public API
    // ---------------------------------------------------------------------------

    /**
     * Lance un nouveau crawl.
     * Retourne le runId, ou lance une WP_Error si un crawl est déjà en cours.
     */
    public static function start_crawl(): int|\WP_Error {
        global $wpdb;
        $prefix = $wpdb->prefix;

        // Vérifier qu'aucun crawl n'est en cours
        $running = $wpdb->get_var(
            "SELECT id FROM {$prefix}spiderlens_crawl_runs WHERE status = 'running' LIMIT 1"
        );
        if ($running) {
            return new \WP_Error('crawl_already_running', 'Un crawl est déjà en cours.');
        }

        // Supprimer les pages du dernier crawl
        $wpdb->query("DELETE FROM {$prefix}spiderlens_crawl_pages");

        // Créer un nouveau run
        $wpdb->insert("{$prefix}spiderlens_crawl_runs", [
            'status'     => 'running',
            'started_at' => current_time('mysql'),
        ]);
        $run_id = (int) $wpdb->insert_id;

        // Parser les sitemaps et construire la queue initiale
        $seed_urls = self::parse_all_sitemaps();
        $queue     = [];
        $seen      = [];

        foreach ($seed_urls as $url) {
            $queue[] = ['url' => $url, 'depth' => 0, 'source' => 'sitemap'];
            $seen[]  = $url;
        }

        // Stocker la queue et le set "seen" dans les options WP
        update_option('spider_lens_crawl_queue', $queue, false);
        update_option('spider_lens_crawl_seen', $seen, false);
        update_option('spider_lens_crawl_run_id', $run_id, false);

        // Mettre à jour pages_found
        $wpdb->update(
            "{$prefix}spiderlens_crawl_runs",
            ['pages_found' => count($queue)],
            ['id' => $run_id]
        );

        // Scheduler le premier batch
        wp_schedule_single_event(time(), 'spider_lens_crawl_batch');

        return $run_id;
    }

    /**
     * Traite un batch de pages. Appelé par le hook WP_Cron.
     */
    public static function process_batch(): void {
        global $wpdb;
        $prefix = $wpdb->prefix;

        // Vérifier qu'un run est actif
        $run = $wpdb->get_row(
            "SELECT id, pages_crawled, pages_found FROM {$prefix}spiderlens_crawl_runs WHERE status = 'running' ORDER BY id DESC LIMIT 1",
            ARRAY_A
        );

        if (!$run) {
            // Aucun run actif — nettoyage au cas où
            delete_option('spider_lens_crawl_queue');
            delete_option('spider_lens_crawl_seen');
            delete_option('spider_lens_crawl_run_id');
            return;
        }

        $run_id        = (int) $run['id'];
        $pages_crawled = (int) $run['pages_crawled'];

        // Charger la queue et le seen depuis les options
        $queue = get_option('spider_lens_crawl_queue', []);
        $seen  = get_option('spider_lens_crawl_seen', []);

        if (empty($queue) || $pages_crawled >= self::MAX_PAGES) {
            self::finish_crawl($run_id, 'completed');
            return;
        }

        $base_host = wp_parse_url(home_url(), PHP_URL_HOST);
        $batch_count = min(self::BATCH_SIZE, count($queue));

        for ($i = 0; $i < $batch_count; $i++) {
            if (empty($queue) || $pages_crawled >= self::MAX_PAGES) {
                break;
            }

            $item  = array_shift($queue);
            $url   = $item['url'];
            $depth = (int) $item['depth'];
            $source = $item['source'];

            $page_data = self::fetch_and_parse($url);

            // Extraction des liens internes si c'est une page HTML et depth < MAX
            if (!empty($page_data['html']) && $depth < self::MAX_DEPTH) {
                $links = self::extract_internal_links($page_data['html'], $url, $base_host);
                foreach ($links as $link) {
                    if (!in_array($link, $seen, true) && count($seen) < self::MAX_PAGES * 2) {
                        $seen[]  = $link;
                        $queue[] = ['url' => $link, 'depth' => $depth + 1, 'source' => 'link'];
                    }
                }
            }
            unset($page_data['html']);

            // Insérer la page en DB
            $wpdb->insert("{$prefix}spiderlens_crawl_pages", array_merge($page_data, [
                'depth'      => $depth,
                'source'     => $source,
                'crawled_at' => current_time('mysql'),
            ]));

            $pages_crawled++;
        }

        // Mettre à jour le run
        $wpdb->update(
            "{$prefix}spiderlens_crawl_runs",
            [
                'pages_crawled' => $pages_crawled,
                'pages_found'   => count($queue) + $pages_crawled,
            ],
            ['id' => $run_id]
        );

        // Sauvegarder l'état
        update_option('spider_lens_crawl_queue', $queue, false);
        update_option('spider_lens_crawl_seen', $seen, false);

        // Continuer ou terminer
        if (!empty($queue) && $pages_crawled < self::MAX_PAGES) {
            wp_schedule_single_event(time() + 2, 'spider_lens_crawl_batch');
        } else {
            self::finish_crawl($run_id, 'completed');
        }
    }

    /**
     * Annule le crawl en cours.
     */
    public static function cancel_crawl(): void {
        global $wpdb;
        $prefix = $wpdb->prefix;

        $wpdb->query(
            "UPDATE {$prefix}spiderlens_crawl_runs
             SET status = 'cancelled', finished_at = '" . current_time('mysql') . "'
             WHERE status = 'running'"
        );

        wp_clear_scheduled_hook('spider_lens_crawl_batch');
        delete_option('spider_lens_crawl_queue');
        delete_option('spider_lens_crawl_seen');
        delete_option('spider_lens_crawl_run_id');
    }

    /**
     * Retourne le status du crawl courant ou du dernier run.
     */
    public static function get_status(): array {
        global $wpdb;
        $prefix = $wpdb->prefix;

        $run = $wpdb->get_row(
            "SELECT id, status, pages_found, pages_crawled, started_at, finished_at, error
             FROM {$prefix}spiderlens_crawl_runs
             ORDER BY id DESC LIMIT 1",
            ARRAY_A
        );

        if (!$run) {
            return ['status' => 'idle', 'pagesFound' => 0, 'pagesCrawled' => 0];
        }

        return [
            'status'        => $run['status'],
            'runId'         => (int) $run['id'],
            'pagesFound'    => (int) $run['pages_found'],
            'pagesCrawled'  => (int) $run['pages_crawled'],
            'startedAt'     => $run['started_at'],
            'finishedAt'    => $run['finished_at'],
            'error'         => $run['error'],
        ];
    }

    /**
     * Retourne les KPIs agrégés des pages crawlées.
     */
    public static function get_summary(): array {
        global $wpdb;
        $t = $wpdb->prefix . 'spiderlens_crawl_pages';

        $row = $wpdb->get_row("
            SELECT
                COUNT(*)                                                                     AS total,
                SUM(CASE WHEN (title IS NULL OR title = '')  THEN 1 ELSE 0 END)             AS missing_title,
                SUM(CASE WHEN (h1 IS NULL OR h1 = '')        THEN 1 ELSE 0 END)             AS missing_h1,
                SUM(CASE WHEN meta_robots LIKE '%noindex%'   THEN 1 ELSE 0 END)             AS noindex,
                SUM(CASE WHEN (error IS NOT NULL AND error != '') THEN 1 ELSE 0 END)        AS errors,
                SUM(CASE WHEN word_count > 0 AND word_count < 300 THEN 1 ELSE 0 END)        AS thin_content,
                MAX(crawled_at)                                                              AS last_crawl
            FROM `$t`
        ", ARRAY_A);

        return [
            'total'        => (int) ($row['total'] ?? 0),
            'missingTitle' => (int) ($row['missing_title'] ?? 0),
            'missingH1'    => (int) ($row['missing_h1'] ?? 0),
            'noindex'      => (int) ($row['noindex'] ?? 0),
            'errors'       => (int) ($row['errors'] ?? 0),
            'thinContent'  => (int) ($row['thin_content'] ?? 0),
            'lastCrawl'    => $row['last_crawl'] ?? null,
        ];
    }

    /**
     * Retourne les pages crawlées paginées avec filtre optionnel.
     * @param string $filter  missing_title|missing_h1|noindex|error|''
     * @param int    $limit
     * @param int    $offset
     */
    public static function get_pages(string $filter = '', int $limit = 50, int $offset = 0): array {
        global $wpdb;
        $t   = $wpdb->prefix . 'spiderlens_crawl_pages';
        $where = '1=1';

        switch ($filter) {
            case 'missing_title':
                $where = "(title IS NULL OR title = '')";
                break;
            case 'missing_h1':
                $where = "(h1 IS NULL OR h1 = '')";
                break;
            case 'noindex':
                $where = "meta_robots LIKE '%noindex%'";
                break;
            case 'error':
                $where = "(error IS NOT NULL AND error != '')";
                break;
        }

        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT id, url, status_code, title, h1, word_count, canonical, meta_robots, depth, source, crawled_at, error
             FROM `$t` WHERE $where ORDER BY id ASC LIMIT %d OFFSET %d",
            $limit, $offset
        ), ARRAY_A);

        $total = (int) $wpdb->get_var("SELECT COUNT(*) FROM `$t` WHERE $where");

        return ['rows' => $rows ?: [], 'total' => $total];
    }

    /**
     * Retourne les 10 derniers crawl_runs.
     */
    public static function get_runs(): array {
        global $wpdb;
        $t = $wpdb->prefix . 'spiderlens_crawl_runs';

        return $wpdb->get_results(
            "SELECT id, status, pages_found, pages_crawled, started_at, finished_at, error
             FROM `$t` ORDER BY id DESC LIMIT 10",
            ARRAY_A
        ) ?: [];
    }

    // ---------------------------------------------------------------------------
    // Sitemap parsing
    // ---------------------------------------------------------------------------

    /**
     * Parse tous les sitemaps configurés et retourne la liste d'URLs unique.
     */
    public static function parse_all_sitemaps(): array {
        global $wpdb;
        $sitemaps = $wpdb->get_col(
            "SELECT url FROM {$wpdb->prefix}spiderlens_sitemaps"
        );

        $all_urls = [];
        foreach ($sitemaps as $sitemap_url) {
            $urls     = self::parse_sitemap($sitemap_url, 0);
            $all_urls = array_merge($all_urls, $urls);
        }

        return array_values(array_unique($all_urls));
    }

    /**
     * Parse un sitemap (urlset ou sitemapindex) de façon récursive.
     */
    private static function parse_sitemap(string $url, int $depth): array {
        if ($depth > 2) {
            return [];
        }

        $response = wp_remote_get($url, [
            'timeout'    => self::FETCH_TIMEOUT,
            'user-agent' => self::CRAWLER_UA,
            'redirection' => 3,
        ]);

        if (is_wp_error($response)) {
            return [];
        }

        $body = wp_remote_retrieve_body($response);
        if (empty($body)) {
            return [];
        }

        // Supprimer le namespace pour simplifier le parsing
        $body = preg_replace('/\s+xmlns[^=]*="[^"]*"/', '', $body);

        $xml = @simplexml_load_string($body);
        if ($xml === false) {
            return [];
        }

        $urls = [];

        // Sitemap index
        if (isset($xml->sitemap)) {
            $count = 0;
            foreach ($xml->sitemap as $child) {
                if ($count >= self::MAX_CHILD_SITEMAPS) {
                    break;
                }
                $child_url = trim((string) $child->loc);
                if ($child_url) {
                    $child_urls = self::parse_sitemap($child_url, $depth + 1);
                    $urls       = array_merge($urls, $child_urls);
                    $count++;
                }
            }
            return $urls;
        }

        // Urlset classique
        if (isset($xml->url)) {
            foreach ($xml->url as $entry) {
                $loc = trim((string) $entry->loc);
                if ($loc) {
                    $urls[] = $loc;
                }
            }
        }

        return $urls;
    }

    // ---------------------------------------------------------------------------
    // Fetch & parse page
    // ---------------------------------------------------------------------------

    /**
     * Re-vérifie le statut HTTP actuel d'une URL (pour vérifier si une 404 est fixée).
     * Utilise redirection=0 pour capturer explicitement 301/302 sans les suivre.
     *
     * @param string $url URL absolue à vérifier.
     * @return array{ status: int, final_url: string|null }
     */
    public static function recheck_url(string $url): array {
        $response = wp_remote_get($url, [
            'timeout'     => self::FETCH_TIMEOUT,
            'user-agent'  => self::CRAWLER_UA,
            'redirection' => 0, // ne pas suivre les redirections
        ]);

        if (is_wp_error($response)) {
            return ['status' => 0, 'final_url' => null];
        }

        $status    = (int) wp_remote_retrieve_response_code($response);
        $final_url = wp_remote_retrieve_header($response, 'location') ?: null;

        return ['status' => $status, 'final_url' => $final_url];
    }

    /**
     * Fetche une URL et extrait les données on-page.
     * Retourne un tableau compatible avec spiderlens_crawl_pages.
     * La clé 'html' est ajoutée temporairement pour extract_internal_links.
     */
    private static function fetch_and_parse(string $url): array {
        $response = wp_remote_get($url, [
            'timeout'    => self::FETCH_TIMEOUT,
            'user-agent' => self::CRAWLER_UA,
            'redirection' => 3,
        ]);

        if (is_wp_error($response)) {
            return [
                'url'         => $url,
                'status_code' => null,
                'error'       => $response->get_error_message(),
            ];
        }

        $status_code  = (int) wp_remote_retrieve_response_code($response);
        $content_type = wp_remote_retrieve_header($response, 'content-type');
        $body         = wp_remote_retrieve_body($response);

        // Tronquer si trop grand
        if (strlen($body) > self::MAX_BODY_BYTES) {
            $body = substr($body, 0, self::MAX_BODY_BYTES);
        }

        // Si pas du HTML, on ne parse pas
        if (strpos($content_type, 'text/html') === false) {
            return [
                'url'         => $url,
                'status_code' => $status_code,
            ];
        }

        $on_page = self::extract_page_data($body);

        return array_merge([
            'url'         => $url,
            'status_code' => $status_code,
            'html'        => $body, // temporaire, supprimé avant INSERT
        ], $on_page);
    }

    /**
     * Extrait les données SEO on-page d'un HTML.
     */
    private static function extract_page_data(string $html): array {
        $title = null;
        if (preg_match('/<title[^>]*>(.*?)<\/title>/si', $html, $m)) {
            $title = trim(html_entity_decode(strip_tags($m[1]), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
            if ($title === '') $title = null;
        }

        $h1 = null;
        if (preg_match('/<h1[^>]*>(.*?)<\/h1>/si', $html, $m)) {
            $h1 = trim(html_entity_decode(strip_tags($m[1]), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
            if ($h1 === '') $h1 = null;
        }

        // Word count : supprimer les scripts/styles puis compter
        $text = preg_replace('/<(script|style)[^>]*>.*?<\/(script|style)>/si', '', $html);
        $text = strip_tags($text);
        $text = preg_replace('/\s+/', ' ', $text);
        $word_count = str_word_count(trim($text));

        $canonical = null;
        // <link rel="canonical" href="..."> (les deux ordres d'attributs)
        if (preg_match('/<link[^>]*rel=["\']canonical["\'][^>]*href=["\']([^"\']+)["\']/si', $html, $m)) {
            $canonical = trim($m[1]);
        } elseif (preg_match('/<link[^>]*href=["\']([^"\']+)["\'][^>]*rel=["\']canonical["\']/si', $html, $m)) {
            $canonical = trim($m[1]);
        }

        $meta_robots = null;
        if (preg_match('/<meta[^>]*name=["\']robots["\'][^>]*content=["\']([^"\']+)["\']/si', $html, $m)) {
            $meta_robots = trim($m[1]);
        } elseif (preg_match('/<meta[^>]*content=["\']([^"\']+)["\'][^>]*name=["\']robots["\']/si', $html, $m)) {
            $meta_robots = trim($m[1]);
        }

        return [
            'title'       => $title,
            'h1'          => $h1,
            'word_count'  => $word_count,
            'canonical'   => $canonical,
            'meta_robots' => $meta_robots,
        ];
    }

    /**
     * Extrait les liens internes d'une page HTML.
     */
    private static function extract_internal_links(string $html, string $page_url, string $base_host): array {
        $links = [];
        $excluded_exts = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'css', 'js',
                          'zip', 'gz', 'xml', 'json', 'ico', 'woff', 'woff2', 'ttf', 'eot', 'mp4', 'mp3'];

        preg_match_all('/<a\s[^>]*href=["\']([^"\'#][^"\']*)["\'][^>]*>/si', $html, $matches);

        foreach ($matches[1] as $href) {
            $href = trim($href);
            if (empty($href) || strpos($href, 'mailto:') === 0 || strpos($href, 'tel:') === 0) {
                continue;
            }

            // Résolution URL absolue
            if (strpos($href, 'http') !== 0) {
                $parsed_page = wp_parse_url($page_url);
                if (strpos($href, '/') === 0) {
                    $href = $parsed_page['scheme'] . '://' . $parsed_page['host'] . $href;
                } else {
                    $base_path = rtrim(dirname($parsed_page['path'] ?? '/'), '/');
                    $href = $parsed_page['scheme'] . '://' . $parsed_page['host'] . $base_path . '/' . $href;
                }
            }

            $parsed = wp_parse_url($href);
            if (!$parsed || ($parsed['host'] ?? '') !== $base_host) {
                continue;
            }

            // Exclure les extensions de fichiers
            $path = $parsed['path'] ?? '';
            $ext  = strtolower(pathinfo($path, PATHINFO_EXTENSION));
            if ($ext && in_array($ext, $excluded_exts, true)) {
                continue;
            }

            // Normaliser : supprimer query string et fragment
            $clean = $parsed['scheme'] . '://' . $parsed['host'] . $path;
            $links[] = rtrim($clean, '/') ?: $clean;
        }

        return array_values(array_unique($links));
    }

    // ---------------------------------------------------------------------------
    // Helpers privés
    // ---------------------------------------------------------------------------

    private static function finish_crawl(int $run_id, string $status): void {
        global $wpdb;

        $wpdb->update(
            $wpdb->prefix . 'spiderlens_crawl_runs',
            [
                'status'      => $status,
                'finished_at' => current_time('mysql'),
            ],
            ['id' => $run_id]
        );

        delete_option('spider_lens_crawl_queue');
        delete_option('spider_lens_crawl_seen');
        delete_option('spider_lens_crawl_run_id');
    }
}
