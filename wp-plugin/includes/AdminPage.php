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
            'data:image/svg+xml;base64,' . base64_encode(self::get_icon_svg()),
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

        // Vérifier si le build existe
        if (!file_exists($dist . 'index.js')) {
            // Mode développement : afficher un message d'aide
            add_action('admin_notices', function() {
                echo '<div class="notice notice-warning"><p>';
                echo '<strong>Spider-Lens :</strong> Build frontend manquant. ';
                echo 'Lancez <code>cd wp-plugin/admin && npm install && npm run build</code>';
                echo '</p></div>';
            });
            return;
        }

        // Nonce WP pour authentifier les requêtes REST
        $nonce = wp_create_nonce('wp_rest');

        // Lire le manifest Vite pour les hashes de fichiers
        $manifest_path = $dist . '.vite/manifest.json';
        $js_file  = 'index.js';
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

        wp_enqueue_script(
            'spider-lens-admin',
            $plugin_url . 'admin/dist/' . $js_file,
            [],
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
        ]);
    }

    private static function get_icon_svg(): string {
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="#a7aaad">
            <path d="M230.23,92.84a8,8,0,0,0-9.61-5.81L196,93.17l-15.7-19.63,9.19-25.28a8,8,0,1,0-15.08-5.48l-7.4,20.37-17.15-21.45a8,8,0,0,0-12.46,10L160,80.85V152H96V80.85L118.6,51.7a8,8,0,1,0-12.46-10L89,63.15l-7.4-20.37A8,8,0,1,0,74.51,48.26L83.7,73.54,68,93.17,43.38,87.03A8,8,0,1,0,39.77,102.6l20,5a8,8,0,0,0,8.33-3.08L80,88.93V152H64a8,8,0,0,0,0,16H80v8a48,48,0,0,0,96,0v-8h16a8,8,0,0,0,0-16H176V88.93l11.9,15.59a8,8,0,0,0,8.33,3.08l20-5A8,8,0,0,0,230.23,92.84ZM160,176a32,32,0,0,1-64,0v-8h64Z"/>
        </svg>';
    }
}
