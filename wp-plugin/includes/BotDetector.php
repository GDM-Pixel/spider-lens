<?php
namespace SpiderLens;

defined('ABSPATH') || exit;

class BotDetector {

    /**
     * Patterns UA → nom du bot (ordre : du plus spécifique au plus générique)
     */
    private static $patterns = [
        // Moteurs de recherche majeurs
        'Googlebot'            => '/googlebot/i',
        'Google-Extended'      => '/google-extended/i',
        'Googlebot-Image'      => '/googlebot-image/i',
        'Googlebot-Video'      => '/googlebot-video/i',
        'Google AdsBot'        => '/adsbot-google/i',
        'Google Mediapartners' => '/mediapartners-google/i',
        'Bingbot'              => '/bingbot/i',
        'BingPreview'          => '/bingpreview/i',
        'Slurp'                => '/slurp/i',
        'DuckDuckBot'          => '/duckduckbot/i',
        'Baiduspider'          => '/baiduspider/i',
        'YandexBot'            => '/yandex(?:bot|mobile|images|video|news|metrika)/i',
        'Sogou Spider'         => '/sogou/i',
        'Exabot'               => '/exabot/i',
        'facebot'              => '/facebot|facebookexternalhit/i',
        'ia_archiver'          => '/ia_archiver/i',
        'Applebot'             => '/applebot/i',
        'Twitterbot'           => '/twitterbot/i',
        'LinkedInBot'          => '/linkedinbot/i',
        'PinterestBot'         => '/pinterest/i',

        // SEO / Audit
        'AhrefsBot'            => '/ahrefsbot/i',
        'SemrushBot'           => '/semrushbot/i',
        'MJ12bot'              => '/mj12bot/i',
        'DotBot'               => '/dotbot/i',
        'SEOkicks'             => '/seokicks/i',
        'SeznamBot'            => '/seznambot/i',
        'Rogerbot'             => '/rogerbot/i',
        'linkdexbot'           => '/linkdexbot/i',
        'OpenLinkProfiler'     => '/openlinkprofiler/i',
        'spbot'                => '/spbot/i',
        'Screaming Frog'       => '/screaming.?frog/i',

        // Monitoring / uptime
        'UptimeRobot'          => '/uptimerobot/i',
        'Pingdom'              => '/pingdom/i',
        'StatusCake'           => '/statuscake/i',
        'Site24x7'             => '/site24x7/i',
        'GTmetrix'             => '/gtmetrix/i',

        // Crawlers génériques
        'CCBot'                => '/ccbot/i',
        'DataForSeoBot'        => '/dataforseobot/i',
        'PetalBot'             => '/petalbot/i',
        'Bytespider'           => '/bytespider/i',
        'ClaudeBot'            => '/claudebot/i',
        'GPTBot'               => '/gptbot/i',
        'ChatGPT-User'         => '/chatgpt-user/i',
        'anthropic-ai'         => '/anthropic-ai/i',
        'cohere-ai'            => '/cohere-ai/i',
        'PerplexityBot'        => '/perplexitybot/i',

        // Génériques (dernier recours)
        'Generic Bot'          => '/bot|crawler|spider|slurp|scan|fetch|check|http|curl|wget|python|java|ruby|php|go-http|libwww|lwp-|scrapy|mechanize/i',
    ];

    /**
     * Analyse un user-agent et retourne [is_bot, bot_name]
     *
     * @return array{is_bot: bool, bot_name: string|null}
     */
    public static function detect(string $user_agent): array {
        if (empty($user_agent)) {
            return ['is_bot' => false, 'bot_name' => null];
        }

        foreach (self::$patterns as $name => $pattern) {
            if (preg_match($pattern, $user_agent)) {
                return ['is_bot' => true, 'bot_name' => $name];
            }
        }

        return ['is_bot' => false, 'bot_name' => null];
    }

    /**
     * Vérifie si une URL doit être ignorée (assets statiques, WP internals)
     */
    public static function should_skip_url(string $url): bool {
        // Assets statiques WordPress
        if (preg_match('/\.(css|js|jpg|jpeg|png|gif|webp|svg|ico|woff|woff2|ttf|eot|map|json)(\?.*)?$/i', $url)) {
            return true;
        }
        // Requêtes internes WP
        if (strpos($url, '/wp-cron.php') !== false) return true;
        if (strpos($url, '/wp-json/') !== false && strpos($url, '/wp-json/spider-lens/') === false) return true;
        if (strpos($url, '/xmlrpc.php') !== false) return true;

        return false;
    }
}
