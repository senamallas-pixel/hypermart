<?php
/**
 * /shops/{id}/products/* and /products/search.
 */
class ProductController
{
    public static function register(Router $r): void
    {
        $r->get('/products/search', [self::class, 'search']);
        $r->get('/shops/{shop_id}/products', [self::class, 'listProducts']);
        $r->post('/shops/{shop_id}/products', [self::class, 'create']);
        // bulk-update BEFORE {product_id}
        $r->patch('/shops/{shop_id}/products/bulk-update', [self::class, 'bulkUpdate']);
        $r->patch('/shops/{shop_id}/products/{product_id}', [self::class, 'update']);
        $r->delete('/shops/{shop_id}/products/{product_id}', [self::class, 'delete']);
    }

    public static function listProducts(array $p): void
    {
        $shopId = (int) $p['shop_id'];
        $activeOnly = Request::query('active_only', 'true');
        $activeOnly = !($activeOnly === 'false' || $activeOnly === '0' || $activeOnly === false);
        $sql = 'SELECT * FROM products WHERE shop_id = :s';
        $params = ['s' => $shopId];
        if ($activeOnly) {
            $sql .= " AND status = 'active'";
        }
        $sql .= ' ORDER BY name';
        $rows = Database::all($sql, $params);
        Response::json(array_map([Present::class, 'product'], $rows));
    }

    public static function create(array $p): void
    {
        $user = Auth::requireUser();
        $shop = ShopController::find($p['shop_id']);
        Auth::assertShopOwnership($shop, $user);
        $b = Request::body();

        $price = Validation::floatVal(Validation::require($b, 'price'), 'price');
        $mrp   = Validation::floatVal(Validation::require($b, 'mrp'), 'mrp');
        if ($price <= 0 || $mrp <= 0) {
            throw new ApiException(422, 'Price must be greater than zero');
        }
        if ($mrp < $price) {
            throw new ApiException(422, 'MRP must be >= selling price');
        }
        $stock = isset($b['stock']) ? (int) $b['stock'] : 0;
        if ($stock < 0) {
            throw new ApiException(422, 'Stock cannot be negative');
        }
        $status = $b['status'] ?? 'active';
        $data = [
            'shop_id'             => $shop['id'],
            'name'                => (string) Validation::require($b, 'name'),
            'description'         => $b['description'] ?? null,
            'price'               => $price,
            'mrp'                 => $mrp,
            'unit'                => (string) Validation::require($b, 'unit'),
            'category'            => Validation::category(Validation::require($b, 'category')),
            'stock'               => $stock,
            'low_stock_threshold' => isset($b['low_stock_threshold']) ? (int) $b['low_stock_threshold'] : 10,
            'expiry_date'         => Validation::toDateTime($b['expiry_date'] ?? null),
            'image'               => $b['image'] ?? null,
            'status'              => Validation::inEnum($status, Enums::PRODUCT_STATUS, 'status'),
            'created_at'          => now_utc(),
        ];
        $id = Database::insert('products', $data);
        $product = Database::one('SELECT * FROM products WHERE id = :id', ['id' => $id]);
        Response::json(Present::product($product), 201);
    }

    public static function update(array $p): void
    {
        $user = Auth::requireUser();
        $product = self::findProduct($p['shop_id'], $p['product_id']);
        $shop = ShopController::find($product['shop_id']);
        Auth::assertShopOwnership($shop, $user);
        $b = Request::body();
        $update = [];
        foreach (['name', 'description', 'unit', 'image'] as $f) {
            if (array_key_exists($f, $b) && $b[$f] !== null) $update[$f] = $b[$f];
        }
        foreach (['price', 'mrp'] as $f) {
            if (array_key_exists($f, $b) && $b[$f] !== null) $update[$f] = (float) $b[$f];
        }
        foreach (['stock', 'low_stock_threshold'] as $f) {
            if (array_key_exists($f, $b) && $b[$f] !== null) $update[$f] = (int) $b[$f];
        }
        if (array_key_exists('category', $b) && $b['category'] !== null) {
            $update['category'] = Validation::category($b['category']);
        }
        if (array_key_exists('status', $b) && $b['status'] !== null) {
            $update['status'] = Validation::inEnum($b['status'], Enums::PRODUCT_STATUS, 'status');
        }
        if (array_key_exists('expiry_date', $b) && $b['expiry_date'] !== null) {
            $update['expiry_date'] = Validation::toDateTime($b['expiry_date']);
        }
        if ($update) {
            Database::update('products', $update, 'id = :id', ['id' => $product['id']]);
        }
        $product = Database::one('SELECT * FROM products WHERE id = :id', ['id' => $product['id']]);
        Response::json(Present::product($product));
    }

    public static function delete(array $p): void
    {
        $user = Auth::requireUser();
        $product = self::findProduct($p['shop_id'], $p['product_id']);
        $shop = ShopController::find($product['shop_id']);
        Auth::assertShopOwnership($shop, $user);
        $active = (int) Database::scalar(
            "SELECT COUNT(*) FROM order_items oi JOIN orders o ON o.id = oi.order_id
             WHERE oi.product_id = :pid AND o.status NOT IN ('delivered', 'rejected')",
            ['pid' => $product['id']]
        );
        if ($active) {
            throw new ApiException(409, 'Product has active orders — cannot delete');
        }
        Database::delete('products', 'id = :id', ['id' => $product['id']]);
        Response::noContent();
    }

    public static function bulkUpdate(array $p): void
    {
        $user = Auth::requireUser();
        $shop = ShopController::find($p['shop_id']);
        Auth::assertShopOwnership($shop, $user);
        $items = Request::input('items', []);
        $updated = 0;
        foreach ((is_array($items) ? $items : []) as $item) {
            $pid = (int) ($item['product_id'] ?? 0);
            $product = Database::one(
                'SELECT * FROM products WHERE id = :id AND shop_id = :s',
                ['id' => $pid, 's' => $shop['id']]
            );
            if (!$product) continue;
            $update = [];
            if (array_key_exists('stock', $item) && $item['stock'] !== null) {
                $update['stock'] = (int) $item['stock'];
            }
            if (array_key_exists('low_stock_threshold', $item) && $item['low_stock_threshold'] !== null) {
                $update['low_stock_threshold'] = (int) $item['low_stock_threshold'];
            }
            if (array_key_exists('expiry_date', $item) && $item['expiry_date'] !== null) {
                $update['expiry_date'] = $item['expiry_date'] === '' ? null : Validation::toDateTime($item['expiry_date']);
            }
            if ($update) {
                Database::update('products', $update, 'id = :id', ['id' => $product['id']]);
            }
            $updated++;
        }
        Response::json(['updated' => $updated]);
    }

    public static function search(array $p): void
    {
        $q = (string) Request::query('q', '');
        if ($q === '') {
            throw new ApiException(422, "Query 'q' is required");
        }
        $where = ["s.status = 'approved'", "p.status = 'active'", 'p.name LIKE :q'];
        $params = ['q' => '%' . $q . '%'];
        if (($loc = Request::query('location')) !== null && $loc !== '') {
            $where[] = 's.location_name = :loc';
            $params['loc'] = Validation::location($loc);
        }
        if (($cat = Request::query('category')) !== null && $cat !== '') {
            $where[] = 'p.category = :cat';
            $params['cat'] = Validation::category($cat);
        }
        $whereSql = 'WHERE ' . implode(' AND ', $where);
        [$page, $size] = ShopController::paging(20, 100);
        $offset = ($page - 1) * $size;
        $total = (int) Database::scalar("SELECT COUNT(*) FROM products p JOIN shops s ON p.shop_id = s.id $whereSql", $params);
        $rows = Database::all(
            "SELECT p.*, s.name AS shop_name FROM products p JOIN shops s ON p.shop_id = s.id
             $whereSql ORDER BY p.name LIMIT $size OFFSET $offset",
            $params
        );
        $items = array_map(fn ($r) => [
            'id'          => (int) $r['id'],
            'shop_id'     => (int) $r['shop_id'],
            'shop_name'   => $r['shop_name'],
            'name'        => $r['name'],
            'description' => $r['description'],
            'price'       => (float) $r['price'],
            'mrp'         => (float) $r['mrp'],
            'unit'        => $r['unit'],
            'category'    => Enums::catKeyToValue($r['category']),
            'stock'       => (int) $r['stock'],
            'image'       => $r['image'],
            'status'      => $r['status'],
        ], $rows);
        Response::json(['items' => $items, 'total' => $total, 'page' => $page, 'size' => $size]);
    }

    public static function findProduct($shopId, $productId): array
    {
        $product = Database::one(
            'SELECT * FROM products WHERE id = :pid AND shop_id = :sid',
            ['pid' => (int) $productId, 'sid' => (int) $shopId]
        );
        if (!$product) {
            throw new ApiException(404, 'Product not found');
        }
        return $product;
    }
}
