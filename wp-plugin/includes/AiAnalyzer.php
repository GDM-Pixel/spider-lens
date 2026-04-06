<?php
namespace SpiderLens;

defined('ABSPATH') || exit;

class AiAnalyzer {

    const CACHE_TTL      = 300; // 5 minutes
    const DEFAULT_MODEL  = 'gemini-2.0-flash';
    const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent';

    // ---------------------------------------------------------------------------
    // Public API
    // ---------------------------------------------------------------------------

    /**
     * Lance une analyse structurée SEO et retourne un tableau JSON.
     * Résultat mis en cache 5 min via transient WP.
     */
    public static function analyze_structured(string $language = 'fr'): array|\WP_Error {
        $cache_key = 'spider_lens_analysis_' . $language;
        $cached    = get_transient($cache_key);
        if ($cached !== false) {
            return $cached;
        }

        $settings  = get_option('spider_lens_settings', []);
        $api_key   = $settings['gemini_api_key'] ?? '';
        $model     = $settings['gemini_model'] ?? self::DEFAULT_MODEL;

        if (empty($api_key)) {
            return new \WP_Error('no_api_key', 'GEMINI_API_KEY non configurée.', ['status' => 422]);
        }

        $summary = self::build_site_summary();
        $prompt  = self::build_analysis_prompt($summary, $language);

        $response = self::call_gemini($api_key, $model, [
            ['role' => 'user', 'parts' => [['text' => $prompt]]],
        ]);

        if (is_wp_error($response)) {
            return $response;
        }

        $text = self::extract_text($response);
        $data = self::parse_json_response($text);

        if ($data === null) {
            return new \WP_Error('parse_error', 'Réponse IA invalide.', ['status' => 500]);
        }

        set_transient($cache_key, $data, self::CACHE_TTL);
        return $data;
    }

    /**
     * Chat multi-turn avec Nova.
     * Retourne la réponse textuelle complète.
     */
    public static function chat(array $messages, ?array $page_context = null): string|\WP_Error {
        $settings = get_option('spider_lens_settings', []);
        $api_key  = $settings['gemini_api_key'] ?? '';
        $model    = $settings['gemini_model'] ?? self::DEFAULT_MODEL;

        if (empty($api_key)) {
            return new \WP_Error('no_api_key', 'GEMINI_API_KEY non configurée.', ['status' => 422]);
        }

        $summary      = self::build_site_summary();
        $system_prompt = self::build_system_prompt($summary, $page_context);

        // Construire l'historique Gemini (max 10 messages)
        $history = array_slice($messages, -10);
        $contents = [];

        // Injecter le system prompt comme premier message user/model
        $contents[] = ['role' => 'user',  'parts' => [['text' => $system_prompt]]];
        $contents[] = ['role' => 'model', 'parts' => [['text' => "Compris. Je suis Nova, prête à analyser vos données."]]];

        foreach ($history as $msg) {
            $role = ($msg['role'] ?? 'user') === 'user' ? 'user' : 'model';
            $contents[] = [
                'role'  => $role,
                'parts' => [['text' => $msg['content'] ?? '']],
            ];
        }

        $response = self::call_gemini($api_key, $model, $contents);

        if (is_wp_error($response)) {
            return $response;
        }

        return self::extract_text($response);
    }

    // ---------------------------------------------------------------------------
    // Build site summary (agrégation des données du site)
    // ---------------------------------------------------------------------------

    public static function build_site_summary(): array {
        global $wpdb;
        $t  = $wpdb->prefix . 'spiderlens_hits';
        $tc = $wpdb->prefix . 'spiderlens_crawl_pages';

        $from = date('Y-m-d H:i:s', strtotime('-30 days'));
        $to   = current_time('mysql');

        // Vue d'ensemble globale
        $overview = $wpdb->get_row($wpdb->prepare(
            "SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN is_bot = 0 THEN 1 ELSE 0 END) AS humans,
                SUM(CASE WHEN is_bot = 1 THEN 1 ELSE 0 END) AS bots,
                SUM(CASE WHEN status_code BETWEEN 200 AND 299 THEN 1 ELSE 0 END) AS s2xx,
                SUM(CASE WHEN status_code BETWEEN 300 AND 399 THEN 1 ELSE 0 END) AS s3xx,
                SUM(CASE WHEN status_code BETWEEN 400 AND 499 THEN 1 ELSE 0 END) AS s4xx,
                SUM(CASE WHEN status_code BETWEEN 500 AND 599 THEN 1 ELSE 0 END) AS s5xx,
                AVG(CASE WHEN response_time IS NOT NULL THEN response_time END) AS avg_ttfb
             FROM `$t` WHERE timestamp BETWEEN %s AND %s",
            $from, $to
        ), ARRAY_A);

        $total     = (int) ($overview['total'] ?? 0);
        $humans    = (int) ($overview['humans'] ?? 0);
        $bots      = (int) ($overview['bots'] ?? 0);
        $s4xx      = (int) ($overview['s4xx'] ?? 0);
        $s5xx      = (int) ($overview['s5xx'] ?? 0);
        $error_rate = $total > 0 ? round(($s4xx + $s5xx) / $total * 100, 1) : 0;

        // Top 5 pages 404
        $top404 = $wpdb->get_results($wpdb->prepare(
            "SELECT url, COUNT(*) AS hits,
                SUM(CASE WHEN is_bot = 0 THEN 1 ELSE 0 END) AS human_hits,
                SUM(CASE WHEN bot_name = 'Googlebot' THEN 1 ELSE 0 END) AS googlebot_hits
             FROM `$t`
             WHERE status_code = 404 AND timestamp BETWEEN %s AND %s
             GROUP BY url ORDER BY hits DESC LIMIT 5",
            $from, $to
        ), ARRAY_A);

        // Stats Googlebot
        $googlebot = $wpdb->get_row($wpdb->prepare(
            "SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN status_code BETWEEN 200 AND 299 THEN 1 ELSE 0 END) AS s2xx,
                SUM(CASE WHEN status_code = 404 THEN 1 ELSE 0 END) AS s404,
                SUM(CASE WHEN status_code BETWEEN 500 AND 599 THEN 1 ELSE 0 END) AS s5xx,
                COUNT(DISTINCT DATE(timestamp)) AS active_days
             FROM `$t`
             WHERE bot_name = 'Googlebot' AND timestamp BETWEEN %s AND %s",
            $from, $to
        ), ARRAY_A);

        // Top 5 bots
        $top_bots = $wpdb->get_results($wpdb->prepare(
            "SELECT bot_name, COUNT(*) AS hits
             FROM `$t`
             WHERE is_bot = 1 AND bot_name IS NOT NULL AND timestamp BETWEEN %s AND %s
             GROUP BY bot_name ORDER BY hits DESC LIMIT 5",
            $from, $to
        ), ARRAY_A);

        // TTFB : slowest URL
        $slowest_url = $wpdb->get_row($wpdb->prepare(
            "SELECT url, AVG(response_time) AS avg_rt
             FROM `$t`
             WHERE response_time IS NOT NULL AND timestamp BETWEEN %s AND %s
             GROUP BY url HAVING COUNT(*) >= 5
             ORDER BY avg_rt DESC LIMIT 1",
            $from, $to
        ), ARRAY_A);

        $slow_pct = 0;
        if ($total > 0) {
            $slow_count = (int) $wpdb->get_var($wpdb->prepare(
                "SELECT COUNT(*) FROM `$t` WHERE response_time > 800 AND timestamp BETWEEN %s AND %s",
                $from, $to
            ));
            $slow_pct = round($slow_count / $total * 100, 1);
        }

        // Tendance semaine courante vs précédente
        $curr_start = date('Y-m-d H:i:s', strtotime('monday this week 00:00:00'));
        $prev_start = date('Y-m-d H:i:s', strtotime('monday last week 00:00:00'));
        $prev_end   = date('Y-m-d H:i:s', strtotime('sunday last week 23:59:59'));

        $curr_week = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM `$t` WHERE timestamp >= %s AND is_bot = 0", $curr_start
        ));
        $prev_week = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM `$t` WHERE timestamp BETWEEN %s AND %s AND is_bot = 0", $prev_start, $prev_end
        ));

        $trend_pct = $prev_week > 0 ? round(($curr_week - $prev_week) / $prev_week * 100, 1) : 0;

        // Anomalies récentes (3 max)
        $ta = $wpdb->prefix . 'spiderlens_anomalies';
        $anomalies = $wpdb->get_results(
            "SELECT type, severity, observed, baseline, message, detected_at FROM `$ta` ORDER BY id DESC LIMIT 3",
            ARRAY_A
        ) ?: [];

        // Données crawl on-page
        $crawl = null;
        $crawl_count = (int) $wpdb->get_var("SELECT COUNT(*) FROM `$tc`");
        if ($crawl_count > 0) {
            $crawl = $wpdb->get_row("
                SELECT
                    COUNT(*) AS total,
                    SUM(CASE WHEN (title IS NULL OR title = '') THEN 1 ELSE 0 END) AS missing_title,
                    SUM(CASE WHEN (h1 IS NULL OR h1 = '') THEN 1 ELSE 0 END) AS missing_h1,
                    SUM(CASE WHEN meta_robots LIKE '%noindex%' THEN 1 ELSE 0 END) AS noindex,
                    AVG(CASE WHEN word_count > 0 THEN word_count END) AS avg_word_count,
                    SUM(CASE WHEN word_count > 0 AND word_count < 300 THEN 1 ELSE 0 END) AS thin_content,
                    SUM(CASE WHEN error IS NOT NULL AND error != '' THEN 1 ELSE 0 END) AS errors,
                    MAX(crawled_at) AS last_crawl
                FROM `$tc`
            ", ARRAY_A);
        }

        return [
            'period'     => '30 derniers jours',
            'siteUrl'    => get_site_url(),
            'siteName'   => get_bloginfo('name'),
            'overview'   => [
                'total'      => $total,
                'humans'     => $humans,
                'bots'       => $bots,
                's2xx'       => (int) ($overview['s2xx'] ?? 0),
                's3xx'       => (int) ($overview['s3xx'] ?? 0),
                's4xx'       => $s4xx,
                's5xx'       => $s5xx,
                'errorRate'  => $error_rate,
                'avgTTFB'    => round((float) ($overview['avg_ttfb'] ?? 0)),
            ],
            'top404'     => array_map(fn($r) => [
                'url'          => $r['url'],
                'hits'         => (int) $r['hits'],
                'humanHits'    => (int) $r['human_hits'],
                'googlebotHits' => (int) $r['googlebot_hits'],
            ], $top404 ?: []),
            'googlebot'  => [
                'total'       => (int) ($googlebot['total'] ?? 0),
                's2xx'        => (int) ($googlebot['s2xx'] ?? 0),
                's404'        => (int) ($googlebot['s404'] ?? 0),
                's5xx'        => (int) ($googlebot['s5xx'] ?? 0),
                'activeDays'  => (int) ($googlebot['active_days'] ?? 0),
            ],
            'topBots'    => array_map(fn($r) => ['name' => $r['bot_name'], 'hits' => (int) $r['hits']], $top_bots ?: []),
            'ttfb'       => [
                'avg'         => round((float) ($overview['avg_ttfb'] ?? 0)),
                'slowPct'     => $slow_pct,
                'slowestUrl'  => $slowest_url['url'] ?? null,
                'slowestAvg'  => $slowest_url ? round((float) $slowest_url['avg_rt']) : null,
            ],
            'trend'      => [
                'currentWeek'  => $curr_week,
                'previousWeek' => $prev_week,
                'changePct'    => $trend_pct,
            ],
            'anomalies'  => $anomalies,
            'crawl'      => $crawl ? [
                'total'        => (int) $crawl['total'],
                'missingTitle' => (int) $crawl['missing_title'],
                'missingH1'    => (int) $crawl['missing_h1'],
                'noindex'      => (int) $crawl['noindex'],
                'avgWordCount' => round((float) ($crawl['avg_word_count'] ?? 0)),
                'thinContent'  => (int) $crawl['thin_content'],
                'errors'       => (int) $crawl['errors'],
                'lastCrawl'    => $crawl['last_crawl'],
            ] : null,
        ];
    }

    // ---------------------------------------------------------------------------
    // Prompts
    // ---------------------------------------------------------------------------

    private static function build_analysis_prompt(array $summary, string $language): string {
        $summary_json = wp_json_encode($summary, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        $lang_labels = [
            'fr' => ['Critique', 'Mauvais', 'Moyen', 'Bon', 'Très Bon'],
            'en' => ['Critical', 'Poor',    'Fair',  'Good', 'Excellent'],
            'es' => ['Crítico', 'Malo',     'Regular', 'Bueno', 'Excelente'],
            'de' => ['Kritisch', 'Schlecht', 'Mittel', 'Gut', 'Sehr Gut'],
        ];
        $labels = $lang_labels[$language] ?? $lang_labels['fr'];
        [$crit, $bad, $avg, $good, $vgood] = $labels;

        return <<<PROMPT
You are Nova, an expert SEO analyst. Analyze the following Spider-Lens data for a WordPress site and return a structured JSON response.

SITE DATA (last 30 days):
{$summary_json}

SCORING RULES:
- Base score on: Googlebot health (activeDays, s2xx%, s404%), SEO bot presence, TTFB (avg + slowPct), crawl issues (missingTitle, missingH1, thinContent%), real 404s with googlebot hits
- Do NOT penalize heavily for humanErrorRate (may be inflated by scanners)
- Score range: 0-100

SCORE LABELS (use language: {$language}):
- 80-100: "{$vgood}" (color: green)
- 60-79: "{$good}" (color: moonstone)
- 40-59: "{$avg}" (color: amber)
- 20-39: "{$bad}" (color: dustyred)
- 0-19: "{$crit}" (color: dustyred)

Respond ONLY with valid JSON matching this exact schema:
{
  "score": <integer 0-100>,
  "scoreLabel": "<label>",
  "scoreColor": "<green|moonstone|amber|dustyred>",
  "summary": "<max 120 chars, key insight>",
  "problems": [
    {
      "id": "<unique_id>",
      "icon": "<phosphor icon name e.g. ph:warning>",
      "color": "<dustyred|amber|moonstone>",
      "title": "<short title>",
      "detail": "<explanation>",
      "impact": "<critique|warning|info>"
    }
  ],
  "recommendations": [
    {
      "id": "<unique_id>",
      "icon": "<phosphor icon name>",
      "title": "<short title>",
      "action": "<concrete action to take>",
      "why": "<why this matters for SEO>"
    }
  ],
  "highlights": [
    {
      "key": "<metric name>",
      "value": "<formatted value e.g. 42%>",
      "trend": "<up|down|neutral>",
      "icon": "<phosphor icon name>"
    }
  ]
}

Include 2-5 problems, 2-5 recommendations, 3-5 highlights. Respond in language: {$language}. NO markdown, NO explanation, ONLY the JSON object.
PROMPT;
    }

    private static function build_system_prompt(array $summary, ?array $page_context): string {
        $summary_json = wp_json_encode($summary, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $ctx_json     = $page_context ? wp_json_encode($page_context, JSON_UNESCAPED_UNICODE) : 'null';

        $page_ctx_block = $page_context
            ? "CURRENT PAGE CONTEXT (the user is viewing this page right now):\n{$ctx_json}"
            : "CURRENT PAGE CONTEXT: none (user not on a specific page)";

        return <<<PROMPT
You are Nova, Spider-Lens's AI assistant, expert in SEO, web performance, and server log analysis. You are friendly, precise, and give concrete actionable advice.

SITE DATA (last 30 days for {$summary['siteName']} — {$summary['siteUrl']}):
{$summary_json}

{$page_ctx_block}

INSTRUCTIONS:
- Answer in the same language as the user's question
- Be concise but thorough
- Reference specific numbers from the data when relevant
- Give actionable recommendations, not just observations
- Format your response in Markdown when helpful (lists, bold, code blocks)
- If page context is provided, acknowledge the page the user is on naturally in your first sentence (e.g. "Sur la page TTFB, je vois que..."), then focus on that data
- If no page context, answer from the global site data
PROMPT;
    }

    // ---------------------------------------------------------------------------
    // Gemini API call
    // ---------------------------------------------------------------------------

    private static function call_gemini(string $api_key, string $model, array $contents): array|\WP_Error {
        $url = sprintf(self::GEMINI_API_URL, $model) . '?key=' . $api_key;

        $body = wp_json_encode([
            'contents'         => $contents,
            'generationConfig' => [
                'temperature'     => 0.7,
                'maxOutputTokens' => 4096,
            ],
        ]);

        $response = wp_remote_post($url, [
            'headers'     => ['Content-Type' => 'application/json'],
            'body'        => $body,
            'timeout'     => 60,
            'data_format' => 'body',
        ]);

        if (is_wp_error($response)) {
            return $response;
        }

        $code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);

        if ($code === 400 && isset($data['error']['message'])) {
            return new \WP_Error('gemini_error', $data['error']['message'], ['status' => 400]);
        }

        if ($code !== 200) {
            return new \WP_Error('gemini_http', "Gemini API returned HTTP $code", ['status' => 500]);
        }

        return $data;
    }

    private static function extract_text(array $gemini_response): string {
        return $gemini_response['candidates'][0]['content']['parts'][0]['text'] ?? '';
    }

    private static function parse_json_response(string $text): ?array {
        // Extraire le JSON même s'il est entouré de markdown ```json ... ```
        if (preg_match('/```(?:json)?\s*([\s\S]+?)\s*```/i', $text, $m)) {
            $text = $m[1];
        }

        // Trouver le premier { et le dernier }
        $start = strpos($text, '{');
        $end   = strrpos($text, '}');
        if ($start === false || $end === false) {
            return null;
        }

        $json = substr($text, $start, $end - $start + 1);
        $data = json_decode($json, true);

        return is_array($data) ? $data : null;
    }
}
