<?php
/**
 * Product discounts, order/bill discounts, and the public combined discounts feed.
 */
class DiscountController
{
    public static function register(Router $r): void
    {
        // Public combined feed (no auth) — register before the scoped ones.
        $r->get('/shops/{shop_id}/discounts', [self::class, 'combined']);

        $r->get('/shops/{shop_id}/product-discounts',  [self::class, 'listProduct']);
        $r->post('/shops/{shop_id}/product-discounts', [self::class, 'createProduct']);
        $r->patch('/shops/{shop_id}/product-discounts/{discount_id}',  [self::class, 'updateProduct']);
        $r->delete('/shops/{shop_id}/product-discounts/{discount_id}', [self::class, 'deleteProduct']);

        $r->get('/shops/{shop_id}/order-discounts',  [self::class, 'listOrder']);
        $r->post('/shops/{shop_id}/order-discounts', [self::class, 'createOrder']);
        $r->patch('/shops/{shop_id}/order-discounts/{discount_id}',  [self::class, 'updateOrder']);
        $r->delete('/shops/{shop_id}/order-discounts/{discount_id}', [self::class, 'deleteOrder']);
    }

    private static function guard(array $p): array
    {
        $user = Auth::requireUser();
        $shop = ShopController::find($p['shop_id']);
        Auth::assertShopOwnership($shop, $user);
        return $shop;
    }

    // ── Product discounts ──
    public static function listProduct(array $p): void
    {
        $shop = self::guard($p);
        $rows = Database::all('SELECT * FROM product_discounts WHERE shop_id = :s ORDER BY created_at DESC', ['s' => $shop['id']]);
        Response::json(array_map([Present::class, 'productDiscount'], $rows));
    }

    public static function createProduct(array $p): void
    {
        $shop = self::guard($p);
        $b = Request::body();
        $productId = (int) Validation::require($b, 'product_id');
        $product = ProductController::findProduct($shop['id'], $productId);
        $id = Database::insert('product_discounts', [
            'shop_id'              => $shop['id'],
            'product_id'           => $productId,
            'product_name'         => $b['product_name'] ?? $product['name'],
            'type'                 => Validation::inEnum(Validation::require($b, 'type'), Enums::DISCOUNT_TYPE, 'type'),
            'buy_qty'              => isset($b['buy_qty']) ? (int) $b['buy_qty'] : null,
            'get_qty'              => isset($b['get_qty']) ? (int) $b['get_qty'] : null,
            'bulk_price'           => isset($b['bulk_price']) ? (float) $b['bulk_price'] : null,
            'discount_value'       => isset($b['discount_value']) ? (float) $b['discount_value'] : null,
            'discount_amount_type' => isset($b['discount_amount_type'])
                ? Validation::inEnum($b['discount_amount_type'], Enums::AMOUNT_TYPE, 'discount_amount_type') : 'percentage',
            'status'               => 'active',
            'valid_till'           => Validation::toDateTime($b['valid_till'] ?? null),
            'created_at'           => now_utc(),
        ]);
        $row = Database::one('SELECT * FROM product_discounts WHERE id = :id', ['id' => $id]);
        Response::json(Present::productDiscount($row), 201);
    }

    public static function updateProduct(array $p): void
    {
        $shop = self::guard($p);
        $disc = self::findDiscount('product_discounts', $shop['id'], $p['discount_id']);
        $b = Request::body();
        $update = [];
        if (array_key_exists('product_id', $b) && $b['product_id'] !== null) $update['product_id'] = (int) $b['product_id'];
        if (array_key_exists('product_name', $b) && $b['product_name'] !== null) $update['product_name'] = $b['product_name'];
        if (array_key_exists('type', $b) && $b['type'] !== null) {
            $update['type'] = Validation::inEnum($b['type'], Enums::DISCOUNT_TYPE, 'type');
        }
        foreach (['buy_qty', 'get_qty'] as $f) {
            if (array_key_exists($f, $b) && $b[$f] !== null) $update[$f] = (int) $b[$f];
        }
        foreach (['bulk_price', 'discount_value'] as $f) {
            if (array_key_exists($f, $b) && $b[$f] !== null) $update[$f] = (float) $b[$f];
        }
        if (array_key_exists('discount_amount_type', $b) && $b['discount_amount_type'] !== null) {
            $update['discount_amount_type'] = Validation::inEnum($b['discount_amount_type'], Enums::AMOUNT_TYPE, 'discount_amount_type');
        }
        if (array_key_exists('valid_till', $b) && $b['valid_till'] !== null) {
            $update['valid_till'] = Validation::toDateTime($b['valid_till']);
        }
        if ($update) {
            Database::update('product_discounts', $update, 'id = :id', ['id' => $disc['id']]);
        }
        $row = Database::one('SELECT * FROM product_discounts WHERE id = :id', ['id' => $disc['id']]);
        Response::json(Present::productDiscount($row));
    }

    public static function deleteProduct(array $p): void
    {
        $shop = self::guard($p);
        $disc = self::findDiscount('product_discounts', $shop['id'], $p['discount_id']);
        Database::delete('product_discounts', 'id = :id', ['id' => $disc['id']]);
        Response::noContent();
    }

    // ── Order/bill discounts ──
    public static function listOrder(array $p): void
    {
        $shop = self::guard($p);
        $rows = Database::all('SELECT * FROM order_discounts WHERE shop_id = :s ORDER BY min_bill_value', ['s' => $shop['id']]);
        Response::json(array_map([Present::class, 'orderDiscount'], $rows));
    }

    public static function createOrder(array $p): void
    {
        $shop = self::guard($p);
        $b = Request::body();
        $id = Database::insert('order_discounts', [
            'shop_id'        => $shop['id'],
            'min_bill_value' => (float) Validation::require($b, 'min_bill_value'),
            'discount_type'  => isset($b['discount_type'])
                ? Validation::inEnum($b['discount_type'], Enums::AMOUNT_TYPE, 'discount_type') : 'percentage',
            'discount_value' => (float) Validation::require($b, 'discount_value'),
            'status'         => 'active',
            'valid_till'     => Validation::toDateTime($b['valid_till'] ?? null),
            'created_at'     => now_utc(),
        ]);
        $row = Database::one('SELECT * FROM order_discounts WHERE id = :id', ['id' => $id]);
        Response::json(Present::orderDiscount($row), 201);
    }

    public static function updateOrder(array $p): void
    {
        $shop = self::guard($p);
        $disc = self::findDiscount('order_discounts', $shop['id'], $p['discount_id']);
        $b = Request::body();
        $update = [];
        if (array_key_exists('min_bill_value', $b) && $b['min_bill_value'] !== null) $update['min_bill_value'] = (float) $b['min_bill_value'];
        if (array_key_exists('discount_value', $b) && $b['discount_value'] !== null) $update['discount_value'] = (float) $b['discount_value'];
        if (array_key_exists('discount_type', $b) && $b['discount_type'] !== null) {
            $update['discount_type'] = Validation::inEnum($b['discount_type'], Enums::AMOUNT_TYPE, 'discount_type');
        }
        if (array_key_exists('valid_till', $b) && $b['valid_till'] !== null) {
            $update['valid_till'] = Validation::toDateTime($b['valid_till']);
        }
        if ($update) {
            Database::update('order_discounts', $update, 'id = :id', ['id' => $disc['id']]);
        }
        $row = Database::one('SELECT * FROM order_discounts WHERE id = :id', ['id' => $disc['id']]);
        Response::json(Present::orderDiscount($row));
    }

    public static function deleteOrder(array $p): void
    {
        $shop = self::guard($p);
        $disc = self::findDiscount('order_discounts', $shop['id'], $p['discount_id']);
        Database::delete('order_discounts', 'id = :id', ['id' => $disc['id']]);
        Response::noContent();
    }

    // ── Public combined feed (filters out expired) ──
    public static function combined(array $p): void
    {
        $shopId = (int) $p['shop_id'];
        $now = now_utc();
        $pd = Database::all(
            "SELECT * FROM product_discounts WHERE shop_id = :s AND status = 'active'
             AND (valid_till IS NULL OR valid_till > :now)",
            ['s' => $shopId, 'now' => $now]
        );
        $od = Database::all(
            "SELECT * FROM order_discounts WHERE shop_id = :s AND status = 'active'
             AND (valid_till IS NULL OR valid_till > :now)",
            ['s' => $shopId, 'now' => $now]
        );
        Response::json([
            'product_discounts' => array_map([Present::class, 'productDiscount'], $pd),
            'order_discounts'   => array_map([Present::class, 'orderDiscount'], $od),
        ]);
    }

    private static function findDiscount(string $table, int $shopId, $id): array
    {
        $row = Database::one("SELECT * FROM $table WHERE id = :id AND shop_id = :s",
            ['id' => (int) $id, 's' => $shopId]);
        if (!$row) {
            throw new ApiException(404, 'Discount not found');
        }
        return $row;
    }
}
