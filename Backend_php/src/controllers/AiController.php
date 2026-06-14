<?php
/**
 * /ai/* — status, product-name suggestions, description, low-stock insight,
 * sales forecast, and the function-calling chat assistant. Mirrors backend/ai.py.
 */
class AiController
{
    public static function register(Router $r): void
    {
        $r->get('/ai/status',                [self::class, 'status']);
        $r->post('/ai/suggest-products',     [self::class, 'suggestProducts']);
        $r->post('/ai/generate-description', [self::class, 'generateDescription']);
        $r->post('/ai/low-stock-insight',    [self::class, 'lowStockInsight']);
        $r->post('/ai/sales-forecast',       [self::class, 'salesForecast']);
        $r->post('/ai/chat',                 [self::class, 'chat']);
    }

    public static function status(array $p): void
    {
        Response::json(['available' => Ai::available()]);
    }

    public static function suggestProducts(array $p): void
    {
        $b = Request::body();
        $category = (string) ($b['category'] ?? '');
        $partial = (string) ($b['partial_name'] ?? '');
        if (!Ai::available()) { Response::json([]); }

        $existing = Database::all(
            "SELECT name FROM products WHERE category LIKE :c AND status = 'active' LIMIT 20",
            ['c' => '%' . (Ai::resolveCategory($category) ?? $category) . '%']
        );
        $names = array_slice(array_map(fn ($r) => $r['name'], $existing), 0, 10);
        $prompt = "Category: $category\n"
            . "Partial name typed: \"$partial\"\n"
            . 'Already in inventory: ' . ($names ? implode(', ', $names) : 'none yet') . "\n"
            . "Suggest 5 complete, realistic product names that a neighbourhood shop in India would sell in this category. Avoid duplicating existing products.\n"
            . "Respond ONLY with a JSON array of strings — no markdown, no explanation.\n"
            . 'Example: ["Amul Butter 100g", "Britannia Bread 400g"]';
        $system = 'You are a product naming assistant for a hyperlocal grocery marketplace in India. Respond only with valid JSON arrays.';
        try {
            $text = Ai::complete($prompt, $system, 200, 0.8);
            $text = trim(str_replace(['```json', '```'], '', $text));
            $arr = json_decode($text, true);
            $out = is_array($arr) ? array_values(array_filter($arr, 'is_string')) : [];
            Response::json(array_slice($out, 0, 5));
        } catch (Throwable $e) {
            Response::json([]);
        }
    }

    public static function generateDescription(array $p): void
    {
        $b = Request::body();
        $name = (string) ($b['name'] ?? '');
        $category = (string) ($b['category'] ?? '');
        $prompt = "Write a single short sentence (max 15 words) describing \"$name\" for an online grocery store in the \"$category\" category. Be factual and friendly. Respond with ONLY the description sentence — no quotes, no punctuation at the end.";
        try {
            $text = Ai::complete($prompt, '', 60, 0.6);
            Response::json(['description' => rtrim($text, '.')]);
        } catch (Throwable $e) {
            Response::json(['description' => '']);
        }
    }

    public static function lowStockInsight(array $p): void
    {
        $b = Request::body();
        $shopId = isset($b['shop_id']) ? (int) $b['shop_id'] : null;
        $shopName = $b['shop_name'] ?? 'your shop';
        $lowItems = is_array($b['low_stock_items'] ?? null) ? $b['low_stock_items'] : [];

        if ($shopId && !$lowItems) {
            $shop = Database::one('SELECT * FROM shops WHERE id = :id', ['id' => $shopId]);
            if ($shop) $shopName = $shop['name'];
            $lowProds = Database::all(
                "SELECT * FROM products WHERE shop_id = :s AND status = 'active' AND stock <= low_stock_threshold",
                ['s' => $shopId]
            );
            $lowItems = array_map(fn ($p) => "{$p['name']} ({$p['stock']} left, threshold {$p['low_stock_threshold']})", $lowProds);
        }
        if (!$lowItems) {
            Response::json(['insight' => 'All products are well-stocked. No restocking needed right now.']);
        }

        $recentSales = [];
        if ($shopId) {
            $weekAgo = gmdate('Y-m-d H:i:s', strtotime('-7 days'));
            $sales = Database::all(
                'SELECT oi.name, SUM(oi.quantity) qty FROM order_items oi JOIN orders o ON oi.order_id = o.id
                 WHERE o.shop_id = :s AND o.created_at >= :w GROUP BY oi.name ORDER BY qty DESC LIMIT 5',
                ['s' => $shopId, 'w' => $weekAgo]
            );
            $recentSales = array_map(fn ($s) => "{$s['name']}: {$s['qty']} sold this week", $sales);
        }
        if (!Ai::available()) {
            Response::json(['insight' => '', 'low_stock_count' => count($lowItems)]);
        }

        $itemsList = implode("\n", array_map(fn ($i) => "  - $i", $lowItems));
        $prompt = "Low stock products:\n$itemsList\n\n";
        if ($recentSales) {
            $prompt .= "Recent top sellers (last 7 days):\n" . implode("\n", array_map(fn ($s) => "  - $s", $recentSales)) . "\n\n";
        }
        $prompt .= 'Give 2-3 short, practical sentences of advice on restocking priorities. Prioritize fast-selling items that are running low. Be specific to these items.';
        $system = "You are an inventory advisor for a small neighbourhood shop called \"$shopName\" in India.";
        try {
            $text = Ai::complete($prompt, $system, 200);
            Response::json(['insight' => $text, 'low_stock_count' => count($lowItems)]);
        } catch (Throwable $e) {
            Response::json(['insight' => '', 'low_stock_count' => count($lowItems)]);
        }
    }

    public static function salesForecast(array $p): void
    {
        $b = Request::body();
        $shopId = (int) ($b['shop_id'] ?? 0);
        $daysBack = (int) ($b['days_back'] ?? 30);
        $shop = Database::one('SELECT * FROM shops WHERE id = :id', ['id' => $shopId]);
        $shopName = $shop['name'] ?? "Shop #$shopId";
        $shopCategory = $shop ? Enums::catKeyToValue($shop['category']) : 'General';
        $cutoff = gmdate('Y-m-d H:i:s', strtotime("-$daysBack days"));

        $daily = Database::all(
            "SELECT DATE(created_at) day, SUM(total) revenue, COUNT(*) order_count FROM orders
             WHERE shop_id = :s AND created_at >= :c AND status != 'rejected'
             GROUP BY DATE(created_at) ORDER BY DATE(created_at)",
            ['s' => $shopId, 'c' => $cutoff]
        );
        $top = Database::all(
            'SELECT oi.name, SUM(oi.quantity) qty, SUM(oi.price * oi.quantity) rev FROM order_items oi
             JOIN orders o ON oi.order_id = o.id WHERE o.shop_id = :s AND o.created_at >= :c
             GROUP BY oi.name ORDER BY qty DESC LIMIT 5',
            ['s' => $shopId, 'c' => $cutoff]
        );
        $totalRevenue = array_sum(array_map(fn ($d) => (float) $d['revenue'], $daily));
        $totalOrders = array_sum(array_map(fn ($d) => (int) $d['order_count'], $daily));
        $activeDays = count($daily);
        $avgDaily = $activeDays ? $totalRevenue / $activeDays : 0;

        $recent14 = array_slice($daily, -14);
        $dailyData = implode(', ', array_map(fn ($d) => "{$d['day']}: ₹" . round((float) $d['revenue']) . " ({$d['order_count']} orders)", $recent14));
        $topProds = implode(', ', array_map(fn ($p) => "{$p['name']} ({$p['qty']} units, ₹" . round((float) $p['rev']) . ')', $top));

        $base = [
            'avg_daily_revenue' => round($avgDaily, 2),
            'total_revenue'     => round($totalRevenue, 2),
            'total_orders'      => $totalOrders,
            'top_products'      => array_map(fn ($p) => ['name' => $p['name'], 'qty' => (int) $p['qty'], 'revenue' => round((float) $p['rev'], 2)], $top),
        ];
        if (!Ai::available()) {
            Response::json(['insight' => ''] + $base);
        }
        $prompt = "Shop: $shopName ($shopCategory category)\n"
            . "Period: Last $daysBack days\n"
            . 'Total revenue: ₹' . round($totalRevenue) . " | Total orders: $totalOrders | Active days: $activeDays\n"
            . 'Avg daily revenue: ₹' . round($avgDaily) . "\n"
            . 'Daily breakdown (recent 14 days): ' . ($dailyData ?: 'No sales data yet') . "\n"
            . 'Top products: ' . ($topProds ?: 'No data yet') . "\n\n"
            . "Based on this REAL data, write 3-4 sentences:\n"
            . "1. Summarize the sales trend (growing/stable/declining)\n"
            . "2. Identify peak days or patterns\n"
            . "3. Forecast next 7 days and suggest what to stock up on\n"
            . 'Be specific with numbers from the data. If no data, say so honestly.';
        $system = "You are a data-driven sales analyst for \"$shopName\", a $shopCategory shop in India.";
        try {
            $text = Ai::complete($prompt, $system, 300);
            Response::json(['insight' => $text] + $base);
        } catch (Throwable $e) {
            Response::json(['insight' => ''] + $base);
        }
    }

    public static function chat(array $p): void
    {
        $b = Request::body();
        $message = (string) ($b['message'] ?? '');
        $role = (string) ($b['role'] ?? 'customer');
        $shopId = $b['shop_id'] ?? null;
        $history = is_array($b['history'] ?? null) ? $b['history'] : [];

        $formatting = "\n\nFormatting rules: Be VERY concise (under 80 words). "
            . 'For product lists use compact format: **Name** ₹price (no stock/shop unless asked). '
            . 'Use short bullet points, not numbered lists. Never repeat metadata the user didn\'t ask for. '
            . 'Never use tables or code blocks. No filler sentences. Get straight to the answer.';
        $prompts = [
            'customer' => 'You are HyperShopIndia Assistant, a friendly shopping helper for a hyperlocal grocery marketplace in India. Help customers find products, compare shops, track orders, and get shopping advice. Use ₹ for prices. Be warm and helpful. USE THE TOOLS to look up real-time product availability, prices, and shop info — never guess prices or stock levels.',
            'owner'    => 'You are HyperShopIndia Business Assistant for shop owners. Help with inventory, pricing, sales analysis, and growth tips. USE THE TOOLS to fetch real sales data, stock levels, and order info — give advice based on actual numbers, not guesses.',
            'admin'    => 'You are HyperShopIndia Admin Assistant. Help with platform governance, approvals, and analytics. USE THE TOOLS to get real platform stats and shop data.',
        ];
        $system = ($prompts[$role] ?? 'You are a helpful assistant for the HyperShopIndia marketplace.') . $formatting;
        if ($shopId) {
            $system .= "\nThe user is currently on shop ID " . (int) $shopId . '.';
        }

        if (!Ai::available()) {
            Response::json(['reply' => 'AI is not configured. Please set OPENAI_API_KEY.', 'tools_used' => [], 'sources' => []]);
        }

        $messages = [['role' => 'system', 'content' => $system]];
        foreach (array_slice($history, -10) as $msg) {
            $r = ($msg['role'] ?? '') === 'user' ? 'user' : 'assistant';
            $messages[] = ['role' => $r, 'content' => (string) ($msg['content'] ?? '')];
        }
        $messages[] = ['role' => 'user', 'content' => $message];

        $tools = Ai::roleTools($role);
        $toolsUsed = [];
        $sources = [];
        $maxRounds = 3;

        try {
            for ($i = 0; $i <= $maxRounds; $i++) {
                $json = Ai::post([
                    'model'       => Ai::model(),
                    'messages'    => $messages,
                    'max_tokens'  => 512,
                    'temperature' => 0.7,
                    'tools'       => $tools,
                    'tool_choice' => 'auto',
                ]);
                $msg = $json['choices'][0]['message'] ?? [];
                if (!empty($msg['tool_calls'])) {
                    $messages[] = $msg;
                    foreach ($msg['tool_calls'] as $tc) {
                        $fnName = $tc['function']['name'] ?? '';
                        $fnArgs = json_decode($tc['function']['arguments'] ?? '{}', true) ?: [];
                        $result = Ai::executeTool($fnName, $fnArgs);
                        $toolsUsed[] = $fnName;
                        $sources[] = ['tool' => $fnName, 'args' => $fnArgs, 'summary' => substr($result, 0, 100)];
                        $messages[] = ['role' => 'tool', 'tool_call_id' => $tc['id'], 'content' => $result];
                    }
                    continue;
                }
                $reply = trim($msg['content'] ?? '');
                Response::json(['reply' => $reply, 'tools_used' => $toolsUsed, 'sources' => $sources]);
            }
            Response::json([
                'reply' => "I gathered some information but couldn't complete the analysis. Please try again.",
                'tools_used' => $toolsUsed, 'sources' => $sources,
            ]);
        } catch (Throwable $e) {
            Response::json(['reply' => "I'm having trouble connecting right now. Please try again shortly.", 'tools_used' => [], 'sources' => []]);
        }
    }
}
