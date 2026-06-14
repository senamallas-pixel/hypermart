<?php
/**
 * /shops/* — shop CRUD, nearby search, status, owner's shops, reviews.
 */
class ShopController
{
    public static function register(Router $r): void
    {
        $r->get('/shops/nearby',          [self::class, 'nearby']);   // before /shops/{id}
        $r->get('/shops',                 [self::class, 'listShops']);
        $r->post('/shops',                [self::class, 'create']);
        $r->get('/owners/me/shops',       [self::class, 'myShops']);
        $r->get('/shops/{shop_id}/reviews',  [self::class, 'listReviews']);
        $r->post('/shops/{shop_id}/reviews', [self::class, 'createReview']);
        $r->patch('/shops/{shop_id}/status', [self::class, 'updateStatus']);
        $r->get('/shops/{shop_id}',       [self::class, 'getShop']);
        $r->patch('/shops/{shop_id}',     [self::class, 'update']);
        $r->delete('/shops/{shop_id}',    [self::class, 'delete']);
    }

    public static function listShops(array $p): void
    {
        $user = Auth::optionalUser();
        $isAdmin = $user && $user['role'] === 'admin';

        $where = [];
        $params = [];
        $status = Request::query('status');
        if ($isAdmin && $status) {
            $where[] = 'status = :status';
            $params['status'] = Validation::inEnum($status, Enums::SHOP_STATUS, 'status');
        } elseif (!$isAdmin) {
            $where[] = "status = 'approved'";
        }
        if (($loc = Request::query('location')) !== null && $loc !== '') {
            $where[] = 'location_name = :loc';
            $params['loc'] = Validation::location($loc);
        }
        if (($cat = Request::query('category')) !== null && $cat !== '') {
            $where[] = 'category = :cat';
            $params['cat'] = Validation::category($cat);
        }
        if (($search = Request::query('search')) !== null && $search !== '') {
            $where[] = '(name LIKE :s OR category LIKE :s)';
            $params['s'] = '%' . $search . '%';
        }
        $whereSql = $where ? ('WHERE ' . implode(' AND ', $where)) : '';

        [$page, $size] = self::paging(20, 500);
        $offset = ($page - 1) * $size;
        $total = (int) Database::scalar("SELECT COUNT(*) FROM shops $whereSql", $params);
        $rows = Database::all(
            "SELECT * FROM shops $whereSql ORDER BY created_at DESC LIMIT $size OFFSET $offset",
            $params
        );
        Response::json([
            'items' => array_map([Present::class, 'shop'], $rows),
            'total' => $total, 'page' => $page, 'size' => $size,
        ]);
    }

    public static function nearby(array $p): void
    {
        $lat = (float) Request::query('lat');
        $lng = (float) Request::query('lng');
        $radius = Request::query('radius');
        $radius = $radius === null ? 2.0 : (float) $radius;
        $deltaLat = $radius / 111.0;
        $deltaLng = $radius / (111.0 * max(abs($lat) * 0.0175, 0.01));
        $rows = Database::all(
            "SELECT * FROM shops WHERE status = 'approved' AND lat IS NOT NULL AND lng IS NOT NULL
             AND lat BETWEEN :latlo AND :lathi AND lng BETWEEN :lnglo AND :lnghi",
            [
                'latlo' => $lat - $deltaLat, 'lathi' => $lat + $deltaLat,
                'lnglo' => $lng - $deltaLng, 'lnghi' => $lng + $deltaLng,
            ]
        );
        Response::json(array_map([Present::class, 'shop'], $rows));
    }

    public static function create(array $p): void
    {
        $user = Auth::requireRole('owner', 'admin');
        if ($user['role'] === 'owner') {
            Auth::checkSubscription($user);
        }
        $b = Request::body();
        $name = trim((string) Validation::require($b, 'name'));
        if (strlen($name) < 3) {
            throw new ApiException(422, 'Shop name must be at least 3 characters');
        }
        $data = [
            'owner_id'        => $user['id'],
            'name'            => $name,
            'address'         => (string) Validation::require($b, 'address'),
            'category'        => Validation::category(Validation::require($b, 'category')),
            'location_name'   => Validation::location(Validation::require($b, 'location_name')),
            'logo'            => $b['logo'] ?? null,
            'timings'         => $b['timings'] ?? null,
            'lat'             => isset($b['lat']) ? (float) $b['lat'] : null,
            'lng'             => isset($b['lng']) ? (float) $b['lng'] : null,
            'delivery_radius' => isset($b['delivery_radius']) ? (float) $b['delivery_radius'] : null,
            'pincode'         => $b['pincode'] ?? null,
            'city'            => $b['city'] ?? null,
            'state'           => $b['state'] ?? null,
            'upi_id'          => $b['upi_id'] ?? null,
            'status'          => 'approved',
            'rating'          => 4.5,
            'review_count'    => 0,
            'created_at'      => now_utc(),
        ];
        $id = Database::insert('shops', $data);
        $shop = Database::one('SELECT * FROM shops WHERE id = :id', ['id' => $id]);
        Response::json(Present::shop($shop), 201);
    }

    public static function getShop(array $p): void
    {
        $shop = self::find($p['shop_id']);
        Response::json(Present::shop($shop));
    }

    public static function update(array $p): void
    {
        $user = Auth::requireUser();
        $shop = self::find($p['shop_id']);
        $isOwner = $user['role'] === 'owner' && (int) $shop['owner_id'] === (int) $user['id'];
        $isAdmin = $user['role'] === 'admin';
        if (!$isOwner && !$isAdmin) {
            throw new ApiException(403, 'Not authorised to edit this shop');
        }
        $b = Request::body();
        $update = [];
        foreach (['name', 'address', 'logo', 'timings', 'pincode', 'city', 'state', 'upi_id'] as $f) {
            if (array_key_exists($f, $b) && $b[$f] !== null) $update[$f] = $b[$f];
        }
        foreach (['lat', 'lng', 'delivery_radius'] as $f) {
            if (array_key_exists($f, $b) && $b[$f] !== null) $update[$f] = (float) $b[$f];
        }
        if (array_key_exists('category', $b) && $b['category'] !== null) {
            $update['category'] = Validation::category($b['category']);
        }
        if (array_key_exists('location_name', $b) && $b['location_name'] !== null) {
            $update['location_name'] = Validation::location($b['location_name']);
        }
        // Only admins may change status here
        if (array_key_exists('status', $b) && $b['status'] !== null && $isAdmin) {
            $update['status'] = Validation::inEnum($b['status'], Enums::SHOP_STATUS, 'status');
        }
        if ($update) {
            Database::update('shops', $update, 'id = :id', ['id' => $shop['id']]);
        }
        $shop = Database::one('SELECT * FROM shops WHERE id = :id', ['id' => $shop['id']]);
        Response::json(Present::shop($shop));
    }

    public static function updateStatus(array $p): void
    {
        Auth::requireRole('admin');
        $shop = self::find($p['shop_id']);
        $status = Validation::inEnum(Validation::require(Request::body(), 'status'), Enums::SHOP_STATUS, 'status');
        Database::update('shops', ['status' => $status], 'id = :id', ['id' => $shop['id']]);
        $shop = Database::one('SELECT * FROM shops WHERE id = :id', ['id' => $shop['id']]);
        $label = $status === 'approved' ? 'approved and is now live' : ($status === 'suspended' ? 'suspended' : $status);
        Notifier::notify((int) $shop['owner_id'], 'shop_status', "Shop '{$shop['name']}' $status",
            "Your shop '{$shop['name']}' has been $label.", null);
        Response::json(Present::shop($shop));
    }

    public static function delete(array $p): void
    {
        Auth::requireRole('admin');
        $shop = self::find($p['shop_id']);
        Database::delete('shops', 'id = :id', ['id' => $shop['id']]);
        Response::noContent();
    }

    public static function myShops(array $p): void
    {
        $user = Auth::requireRole('owner', 'admin');
        $rows = Database::all('SELECT * FROM shops WHERE owner_id = :o', ['o' => $user['id']]);
        Response::json(array_map([Present::class, 'shop'], $rows));
    }

    // ── Reviews ──
    public static function createReview(array $p): void
    {
        $user = Auth::requireRole('customer');
        $shop = self::find($p['shop_id']);
        $b = Request::body();
        $rating = (int) Validation::require($b, 'rating');
        if ($rating < 1 || $rating > 5) {
            throw new ApiException(422, 'Rating must be between 1 and 5');
        }
        $existing = Database::one(
            'SELECT id FROM reviews WHERE shop_id = :s AND customer_id = :c',
            ['s' => $shop['id'], 'c' => $user['id']]
        );
        if ($existing) {
            throw new ApiException(400, 'You have already reviewed this shop');
        }
        $id = Database::insert('reviews', [
            'shop_id'     => $shop['id'],
            'customer_id' => $user['id'],
            'rating'      => $rating,
            'comment'     => $b['comment'] ?? null,
            'created_at'  => now_utc(),
        ]);
        // Update shop aggregate rating
        $avg = (float) Database::scalar('SELECT AVG(rating) FROM reviews WHERE shop_id = :s', ['s' => $shop['id']]);
        $cnt = (int) Database::scalar('SELECT COUNT(*) FROM reviews WHERE shop_id = :s', ['s' => $shop['id']]);
        Database::update('shops', ['rating' => round($avg, 1), 'review_count' => $cnt], 'id = :id', ['id' => $shop['id']]);

        $review = Database::one('SELECT * FROM reviews WHERE id = :id', ['id' => $id]);
        $comment = !empty($b['comment']) ? ': "' . $b['comment'] . '"' : '';
        Notifier::notify((int) $shop['owner_id'], 'review', "New {$rating}★ review for {$shop['name']}",
            "{$user['display_name']} reviewed your shop {$rating}★$comment", null);
        Response::json(Present::review($review, $user['display_name']), 201);
    }

    public static function listReviews(array $p): void
    {
        $shop = self::find($p['shop_id']);
        $rows = Database::all(
            'SELECT r.*, u.display_name AS customer_name FROM reviews r
             LEFT JOIN users u ON u.id = r.customer_id
             WHERE r.shop_id = :s ORDER BY r.created_at DESC',
            ['s' => $shop['id']]
        );
        $out = array_map(fn ($r) => Present::review($r, $r['customer_name'] ?? 'Unknown'), $rows);
        Response::json($out);
    }

    // ── helpers ──
    public static function find($id): array
    {
        $shop = Database::one('SELECT * FROM shops WHERE id = :id', ['id' => (int) $id]);
        if (!$shop) {
            throw new ApiException(404, 'Shop not found');
        }
        return $shop;
    }

    public static function paging(int $defSize, int $maxSize): array
    {
        $page = max(1, (int) (Request::query('page', 1)));
        $size = (int) (Request::query('size', $defSize));
        if ($size < 1) $size = $defSize;
        if ($size > $maxSize) $size = $maxSize;
        return [$page, $size];
    }
}
