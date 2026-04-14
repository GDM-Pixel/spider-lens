<?php
namespace SpiderLens;

defined('ABSPATH') || exit;

/**
 * Couche de cache via transients WP pour les endpoints /stats/*.
 *
 * TTL dynamique :
 * - Range récente (to >= aujourd'hui - 1 jour) → 300s  (données volatiles)
 * - Range historique pur                        → 3600s (données figées)
 *
 * Bypass : ajouter ?fresh=1 à l'URL (admins uniquement).
 * Invalidation auto : branchée sur le hook spider_lens_flush_buffer (Cron.php).
 */
class Cache {

    const PREFIX = 'spider_lens_cache_';

    /**
     * L'utilisateur demande-t-il des données fraîches (?fresh=1) ?
     */
    public static function should_bypass(): bool {
        return isset($_GET['fresh'])
            && $_GET['fresh'] === '1'
            && current_user_can('manage_options');
    }

    /**
     * Génère une clé de cache déterministe à partir du nom d'endpoint et des paramètres.
     */
    public static function key(string $endpoint, array $params): string {
        ksort($params);
        return self::PREFIX . md5($endpoint . '|' . wp_json_encode($params));
    }

    /**
     * Retourne la valeur en cache ou exécute $cb pour la calculer et la mettre en cache.
     *
     * @param string   $key  Clé générée via self::key()
     * @param int      $ttl  Durée de vie en secondes
     * @param callable $cb   Fonction qui produit la valeur à cacher
     * @return mixed
     */
    public static function remember(string $key, int $ttl, callable $cb) {
        if (!self::should_bypass()) {
            $cached = get_transient($key);
            if ($cached !== false) {
                return $cached;
            }
        }

        $val = $cb();
        set_transient($key, $val, $ttl);
        return $val;
    }

    /**
     * TTL dynamique selon la fraîcheur du range :
     * - to >= hier → 300s  (données des dernières 24h, potentiellement en cours)
     * - sinon      → 3600s (range purement historique)
     */
    public static function ttl_for_range(string $to): int {
        return (strtotime($to) >= strtotime('-1 day')) ? 300 : 3600;
    }

    /**
     * Purge tous les transients Spider-Lens (valeur + timeout).
     * Appelé automatiquement par le hook spider_lens_flush_buffer.
     *
     * @return int Nombre d'entrées supprimées
     */
    public static function flush_all(): int {
        global $wpdb;
        // WP stocke chaque transient en deux lignes : valeur + expiration (timeout_)
        return (int) $wpdb->query(
            "DELETE FROM {$wpdb->options}
             WHERE option_name LIKE '\\_transient\\_spider\\_lens\\_cache\\_%'
                OR option_name LIKE '\\_transient\\_timeout\\_spider\\_lens\\_cache\\_%'"
        );
    }
}
