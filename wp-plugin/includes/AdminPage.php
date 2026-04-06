<?php
namespace SpiderLens;

defined('ABSPATH') || exit;

class AdminPage {

    const MENU_SLUG = 'spider-lens';

    public static function init(): void {
        add_action('admin_menu',             [self::class, 'register_menu']);
        add_action('admin_enqueue_scripts',  [self::class, 'enqueue_assets']);
    }

    public static function register_menu(): void {
        add_menu_page(
            __('Spider-Lens', 'spider-lens'),
            __('Spider-Lens', 'spider-lens'),
            'manage_options',
            self::MENU_SLUG,
            [self::class, 'render_page'],
            SPIDER_LENS_URL . 'admin/dist/spider-lens-logo.png',
            30
        );

        // Sous-pages (pour les deep links dans le menu admin WP)
        $sub_pages = [
            'dashboard'  => __('Dashboard', 'spider-lens'),
            'http-codes' => __('Codes HTTP', 'spider-lens'),
            'top-pages'  => __('Top Pages', 'spider-lens'),
            'bots'       => __('Bots', 'spider-lens'),
            'ttfb'       => __('Performances', 'spider-lens'),
            'network'    => __('Réseau', 'spider-lens'),
            'anomalies'  => __('Anomalies', 'spider-lens'),
            'blocklist'  => __('Blocklist', 'spider-lens'),
            'crawler'    => __('Crawler', 'spider-lens'),
            'assistant'  => __('Analyse IA', 'spider-lens'),
            'settings'   => __('Paramètres', 'spider-lens'),
        ];

        foreach ($sub_pages as $slug => $label) {
            add_submenu_page(
                self::MENU_SLUG,
                $label . ' — Spider-Lens',
                $label,
                'manage_options',
                self::MENU_SLUG . ($slug === 'dashboard' ? '' : '#/' . $slug),
                $slug === 'dashboard' ? [self::class, 'render_page'] : '__return_null'
            );
        }
    }

    public static function render_page(): void {
        if (!current_user_can('manage_options')) {
            wp_die(esc_html__('Accès refusé.', 'spider-lens'));
        }
        echo '<div id="spider-lens-root"></div>';
    }

    public static function enqueue_assets(string $hook): void {
        // N'injecter les assets que sur notre page admin
        if (strpos($hook, self::MENU_SLUG) === false) return;

        $plugin_url = SPIDER_LENS_URL;
        $dist       = SPIDER_LENS_PATH . 'admin/dist/';

        // Nonce WP pour authentifier les requêtes REST
        $nonce = wp_create_nonce('wp_rest');

        // Lire le manifest Vite pour les hashes de fichiers
        $manifest_path = $dist . '.vite/manifest.json';
        $js_file  = null;
        $css_file = null;

        if (file_exists($manifest_path)) {
            $manifest = json_decode(file_get_contents($manifest_path), true); // phpcs:ignore
            if (!empty($manifest['src/main.jsx']['file'])) {
                $js_file = $manifest['src/main.jsx']['file'];
            }
            if (!empty($manifest['src/main.jsx']['css'][0])) {
                $css_file = $manifest['src/main.jsx']['css'][0];
            }
        }

        if (!$js_file || !file_exists($dist . $js_file)) {
            add_action('admin_notices', function() {
                echo '<div class="notice notice-error"><p>';
                echo '<strong>Spider-Lens :</strong> Build frontend introuvable. ';
                echo 'Veuillez réinstaller le plugin depuis une archive ZIP officielle.';
                echo '</p></div>';
            });
            return;
        }

        wp_enqueue_script(
            'spider-lens-admin',
            $plugin_url . 'admin/dist/' . $js_file,
            ['wp-element'],
            null,
            true
        );

        if ($css_file) {
            wp_enqueue_style(
                'spider-lens-admin',
                $plugin_url . 'admin/dist/' . $css_file,
                [],
                null
            );
        }

        // Variables globales injectées dans window.spiderLens
        wp_localize_script('spider-lens-admin', 'spiderLens', [
            'apiBase'   => rest_url('spider-lens/v1'),
            'nonce'     => $nonce,
            'adminUrl'  => admin_url('admin.php?page=' . self::MENU_SLUG),
            'pluginUrl' => $plugin_url,
            'version'   => SPIDER_LENS_VERSION,
            'siteUrl'   => get_site_url(),
            'siteName'  => get_bloginfo('name'),
            'locale'    => get_user_locale(),
        ]);
    }
}
