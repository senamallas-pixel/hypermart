<?php
/**
 * Orders: place, list, status transitions, walk-in (POS), cancel, payment-status.
 */
class OrderController
{
    private const TRANSITIONS = [
        'pending'          => ['accepted', 'rejected'],
        'accepted'         => ['ready', 'rejected'],
        'ready'            => ['out_for_delivery'],
        'out_for_delivery' => ['delivered'],
        'delivered'        => [],
        'rejected'         => [],
    ];

    public static function register(Router $r): void
    {
        $r->post('/orders',                  [self::class, 'place']);
        $r->get('/orders/me',                [self::class, 'myOrders']);
        $r->get('/shops/{shop_id}/orders',   [self::class, 'shopOrders']);
        $r->post('/shops/{shop_id}/walkin-order', [self::class, 'walkin']);
        $r->patch('/orders/{order_id}/status', [self::class, 'updateStatus']);
        $r->post('/orders/{order_id}/cancel', [self::class, 'cancel']);
        $r->get('/orders/{order_id}/payment-status',   [self::class, 'getPaymentStatus']);
        $r->patch('/orders/{order_id}/payment-status', [self::class, 'setPaymentStatus']);
    }

    public static function place(array $p): void
    {
        $user = Auth::requireRole('customer');
        $b = Request::body();
        $shopId = (int) Validation::require($b, 'shop_id');
        $shop = Database::one('SELECT * FROM shops WHERE id = :id', ['id' => $shopId]);
        if (!$shop || $shop['status'] !== 'approved') {
            throw new ApiException(404, 'Shop not found or not available');
        }
        $items = $b['items'] ?? [];
        if (!is_array($items) || !$items) {
            throw new ApiException(422, 'Order must contain at least one item');
        }

        Database::begin();
        try {
            [$orderItems, $total] = self::buildItems($items, $shop['id']);
            $totalDiscount = isset($b['total_discount']) ? (float) $b['total_discount'] : 0.0;
            $finalTotal = $totalDiscount ? round($total - $totalDiscount, 2) : round($total, 2);
            $pm = $b['payment_method'] ?? 'cash';

            $orderId = Database::insert('orders', [
                'shop_id'          => $shop['id'],
                'shop_name'        => $shop['name'],
                'customer_id'      => $user['id'],
                'total'            => max($finalTotal, 0),
                'subtotal'         => round($total, 2),
                'item_discounts'   => isset($b['item_discounts']) ? (float) $b['item_discounts'] : 0,
                'bill_discount'    => isset($b['bill_discount']) ? (float) $b['bill_discount'] : 0,
                'total_discount'   => $totalDiscount,
                'order_type'       => 'online',
                'status'           => 'pending',
                'payment_method'   => $pm,
                'payment_status'   => $pm === 'cash' ? 'paid' : 'pending',
                'delivery_address' => $b['delivery_address'] ?? 'Default Address',
                'created_at'       => now_utc(),
            ]);
            self::saveItemsAndDeductStock($orderId, $orderItems);
            Database::commit();
        } catch (Throwable $e) {
            Database::rollback();
            throw $e;
        }
        $order = Database::one('SELECT * FROM orders WHERE id = :id', ['id' => $orderId]);
        self::notifyOrderPlaced($order, $user);
        Response::json(Present::order($order), 201);
    }

    public static function walkin(array $p): void
    {
        $user = Auth::requireRole('owner', 'admin');
        $shop = ShopController::find($p['shop_id']);
        if ($user['role'] === 'owner' && (int) $shop['owner_id'] !== (int) $user['id']) {
            throw new ApiException(403, 'Not authorised for this shop');
        }
        $b = Request::body();
        $items = $b['items'] ?? [];
        if (!is_array($items) || !$items) {
            throw new ApiException(422, 'Order must contain at least one item');
        }
        Database::begin();
        try {
            [$orderItems, $total] = self::buildItems($items, $shop['id']);
            $totalDiscount = isset($b['total_discount']) ? (float) $b['total_discount'] : 0.0;
            $finalTotal = $totalDiscount ? round($total - $totalDiscount, 2) : round($total, 2);
            $pm = $b['payment_method'] ?? 'cash';
            $ps = $b['payment_status'] ?? 'paid';

            $orderId = Database::insert('orders', [
                'shop_id'          => $shop['id'],
                'shop_name'        => $shop['name'],
                'customer_id'      => $user['id'],
                'total'            => max($finalTotal, 0),
                'subtotal'         => round($total, 2),
                'item_discounts'   => isset($b['item_discounts']) ? (float) $b['item_discounts'] : 0,
                'bill_discount'    => isset($b['bill_discount']) ? (float) $b['bill_discount'] : 0,
                'total_discount'   => $totalDiscount,
                'order_type'       => 'walkin',
                'status'           => 'delivered',
                'payment_method'   => $pm,
                'payment_status'   => $ps,
                'delivery_address' => 'In-Store (Walk-in)',
                'created_at'       => now_utc(),
            ]);
            self::saveItemsAndDeductStock($orderId, $orderItems);
            Database::commit();
        } catch (Throwable $e) {
            Database::rollback();
            throw $e;
        }
        $order = Database::one('SELECT * FROM orders WHERE id = :id', ['id' => $orderId]);
        Response::json(Present::order($order), 201);
    }

    public static function myOrders(array $p): void
    {
        $user = Auth::requireRole('customer');
        [$page, $size] = ShopController::paging(20, 100);
        $offset = ($page - 1) * $size;
        $total = (int) Database::scalar('SELECT COUNT(*) FROM orders WHERE customer_id = :c', ['c' => $user['id']]);
        $rows = Database::all(
            "SELECT * FROM orders WHERE customer_id = :c ORDER BY created_at DESC LIMIT $size OFFSET $offset",
            ['c' => $user['id']]
        );
        Response::json([
            'items' => array_map([Present::class, 'order'], $rows),
            'total' => $total, 'page' => $page, 'size' => $size,
        ]);
    }

    public static function shopOrders(array $p): void
    {
        $user = Auth::requireUser();
        $shop = ShopController::find($p['shop_id']);
        Auth::assertShopOwnership($shop, $user);
        $where = ['shop_id = :s'];
        $params = ['s' => $shop['id']];
        if (($df = Request::query('date_from')) !== null && $df !== '') {
            $where[] = 'DATE(created_at) >= :df';
            $params['df'] = $df;
        }
        if (($dt = Request::query('date_to')) !== null && $dt !== '') {
            $where[] = 'DATE(created_at) <= :dt';
            $params['dt'] = $dt;
        }
        if (($ot = Request::query('order_type')) !== null && $ot !== '' && $ot !== 'all') {
            $where[] = 'order_type = :ot';
            $params['ot'] = $ot;
        }
        $whereSql = 'WHERE ' . implode(' AND ', $where);
        [$page, $size] = ShopController::paging(20, 100);
        $offset = ($page - 1) * $size;
        $total = (int) Database::scalar("SELECT COUNT(*) FROM orders $whereSql", $params);
        $rows = Database::all("SELECT * FROM orders $whereSql ORDER BY created_at DESC LIMIT $size OFFSET $offset", $params);
        Response::json([
            'items' => array_map([Present::class, 'order'], $rows),
            'total' => $total, 'page' => $page, 'size' => $size,
        ]);
    }

    public static function updateStatus(array $p): void
    {
        $user = Auth::requireUser();
        $order = self::find($p['order_id']);
        if ($user['role'] !== 'admin') {
            $shop = Database::one('SELECT * FROM shops WHERE id = :id', ['id' => $order['shop_id']]);
            if (!$shop || (int) $shop['owner_id'] !== (int) $user['id']) {
                throw new ApiException(403, 'Not authorised to update this order');
            }
        }
        $next = Validation::inEnum(Validation::require(Request::body(), 'status'), Enums::ORDER_STATUS, 'status');
        $allowed = self::TRANSITIONS[$order['status']] ?? [];
        if (!in_array($next, $allowed, true)) {
            throw new ApiException(422, "Cannot transition from '{$order['status']}' to '$next'. Allowed: " . json_encode($allowed));
        }
        $now = now_utc();
        $update = ['status' => $next, 'updated_at' => $now];
        if ($next === 'accepted')          $update['accepted_at'] = $now;
        elseif ($next === 'out_for_delivery') $update['out_for_delivery_at'] = $now;
        elseif ($next === 'delivered')     $update['delivered_at'] = $now;
        Database::update('orders', $update, 'id = :id', ['id' => $order['id']]);
        $order = Database::one('SELECT * FROM orders WHERE id = :id', ['id' => $order['id']]);
        self::notifyStatusChange($order, $next);
        Response::json(Present::order($order));
    }

    public static function cancel(array $p): void
    {
        $user = Auth::requireRole('customer');
        $order = self::find($p['order_id']);
        if ((int) $order['customer_id'] !== (int) $user['id']) {
            throw new ApiException(403, 'Not your order');
        }
        if ($order['status'] !== 'pending') {
            throw new ApiException(422, 'Only pending orders can be cancelled');
        }
        Database::begin();
        try {
            $items = Database::all('SELECT * FROM order_items WHERE order_id = :o', ['o' => $order['id']]);
            foreach ($items as $it) {
                Database::q('UPDATE products SET stock = stock + :q WHERE id = :id',
                    ['q' => (int) $it['quantity'], 'id' => (int) $it['product_id']]);
            }
            Database::update('orders', ['status' => 'rejected', 'updated_at' => now_utc()], 'id = :id', ['id' => $order['id']]);
            Database::commit();
        } catch (Throwable $e) {
            Database::rollback();
            throw $e;
        }
        $order = Database::one('SELECT * FROM orders WHERE id = :id', ['id' => $order['id']]);
        $ownerRow = Database::one('SELECT u.id FROM shops s JOIN users u ON u.id = s.owner_id WHERE s.id = :s', ['s' => $order['shop_id']]);
        if ($ownerRow) {
            Notifier::notify((int) $ownerRow['id'], 'order_cancelled', "Order #{$order['id']} cancelled",
                "A customer cancelled order #{$order['id']} at {$order['shop_name']}.", (int) $order['id']);
        }
        Response::json(Present::order($order));
    }

    public static function getPaymentStatus(array $p): void
    {
        $user = Auth::requireUser();
        $order = self::find($p['order_id']);
        if ((int) $order['customer_id'] !== (int) $user['id']) {
            $shop = Database::one('SELECT * FROM shops WHERE id = :id', ['id' => $order['shop_id']]);
            if (!$shop || (int) $shop['owner_id'] !== (int) $user['id']) {
                throw new ApiException(403, 'Not your order');
            }
        }
        Response::json([
            'order_id'       => (int) $order['id'],
            'payment_status' => $order['payment_status'],
            'payment_method' => $order['payment_method'],
        ]);
    }

    public static function setPaymentStatus(array $p): void
    {
        $user = Auth::requireRole('owner', 'admin');
        $order = self::find($p['order_id']);
        $shop = Database::one('SELECT * FROM shops WHERE id = :id', ['id' => $order['shop_id']]);
        if (!$shop || ($user['role'] === 'owner' && (int) $shop['owner_id'] !== (int) $user['id'])) {
            throw new ApiException(403, 'Not authorised');
        }
        $newStatus = Request::input('payment_status', 'paid');
        Database::update('orders', ['payment_status' => $newStatus], 'id = :id', ['id' => $order['id']]);
        Response::json(['order_id' => (int) $order['id'], 'payment_status' => $newStatus]);
    }

    // ── helpers ──
    public static function find($id): array
    {
        $order = Database::one('SELECT * FROM orders WHERE id = :id', ['id' => (int) $id]);
        if (!$order) {
            throw new ApiException(404, 'Order not found');
        }
        return $order;
    }

    /** Validate items, compute total, return [items[], total]. Does not write. */
    private static function buildItems(array $items, int $shopId): array
    {
        $out = [];
        $total = 0.0;
        foreach ($items as $in) {
            $pid = (int) ($in['product_id'] ?? 0);
            $qty = (int) ($in['quantity'] ?? 0);
            if ($qty < 1) {
                throw new ApiException(422, 'Quantity must be at least 1');
            }
            $product = Database::one('SELECT * FROM products WHERE id = :id', ['id' => $pid]);
            if (!$product || (int) $product['shop_id'] !== $shopId) {
                throw new ApiException(422, "Product $pid not found in this shop");
            }
            if ((int) $product['stock'] < $qty) {
                throw new ApiException(422, "Insufficient stock for '{$product['name']}'");
            }
            $out[] = [
                'product_id' => (int) $product['id'],
                'name'       => $product['name'],
                'price'      => (float) $product['price'],
                'quantity'   => $qty,
            ];
            $total += (float) $product['price'] * $qty;
        }
        return [$out, $total];
    }

    private static function saveItemsAndDeductStock(int $orderId, array $items): void
    {
        foreach ($items as $it) {
            Database::insert('order_items', [
                'order_id'   => $orderId,
                'product_id' => $it['product_id'],
                'name'       => $it['name'],
                'price'      => $it['price'],
                'quantity'   => $it['quantity'],
            ]);
            Database::q('UPDATE products SET stock = stock - :q WHERE id = :id',
                ['q' => $it['quantity'], 'id' => $it['product_id']]);
        }
    }

    // ── Notifications: in-app log (always) + email (if SMTP configured) ──

    /** Customer order confirmation + new-order alert to the shop owner. */
    private static function notifyOrderPlaced(array $order, array $customer): void
    {
        $oid = (int) $order['id'];
        $total = number_format((float) $order['total'], 2);
        $ownerRow = Database::one(
            'SELECT u.id, u.email, u.display_name FROM shops s JOIN users u ON u.id = s.owner_id WHERE s.id = :s',
            ['s' => $order['shop_id']]
        );
        // In-app notifications (always)
        Notifier::log((int) $order['customer_id'], 'order_placed', "Order #$oid placed",
            "Your order at {$order['shop_name']} was placed. Total ₹$total.", $oid);
        if ($ownerRow) {
            Notifier::log((int) $ownerRow['id'], 'new_order', "New order #$oid",
                "New order at {$order['shop_name']} — ₹$total. Deliver to: {$order['delivery_address']}", $oid);
        }
        // Rich emails (only if SMTP configured)
        if (!Mailer::configured()) return;
        $itemsHtml = self::itemsHtml($oid);
        // Customer confirmation
        if (!empty($customer['email'])) {
            $html = self::wrap('Order Confirmed 🛒',
                "Hi " . htmlspecialchars($customer['display_name'] ?? 'there') . ", your order <b>#{$order['id']}</b> at "
                . "<b>" . htmlspecialchars($order['shop_name']) . "</b> has been placed."
                . $itemsHtml . "<p style='font-size:16px'><b>Total: ₹$total</b></p>"
                . "<p>Status: <b>" . htmlspecialchars($order['status']) . "</b> · Payment: " . htmlspecialchars($order['payment_status']) . "</p>");
            Mailer::send($customer['email'], "Order #{$order['id']} confirmed — HyperMart", $html);
        }
        // Owner alert
        $owner = Database::one(
            'SELECT u.email, u.display_name FROM shops s JOIN users u ON u.id = s.owner_id WHERE s.id = :s',
            ['s' => $order['shop_id']]
        );
        if ($owner && !empty($owner['email'])) {
            $html = self::wrap('New Order 📦',
                "You have a new order <b>#{$order['id']}</b> at <b>" . htmlspecialchars($order['shop_name']) . "</b>."
                . $itemsHtml . "<p style='font-size:16px'><b>Total: ₹$total</b></p>"
                . "<p>Deliver to: " . htmlspecialchars($order['delivery_address']) . "</p>"
                . "<p>Manage it in your HyperMart owner dashboard.</p>");
            Mailer::send($owner['email'], "New order #{$order['id']} — " . $order['shop_name'], $html);
        }
    }

    /** Notify the customer when their order status changes. */
    private static function notifyStatusChange(array $order, string $status): void
    {
        $oid = (int) $order['id'];
        $labels = [
            'accepted' => 'accepted and is being prepared',
            'ready' => 'ready',
            'out_for_delivery' => 'out for delivery',
            'delivered' => 'delivered — enjoy!',
            'rejected' => 'cancelled',
        ];
        $msg = $labels[$status] ?? "updated to $status";
        // In-app (always)
        Notifier::log((int) $order['customer_id'], 'order_status', "Order #$oid $status",
            "Your order at {$order['shop_name']} is now $msg.", $oid);
        // Email (if configured)
        if (!Mailer::configured()) return;
        $cust = Database::one('SELECT email, display_name FROM users WHERE id = :id', ['id' => $order['customer_id']]);
        if (!$cust || empty($cust['email'])) return;
        $html = self::wrap('Order Update',
            "Hi " . htmlspecialchars($cust['display_name'] ?? 'there') . ", your order <b>#{$order['id']}</b> at "
            . "<b>" . htmlspecialchars($order['shop_name']) . "</b> is now <b>$msg</b>.");
        Mailer::send($cust['email'], "Order #{$order['id']} is " . $status . " — HyperMart", $html);
    }

    private static function itemsHtml(int $orderId): string
    {
        $items = Database::all('SELECT name, price, quantity FROM order_items WHERE order_id = :o', ['o' => $orderId]);
        $rows = '';
        foreach ($items as $it) {
            $line = number_format((float) $it['price'] * (int) $it['quantity'], 2);
            $rows .= "<tr><td style='padding:4px 8px;border-bottom:1px solid #eee'>" . htmlspecialchars($it['name'])
                . "</td><td style='padding:4px 8px;border-bottom:1px solid #eee;text-align:center'>x{$it['quantity']}</td>"
                . "<td style='padding:4px 8px;border-bottom:1px solid #eee;text-align:right'>₹$line</td></tr>";
        }
        return "<table style='width:100%;border-collapse:collapse;margin:12px 0'>$rows</table>";
    }

    private static function wrap(string $heading, string $bodyHtml): string
    {
        return "<div style='font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1A1A1A'>"
            . "<h2 style='color:#5A5A40;margin:0 0 12px'>HyperMart</h2>"
            . "<h3 style='margin:0 0 8px'>$heading</h3>"
            . "<div style='font-size:14px;line-height:1.6'>$bodyHtml</div>"
            . "<p style='color:#999;font-size:12px;margin-top:24px'>HyperMart · hypershopindia.com</p></div>";
    }
}
