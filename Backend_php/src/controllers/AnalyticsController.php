<?php
/**
 * Analytics — platform stats, per-shop analytics, date-range reports + CSV.
 */
class AnalyticsController
{
    private const MONTH_ABBR = [
        '01' => 'Jan', '02' => 'Feb', '03' => 'Mar', '04' => 'Apr',
        '05' => 'May', '06' => 'Jun', '07' => 'Jul', '08' => 'Aug',
        '09' => 'Sep', '10' => 'Oct', '11' => 'Nov', '12' => 'Dec',
    ];

    public static function register(Router $r): void
    {
        $r->get('/analytics/platform',       [self::class, 'platform']);
        $r->get('/shops/{shop_id}/analytics', [self::class, 'shop']);
        $r->get('/shops/{shop_id}/reports/csv', [self::class, 'reportsCsv']);  // before /reports
        $r->get('/shops/{shop_id}/reports',   [self::class, 'reports']);
    }

    public static function platform(array $p): void
    {
        Auth::requireRole('admin');
        $deliveredRev = (float) (Database::scalar("SELECT SUM(total) FROM orders WHERE status = 'delivered'") ?? 0);
        $totalRev     = (float) (Database::scalar('SELECT SUM(total) FROM orders') ?? 0);
        $activeSubs   = (int) Database::scalar("SELECT COUNT(*) FROM subscriptions WHERE status = 'active'");

        $ordersByStatus = [];
        foreach (Database::all('SELECT status, COUNT(*) c FROM orders GROUP BY status') as $row) {
            $ordersByStatus[$row['status']] = (int) $row['c'];
        }
        $shopsByCategory = [];
        foreach (Database::all('SELECT category, COUNT(*) c FROM shops GROUP BY category') as $row) {
            $shopsByCategory[Enums::catKeyToValue($row['category'])] = (int) $row['c'];
        }
        $topShops = [];
        foreach (Database::all(
            "SELECT shop_id, shop_name, SUM(total) revenue, COUNT(*) order_count
             FROM orders WHERE status = 'delivered'
             GROUP BY shop_id, shop_name ORDER BY revenue DESC LIMIT 10"
        ) as $row) {
            $topShops[] = [
                'shop_id'     => (int) $row['shop_id'],
                'shop_name'   => $row['shop_name'],
                'revenue'     => round((float) $row['revenue'], 2),
                'order_count' => (int) $row['order_count'],
            ];
        }

        Response::json([
            'total_shops'          => (int) Database::scalar('SELECT COUNT(*) FROM shops'),
            'approved_shops'       => (int) Database::scalar("SELECT COUNT(*) FROM shops WHERE status = 'approved'"),
            'pending_shops'        => (int) Database::scalar("SELECT COUNT(*) FROM shops WHERE status = 'pending'"),
            'total_users'          => (int) Database::scalar('SELECT COUNT(*) FROM users'),
            'total_owners'         => (int) Database::scalar("SELECT COUNT(*) FROM users WHERE role = 'owner'"),
            'total_orders'         => (int) Database::scalar('SELECT COUNT(*) FROM orders'),
            'total_revenue'        => round($totalRev, 2),
            'delivered_revenue'    => round($deliveredRev, 2),
            'active_subscriptions' => $activeSubs,
            'orders_by_status'     => (object) $ordersByStatus,
            'shops_by_category'    => (object) $shopsByCategory,
            'top_shops'            => $topShops,
        ]);
    }

    public static function shop(array $p): void
    {
        $user = Auth::requireUser();
        $shop = ShopController::find($p['shop_id']);
        Auth::assertShopOwnership($shop, $user);
        $shopId = (int) $shop['id'];

        $today = gmdate('Y-m-d');
        $sevenAgo = gmdate('Y-m-d', strtotime('-6 days'));
        $sixMonthsAgo = gmdate('Y-m-d H:i:s', strtotime('-180 days'));

        $todaySales = (float) (Database::scalar(
            'SELECT SUM(total) FROM orders WHERE shop_id = :s AND DATE(created_at) = :d',
            ['s' => $shopId, 'd' => $today]
        ) ?? 0);
        $todayOrders = (int) Database::scalar(
            'SELECT COUNT(*) FROM orders WHERE shop_id = :s AND DATE(created_at) = :d',
            ['s' => $shopId, 'd' => $today]
        );

        $lowStock = [];
        foreach (Database::all(
            "SELECT name, stock FROM products WHERE shop_id = :s AND stock <= 5 AND status = 'active'",
            ['s' => $shopId]
        ) as $row) {
            $lowStock[] = ['name' => $row['name'], 'stock' => (int) $row['stock']];
        }

        // Daily sales — last 7 days, gaps filled
        $dayMap = [];
        foreach (Database::all(
            'SELECT DATE(created_at) day, SUM(total) revenue FROM orders
             WHERE shop_id = :s AND DATE(created_at) >= :d GROUP BY DATE(created_at)',
            ['s' => $shopId, 'd' => $sevenAgo]
        ) as $row) {
            $dayMap[$row['day']] = round((float) $row['revenue'], 2);
        }
        $dailySales = [];
        for ($i = 6; $i >= 0; $i--) {
            $d = gmdate('Y-m-d', strtotime("-$i days"));
            $dailySales[] = ['day' => gmdate('D', strtotime($d)), 'revenue' => $dayMap[$d] ?? 0.0];
        }

        // Category revenue (delivered)
        $categoryRevenue = [];
        foreach (Database::all(
            "SELECT p.category, SUM(oi.price * oi.quantity) revenue
             FROM order_items oi JOIN products p ON p.id = oi.product_id
             JOIN orders o ON o.id = oi.order_id
             WHERE o.shop_id = :s AND o.status = 'delivered'
             GROUP BY p.category ORDER BY revenue DESC",
            ['s' => $shopId]
        ) as $row) {
            $categoryRevenue[] = ['category' => Enums::catKeyToValue($row['category']), 'revenue' => round((float) $row['revenue'], 2)];
        }

        // Top 10 products by quantity
        $topProducts = [];
        foreach (Database::all(
            'SELECT oi.product_id, oi.name, SUM(oi.quantity) qty, SUM(oi.price * oi.quantity) revenue
             FROM order_items oi JOIN orders o ON o.id = oi.order_id
             WHERE o.shop_id = :s GROUP BY oi.product_id, oi.name ORDER BY qty DESC LIMIT 10',
            ['s' => $shopId]
        ) as $row) {
            $topProducts[] = [
                'product_id'    => (int) $row['product_id'],
                'name'          => $row['name'],
                'quantity_sold' => (int) $row['qty'],
                'revenue'       => round((float) $row['revenue'], 2),
            ];
        }

        // Monthly revenue — last 6 months
        $monthlyRevenue = [];
        foreach (Database::all(
            "SELECT DATE_FORMAT(created_at, '%Y-%m') ym, SUM(total) revenue FROM orders
             WHERE shop_id = :s AND created_at >= :d GROUP BY ym ORDER BY ym",
            ['s' => $shopId, 'd' => $sixMonthsAgo]
        ) as $row) {
            $mm = explode('-', $row['ym'])[1] ?? '';
            $monthlyRevenue[] = ['month' => self::MONTH_ABBR[$mm] ?? $row['ym'], 'revenue' => round((float) $row['revenue'], 2)];
        }

        // Orders by status
        $ordersByStatus = [];
        foreach (Database::all('SELECT status, COUNT(*) c FROM orders WHERE shop_id = :s GROUP BY status', ['s' => $shopId]) as $row) {
            $ordersByStatus[$row['status']] = (int) $row['c'];
        }

        // Monthly daily sales — every day of current month, split walk-in/online
        $monthStart = gmdate('Y-m-01');
        $mdsMap = [];
        foreach (Database::all(
            'SELECT DATE(created_at) day, order_type, SUM(total) revenue, COUNT(*) cnt FROM orders
             WHERE shop_id = :s AND DATE(created_at) >= :ms AND DATE(created_at) <= :me
             GROUP BY DATE(created_at), order_type',
            ['s' => $shopId, 'ms' => $monthStart, 'me' => $today]
        ) as $row) {
            $d = $row['day'];
            if (!isset($mdsMap[$d])) {
                $mdsMap[$d] = ['date' => $d, 'revenue' => 0.0, 'walk_in' => 0.0, 'online' => 0.0, 'orders' => 0];
            }
            $rev = round((float) $row['revenue'], 2);
            $mdsMap[$d]['revenue'] += $rev;
            $mdsMap[$d]['orders']  += (int) $row['cnt'];
            if (($row['order_type'] ?? 'online') === 'walkin') {
                $mdsMap[$d]['walk_in'] += $rev;
            } else {
                $mdsMap[$d]['online'] += $rev;
            }
        }
        $monthlyDailySales = [];
        $cur = strtotime($monthStart);
        $end = strtotime($today);
        while ($cur <= $end) {
            $d = gmdate('Y-m-d', $cur);
            $monthlyDailySales[] = $mdsMap[$d] ?? ['date' => $d, 'revenue' => 0.0, 'walk_in' => 0.0, 'online' => 0.0, 'orders' => 0];
            $cur += 86400;
        }

        Response::json([
            'today_sales'         => round($todaySales, 2),
            'today_orders'        => $todayOrders,
            'total_products'      => (int) Database::scalar('SELECT COUNT(*) FROM products WHERE shop_id = :s', ['s' => $shopId]),
            'low_stock_items'     => $lowStock,
            'daily_sales'         => $dailySales,
            'category_revenue'    => $categoryRevenue,
            'top_products'        => $topProducts,
            'monthly_revenue'     => $monthlyRevenue,
            'orders_by_status'    => (object) $ordersByStatus,
            'monthly_daily_sales' => $monthlyDailySales,
        ]);
    }

    public static function reports(array $p): void
    {
        $user = Auth::requireUser();
        $shop = ShopController::find($p['shop_id']);
        Auth::assertShopOwnership($shop, $user);
        $shopId = (int) $shop['id'];
        $dateFrom = Request::query('date_from') ?: gmdate('Y-m-d');
        $dateTo   = Request::query('date_to') ?: gmdate('Y-m-d');

        $params = ['s' => $shopId, 'df' => $dateFrom, 'dt' => $dateTo];
        $base = "FROM orders WHERE shop_id = :s AND status = 'delivered'
                 AND DATE(created_at) >= :df AND DATE(created_at) <= :dt";

        $totalRevenue = (float) (Database::scalar("SELECT SUM(total) $base", $params) ?? 0);
        $totalOrders  = (int) Database::scalar("SELECT COUNT(*) $base", $params);
        $avg = $totalOrders ? round($totalRevenue / $totalOrders, 2) : 0;
        $walkIn = (float) (Database::scalar("SELECT SUM(total) $base AND order_type = 'walkin'", $params) ?? 0);
        $online = (float) (Database::scalar("SELECT SUM(total) $base AND order_type = 'online'", $params) ?? 0);

        $dailySales = [];
        foreach (Database::all(
            "SELECT DATE(created_at) day, SUM(total) revenue $base GROUP BY DATE(created_at) ORDER BY day",
            $params
        ) as $row) {
            $dailySales[] = ['day' => $row['day'], 'revenue' => round((float) $row['revenue'], 2)];
        }

        $categoryRevenue = [];
        foreach (Database::all(
            "SELECT p.category, SUM(oi.price * oi.quantity) revenue
             FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN products p ON p.id = oi.product_id
             WHERE o.shop_id = :s AND o.status = 'delivered'
             AND DATE(o.created_at) >= :df AND DATE(o.created_at) <= :dt
             GROUP BY p.category",
            $params
        ) as $row) {
            $categoryRevenue[] = ['category' => Enums::catKeyToValue($row['category']), 'revenue' => round((float) $row['revenue'], 2)];
        }

        $topProducts = [];
        foreach (Database::all(
            "SELECT oi.name, SUM(oi.quantity) qty, SUM(oi.price * oi.quantity) revenue
             FROM order_items oi JOIN orders o ON o.id = oi.order_id
             WHERE o.shop_id = :s AND o.status = 'delivered'
             AND DATE(o.created_at) >= :df AND DATE(o.created_at) <= :dt
             GROUP BY oi.name ORDER BY qty DESC LIMIT 10",
            $params
        ) as $row) {
            $topProducts[] = ['name' => $row['name'], 'qty' => (int) $row['qty'], 'revenue' => round((float) $row['revenue'], 2)];
        }

        Response::json([
            'date_from'        => $dateFrom,
            'date_to'          => $dateTo,
            'total_revenue'    => round($totalRevenue, 2),
            'total_orders'     => $totalOrders,
            'avg_order_value'  => $avg,
            'walk_in_total'    => round($walkIn, 2),
            'online_total'     => round($online, 2),
            'daily_sales'      => $dailySales,
            'category_revenue' => $categoryRevenue,
            'top_products'     => $topProducts,
        ]);
    }

    public static function reportsCsv(array $p): void
    {
        $user = Auth::requireUser();
        $shop = ShopController::find($p['shop_id']);
        Auth::assertShopOwnership($shop, $user);
        $shopId = (int) $shop['id'];
        $dateFrom = Request::query('date_from');
        $dateTo   = Request::query('date_to');
        if (!$dateFrom || !$dateTo) {
            throw new ApiException(422, 'date_from and date_to are required');
        }
        $orders = Database::all(
            "SELECT * FROM orders WHERE shop_id = :s AND status = 'delivered'
             AND DATE(created_at) >= :df AND DATE(created_at) <= :dt ORDER BY id",
            ['s' => $shopId, 'df' => $dateFrom, 'dt' => $dateTo]
        );

        $fname = "hypermart-$shopId-$dateFrom-$dateTo.csv";
        http_response_code(200);
        header('Content-Type: text/csv');
        header("Content-Disposition: attachment; filename=$fname");
        $out = fopen('php://output', 'w');
        fputcsv($out, ['Order ID', 'Date', 'Items', 'Total', 'Payment Status']);
        foreach ($orders as $o) {
            $items = Database::all('SELECT name, quantity FROM order_items WHERE order_id = :o', ['o' => $o['id']]);
            $itemsStr = implode(' | ', array_map(fn ($i) => "{$i['name']} x{$i['quantity']}", $items));
            fputcsv($out, [$o['id'], gmdate('d/m/Y', strtotime($o['created_at'])), $itemsStr, $o['total'], $o['payment_status']]);
        }
        fclose($out);
        exit;
    }
}
