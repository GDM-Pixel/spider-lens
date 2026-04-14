<?php
/**
 * Plugin Name:       Spider-Lens
 * Plugin URI:        https://github.com/GDM-Pixel/spider-lens
 * Description:       Analyseur de trafic WordPress — dashboard, bots, anomalies, SEO crawler, analyse IA Nova, blocklist, GeoIP. Fonctionne sans accès aux logs serveur.
 * Version:           1.2.0
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            GDM-Pixel
 * Author URI:        https://www.gdm-pixel.com
 * License:           GPL v2 or later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       spider-lens
 * Domain Path:       /languages
 */

defined('ABSPATH') || exit;

// ── Constantes ────────────────────────────────────────────
define('SPIDER_LENS_VERSION', '1.2.0');
define('SPIDER_LENS_PATH',    plugin_dir_path(__FILE__));
define('SPIDER_LENS_URL',     plugin_dir_url(__FILE__));
define('SPIDER_LENS_FILE',    __FILE__);

// ── Autoloader PSR-4 minimal ──────────────────────────────
spl_autoload_register(function (string $class): void {
    $prefix = 'SpiderLens\\';
    if (strpos($class, $prefix) !== 0) return;
    $relative = str_replace('\\', '/', substr($class, strlen($prefix)));
    $file = SPIDER_LENS_PATH . 'includes/' . $relative . '.php';
    if (file_exists($file)) require_once $file;
});

// ── Activation / désactivation ────────────────────────────
register_activation_hook(__FILE__, function (): void {
    SpiderLens\Database::install();
    SpiderLens\Cron::schedule_events();
    flush_rewrite_rules();
});

register_deactivation_hook(__FILE__, function (): void {
    SpiderLens\Cron::unschedule_events();
    flush_rewrite_rules();
});

register_uninstall_hook(__FILE__, ['SpiderLens\\Database', 'uninstall']);

// ── Initialisation ────────────────────────────────────────
add_action('plugins_loaded', function (): void {
    // Vérification version PHP
    if (version_compare(PHP_VERSION, '7.4', '<')) {
        add_action('admin_notices', function () {
            echo '<div class="notice notice-error"><p>';
            printf(
                /* translators: %s: version PHP minimale requise */
                esc_html__('Spider-Lens nécessite PHP %s ou supérieur.', 'spider-lens'),
                '7.4'
            );
            echo '</p></div>';
        });
        return;
    }

    // Migration DB si nécessaire
    SpiderLens\Database::maybe_upgrade();

    // Initialisation des modules
    SpiderLens\Collector::init();
    SpiderLens\RestApi::init();
    SpiderLens\AdminPage::init();
    SpiderLens\Cron::init();

    // Traductions
    load_plugin_textdomain('spider-lens', false, dirname(plugin_basename(__FILE__)) . '/languages');
});
