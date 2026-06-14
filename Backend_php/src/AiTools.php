<?php
/**
 * AI helpers — OpenAI-compatible chat-completions calls (cURL), the 10 DB-backed
 * function-calling tools, role filtering, and category keyword resolution.
 * Mirrors backend/ai.py. Works with OpenAI or OpenRouter (set OPENROUTER_API_KEY).
 */
class Ai
{
    /** OpenRouter key takes precedence over OpenAI; either enables AI. */
    public static function key(): string
    {
        return env('OPENROUTER_API_KEY', '') ?: env('OPENAI_API_KEY', '');
    }

    private static function usingOpenRouter(): bool
    {
        return env('OPENROUTER_API_KEY', '') !== '';
    }

    /** Chat-completions endpoint. Override with AI_BASE_URL if needed. */
    public static function url(): string
    {
        $base = env('AI_BASE_URL', '');
        if ($base !== '') {
            return rtrim($base, '/') . '/chat/completions';
        }
        return self::usingOpenRouter()
            ? 'https://openrouter.ai/api/v1/chat/completions'
            : 'https://api.openai.com/v1/chat/completions';
    }

    public static function model(): string
    {
        // OpenRouter needs vendor-prefixed model ids (e.g. openai/gpt-4o-mini).
        $default = self::usingOpenRouter() ? 'openai/gpt-4o-mini' : 'gpt-4o-mini';
        return env('OPENAI_MODEL', $default);
    }

    public static function available(): bool { return self::key() !== ''; }

    private static function headers(): array
    {
        $h = [
            'Authorization: Bearer ' . self::key(),
            'Content-Type: application/json',
        ];
        if (self::usingOpenRouter()) {
            // OpenRouter attribution headers (optional but recommended).
            $h[] = 'HTTP-Referer: ' . env('APP_URL', 'https://hypershopindia.com');
            $h[] = 'X-Title: HyperShopIndia';
        }
        return $h;
    }

    /** Raw POST to the chat-completions API; returns decoded JSON (throws on error). */
    public static function post(array $payload): array
    {
        $ch = curl_init(self::url());
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_HTTPHEADER     => self::headers(),
            CURLOPT_POSTFIELDS     => json_encode($payload),
            CURLOPT_TIMEOUT        => 45,
        ]);
        $resp = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($resp === false || $code >= 400) {
            throw new RuntimeException('AI request failed (HTTP ' . $code . ')');
        }
        return json_decode($resp, true) ?: [];
    }

    /** Single-shot prompt → response text. */
    public static function complete(string $prompt, string $system = '', int $maxTokens = 512, float $temp = 0.7): string
    {
        $messages = [];
        if ($system !== '') $messages[] = ['role' => 'system', 'content' => $system];
        $messages[] = ['role' => 'user', 'content' => $prompt];
        $json = self::post([
            'model'       => self::model(),
            'messages'    => $messages,
            'max_tokens'  => $maxTokens,
            'temperature' => $temp,
        ]);
        return trim($json['choices'][0]['message']['content'] ?? '');
    }

    public static function resolveCategory(?string $text): ?string
    {
        if (!$text) return null;
        $map = [
            'fruit' => 'vegetables', 'fruits' => 'vegetables', 'vegetable' => 'vegetables',
            'vegetables' => 'vegetables', 'veggie' => 'vegetables', 'veggies' => 'vegetables',
            'dairy' => 'dairy', 'milk' => 'dairy',
            'grocery' => 'grocery', 'groceries' => 'grocery',
            'bakery' => 'bakery', 'bread' => 'bakery', 'snacks' => 'bakery', 'cake' => 'bakery',
            'beverages' => 'beverages', 'drinks' => 'beverages', 'juice' => 'beverages',
            'tea' => 'beverages', 'coffee' => 'beverages',
            'meat' => 'meat', 'chicken' => 'meat', 'fish' => 'meat',
            'household' => 'household', 'cleaning' => 'household',
            'personal' => 'personal_care', 'personal care' => 'personal_care',
        ];
        return $map[strtolower(trim($text))] ?? null;
    }

    public static function tools(): array
    {
        return [
            self::tool('search_products', 'Search for products across all shops by name, category, or keyword. Matches against product name, category name, and description. Returns matching products with price, stock, and shop info.', [
                'query'    => ['type' => 'string', 'description' => "Product name, category, or keyword to search (e.g. 'milk', 'fruits', 'snacks', 'rice')"],
                'category' => ['type' => 'string', 'description' => 'Optional exact category filter: Grocery, Dairy, Vegetables & Fruits, Meat, Bakery & Snacks, Beverages, Household, Personal Care'],
            ], ['query']),
            self::tool('get_shop_products', 'Get product list and inventory for a specific shop. Shows prices, stock levels, and categories.', [
                'shop_id' => ['type' => 'integer', 'description' => 'Shop ID'],
            ], ['shop_id']),
            self::tool('get_shop_info', 'Get details about a specific shop including name, category, location, rating, delivery radius, and open/closed status.', [
                'shop_id' => ['type' => 'integer', 'description' => 'Shop ID'],
            ], ['shop_id']),
            self::tool('list_shops', 'List available shops on the platform. Can filter by location or category.', [
                'location' => ['type' => 'string', 'description' => 'Optional location filter'],
                'category' => ['type' => 'string', 'description' => 'Optional category filter'],
            ], []),
            self::tool('get_sales_summary', 'Get sales analytics for a shop: revenue, order count, top products, daily trends. Only for shop owners.', [
                'shop_id' => ['type' => 'integer', 'description' => 'Shop ID'],
                'days'    => ['type' => 'integer', 'description' => 'Number of days to look back (default 7)'],
            ], ['shop_id']),
            self::tool('get_low_stock_items', 'Get list of products that are low on stock for a shop. Only for shop owners.', [
                'shop_id' => ['type' => 'integer', 'description' => 'Shop ID'],
            ], ['shop_id']),
            self::tool('get_order_status', 'Check the status of an order by order ID. Returns status, items, total, and payment info.', [
                'order_id' => ['type' => 'integer', 'description' => 'Order ID to look up'],
            ], ['order_id']),
            self::tool('get_platform_stats', 'Get platform-wide statistics: total shops, users, orders, revenue. Only for admins.', [], []),
            self::tool('get_popular_products', 'Get the most popular/trending/best-selling products based on actual recent sales data. Use this when the user asks for popular, trending, best-selling, or recommended products.', [
                'days'     => ['type' => 'integer', 'description' => 'Look back period in days (default 30)'],
                'category' => ['type' => 'string', 'description' => 'Optional category filter'],
                'limit'    => ['type' => 'integer', 'description' => 'Max results (default 10)'],
            ], []),
            self::tool('get_all_products', "Get all available products across all shops, optionally filtered by category. Use when user wants to browse or asks 'what do you have'. Returns products with prices and stock.", [
                'category' => ['type' => 'string', 'description' => 'Optional category: Grocery, Dairy, Vegetables & Fruits, Meat, Bakery & Snacks, Beverages, Household, Personal Care'],
            ], []),
        ];
    }

    private static function tool(string $name, string $desc, array $props, array $required): array
    {
        $params = ['type' => 'object', 'properties' => (object) $props];
        if ($required) $params['required'] = $required;
        return ['type' => 'function', 'function' => ['name' => $name, 'description' => $desc, 'parameters' => $params]];
    }

    public static function roleTools(string $role): array
    {
        $map = [
            'customer' => ['search_products', 'get_popular_products', 'get_all_products', 'get_shop_info', 'list_shops', 'get_order_status'],
            'owner'    => ['search_products', 'get_popular_products', 'get_all_products', 'get_shop_products', 'get_shop_info', 'get_sales_summary', 'get_low_stock_items', 'get_order_status'],
            'admin'    => ['list_shops', 'get_shop_info', 'get_platform_stats', 'get_order_status', 'search_products', 'get_popular_products'],
        ];
        $allowed = $map[$role] ?? ['search_products', 'get_popular_products', 'list_shops'];
        return array_values(array_filter(self::tools(), fn ($t) => in_array($t['function']['name'], $allowed, true)));
    }

    /** Execute a tool call, returning a human-readable string (mirrors ai.py). */
    public static function executeTool(string $name, array $args): string
    {
        try {
            switch ($name) {
                case 'search_products':
                    $query = (string) ($args['query'] ?? '');
                    $cat = $args['category'] ?? null;
                    $conds = ['p.name LIKE :like'];
                    $params = ['like' => "%$query%"];
                    $matchedCat = self::resolveCategory($query);
                    if ($matchedCat) { $conds[] = 'p.category = :mc'; $params['mc'] = $matchedCat; }
                    $where = "s.status = 'approved' AND p.status = 'active' AND (" . implode(' OR ', $conds) . ')';
                    if ($cat) {
                        $catEnum = self::resolveCategory($cat);
                        if ($catEnum) { $where .= ' AND p.category = :cat'; $params['cat'] = $catEnum; }
                    }
                    $rows = Database::all("SELECT p.*, s.name shop_name FROM products p JOIN shops s ON p.shop_id = s.id WHERE $where ORDER BY p.name LIMIT 12", $params);
                    if (!$rows) return "No products found matching '$query'. Try 'milk', 'rice', 'vegetables', 'dairy', 'snacks'.";
                    $lines = [];
                    foreach ($rows as $p) {
                        $stock = ((int) $p['stock'] > 0) ? "In stock ({$p['stock']})" : 'Out of stock';
                        $lines[] = "- **{$p['name']}** — ₹{$p['price']}/{$p['unit']} | $stock | Shop: {$p['shop_name']} (ID:{$p['shop_id']})";
                    }
                    return 'Found ' . count($rows) . " products:\n" . implode("\n", $lines);

                case 'get_shop_products':
                    $shopId = (int) ($args['shop_id'] ?? 0);
                    $rows = Database::all("SELECT * FROM products WHERE shop_id = :s AND status = 'active' ORDER BY name LIMIT 30", ['s' => $shopId]);
                    if (!$rows) return "No active products found for shop #$shopId.";
                    $lines = array_map(fn ($p) => "- {$p['name']}: ₹{$p['price']}/{$p['unit']} | Stock: {$p['stock']}", $rows);
                    return count($rows) . " products in shop #$shopId:\n" . implode("\n", $lines);

                case 'get_shop_info':
                    $shopId = (int) ($args['shop_id'] ?? 0);
                    $s = Database::one('SELECT * FROM shops WHERE id = :s', ['s' => $shopId]);
                    if (!$s) return "Shop #$shopId not found.";
                    $cat = Enums::catKeyToValue($s['category']);
                    $loc = Enums::locKeyToValue($s['location_name']);
                    return "**{$s['name']}** ($cat)\n"
                        . "Location: $loc | Address: " . ($s['address'] ?: 'N/A') . "\n"
                        . 'Rating: ' . ($s['rating'] ?: 'N/A') . ' (' . ((int) $s['review_count']) . " reviews)\n"
                        . 'Status: ' . ($s['status'] === 'approved' ? 'Open' : 'Closed') . ' | Delivery: ' . ($s['delivery_radius'] ?: 'N/A') . " km\n"
                        . 'UPI: ' . ($s['upi_id'] ? 'Yes' : 'No');

                case 'list_shops':
                    $where = "status = 'approved'";
                    $params = [];
                    if (!empty($args['location'])) {
                        $locKey = Enums::locValueToKey($args['location']);
                        if ($locKey) { $where .= ' AND location_name = :loc'; $params['loc'] = $locKey; }
                        else { $where .= ' AND location_name LIKE :loc'; $params['loc'] = '%' . $args['location'] . '%'; }
                    }
                    if (!empty($args['category'])) {
                        $catKey = self::resolveCategory($args['category']) ?? Enums::catValueToKey($args['category']);
                        if ($catKey) { $where .= ' AND category = :cat'; $params['cat'] = $catKey; }
                        else { $where .= ' AND category LIKE :cat'; $params['cat'] = '%' . $args['category'] . '%'; }
                    }
                    $rows = Database::all("SELECT * FROM shops WHERE $where LIMIT 15", $params);
                    if (!$rows) return 'No shops found matching your criteria.';
                    $lines = array_map(fn ($s) => "- **{$s['name']}** (ID:{$s['id']}) — " . Enums::catKeyToValue($s['category']) . ', ' . Enums::locKeyToValue($s['location_name']) . ' | Rating: ' . ($s['rating'] ?: 'N/A'), $rows);
                    return count($rows) . " shops:\n" . implode("\n", $lines);

                case 'get_sales_summary':
                    $shopId = (int) ($args['shop_id'] ?? 0);
                    $days = (int) ($args['days'] ?? 7);
                    $cutoff = gmdate('Y-m-d H:i:s', strtotime("-$days days"));
                    $orders = Database::all("SELECT total FROM orders WHERE shop_id = :s AND created_at >= :c AND status != 'rejected'", ['s' => $shopId, 'c' => $cutoff]);
                    $totalRev = array_sum(array_map(fn ($o) => (float) $o['total'], $orders));
                    $top = Database::all("SELECT oi.name, SUM(oi.quantity) qty FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.shop_id = :s AND o.created_at >= :c GROUP BY oi.name ORDER BY qty DESC LIMIT 5", ['s' => $shopId, 'c' => $cutoff]);
                    $topStr = $top ? implode(', ', array_map(fn ($t) => "{$t['name']} ({$t['qty']} sold)", $top)) : 'None';
                    $cnt = count($orders);
                    $avg = $cnt ? round($totalRev / $cnt) : 0;
                    return "Last $days days for shop #$shopId:\n- Orders: $cnt | Revenue: ₹" . round($totalRev) . "\n- Avg order: ₹$avg\n- Top products: $topStr";

                case 'get_low_stock_items':
                    $shopId = (int) ($args['shop_id'] ?? 0);
                    $low = Database::all("SELECT * FROM products WHERE shop_id = :s AND status = 'active' AND stock <= low_stock_threshold", ['s' => $shopId]);
                    if (!$low) return "All products in shop #$shopId are well-stocked.";
                    $lines = array_map(fn ($p) => "- **{$p['name']}**: {$p['stock']} left (threshold: {$p['low_stock_threshold']})", $low);
                    return count($low) . " low-stock items:\n" . implode("\n", $lines);

                case 'get_order_status':
                    $orderId = (int) ($args['order_id'] ?? 0);
                    $order = Database::one('SELECT * FROM orders WHERE id = :id', ['id' => $orderId]);
                    if (!$order) return "Order #$orderId not found.";
                    $items = Database::all('SELECT name, quantity FROM order_items WHERE order_id = :o', ['o' => $orderId]);
                    $itemsStr = implode(', ', array_map(fn ($i) => "{$i['name']} x{$i['quantity']}", $items));
                    return "Order #{$order['id']} — **{$order['status']}**\n"
                        . "Shop: {$order['shop_name']} | Total: ₹{$order['total']}\n"
                        . 'Payment: ' . ($order['payment_method'] ?: 'cash') . " ({$order['payment_status']})\n"
                        . "Items: $itemsStr\n"
                        . 'Placed: ' . gmdate('d M Y, h:i A', strtotime($order['created_at']));

                case 'get_platform_stats':
                    $totalShops = (int) Database::scalar('SELECT COUNT(*) FROM shops');
                    $approved = (int) Database::scalar("SELECT COUNT(*) FROM shops WHERE status = 'approved'");
                    $pending = (int) Database::scalar("SELECT COUNT(*) FROM shops WHERE status = 'pending'");
                    $totalUsers = (int) Database::scalar('SELECT COUNT(*) FROM users');
                    $totalOrders = (int) Database::scalar('SELECT COUNT(*) FROM orders');
                    $totalRev = (float) (Database::scalar('SELECT SUM(total) FROM orders') ?? 0);
                    return "Platform stats:\n- Shops: $totalShops ($approved approved, $pending pending)\n- Users: $totalUsers\n- Orders: $totalOrders | Total revenue: ₹" . round($totalRev);

                case 'get_popular_products':
                    $days = (int) ($args['days'] ?? 30);
                    $cat = $args['category'] ?? null;
                    $limit = (int) ($args['limit'] ?? 10);
                    $cutoff = gmdate('Y-m-d H:i:s', strtotime("-$days days"));
                    $where = "o.created_at >= :c AND o.status != 'rejected'";
                    $params = ['c' => $cutoff];
                    if ($cat) {
                        $catEnum = self::resolveCategory($cat);
                        if ($catEnum) { $where .= ' AND p.category = :cat'; $params['cat'] = $catEnum; }
                    }
                    $rows = Database::all(
                        "SELECT oi.name, oi.price, SUM(oi.quantity) total_sold, p.stock, p.unit, p.shop_id, s.name shop_name
                         FROM order_items oi JOIN orders o ON oi.order_id = o.id
                         LEFT JOIN products p ON oi.product_id = p.id
                         LEFT JOIN shops s ON o.shop_id = s.id
                         WHERE $where GROUP BY oi.name, oi.price, p.stock, p.unit, p.shop_id, s.name
                         ORDER BY total_sold DESC LIMIT $limit",
                        $params
                    );
                    if (!$rows) {
                        $prods = Database::all("SELECT p.*, s.name shop_name FROM products p JOIN shops s ON p.shop_id = s.id WHERE s.status = 'approved' AND p.status = 'active' LIMIT $limit");
                        if (!$prods) return 'No products or sales data available yet.';
                        $lines = array_map(fn ($p) => "- **{$p['name']}** — ₹{$p['price']}/{$p['unit']} | Stock: {$p['stock']} | {$p['shop_name']}", $prods);
                        return 'No sales data yet, but here are ' . count($prods) . " available products:\n" . implode("\n", $lines);
                    }
                    $lines = [];
                    foreach ($rows as $p) {
                        $stockStr = $p['stock'] !== null ? "Stock: {$p['stock']}" : '';
                        $lines[] = "- **{$p['name']}** — ₹{$p['price']}/" . ($p['unit'] ?: 'unit') . " | {$p['total_sold']} sold | {$p['shop_name']} $stockStr";
                    }
                    return 'Top ' . count($rows) . " products (last $days days by sales):\n" . implode("\n", $lines);

                case 'get_all_products':
                    $cat = $args['category'] ?? null;
                    $where = "s.status = 'approved' AND p.status = 'active'";
                    $params = [];
                    if ($cat) {
                        $catEnum = self::resolveCategory($cat);
                        if ($catEnum) { $where .= ' AND p.category = :cat'; $params['cat'] = $catEnum; }
                    }
                    $rows = Database::all("SELECT p.*, s.name shop_name FROM products p JOIN shops s ON p.shop_id = s.id WHERE $where ORDER BY p.name LIMIT 20", $params);
                    $suffix = $cat ? " in $cat" : '';
                    if (!$rows) return "No products found$suffix.";
                    $lines = array_map(fn ($p) => "- **{$p['name']}** — ₹{$p['price']}/{$p['unit']} | Stock: {$p['stock']} | {$p['shop_name']}", $rows);
                    return count($rows) . " products$suffix:\n" . implode("\n", $lines);
            }
            return "Unknown tool: $name";
        } catch (Throwable $e) {
            return 'Tool error: ' . $e->getMessage();
        }
    }
}
