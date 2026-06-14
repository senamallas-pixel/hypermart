<?php
/**
 * /shops/{id}/suppliers/* — supplier CRUD (owner/admin).
 */
class SupplierController
{
    public static function register(Router $r): void
    {
        $r->get('/shops/{shop_id}/suppliers',  [self::class, 'listSuppliers']);
        $r->post('/shops/{shop_id}/suppliers', [self::class, 'create']);
        $r->patch('/shops/{shop_id}/suppliers/{supplier_id}',  [self::class, 'update']);
        $r->delete('/shops/{shop_id}/suppliers/{supplier_id}', [self::class, 'delete']);
    }

    private static function guard(array $p): array
    {
        $user = Auth::requireUser();
        $shop = ShopController::find($p['shop_id']);
        Auth::assertShopOwnership($shop, $user);
        return $shop;
    }

    public static function listSuppliers(array $p): void
    {
        $shop = self::guard($p);
        $rows = Database::all('SELECT * FROM suppliers WHERE shop_id = :s ORDER BY name', ['s' => $shop['id']]);
        Response::json(array_map([Present::class, 'supplier'], $rows));
    }

    public static function create(array $p): void
    {
        $shop = self::guard($p);
        $b = Request::body();
        $id = Database::insert('suppliers', [
            'shop_id'        => $shop['id'],
            'name'           => (string) Validation::require($b, 'name'),
            'contact_person' => $b['contact_person'] ?? null,
            'phone'          => $b['phone'] ?? null,
            'email'          => $b['email'] ?? null,
            'address'        => $b['address'] ?? null,
            'gst_number'     => $b['gst_number'] ?? null,
            'created_at'     => now_utc(),
        ]);
        $row = Database::one('SELECT * FROM suppliers WHERE id = :id', ['id' => $id]);
        Response::json(Present::supplier($row), 201);
    }

    public static function update(array $p): void
    {
        $shop = self::guard($p);
        $supplier = self::find($shop['id'], $p['supplier_id']);
        $b = Request::body();
        $update = [];
        foreach (['name', 'contact_person', 'phone', 'email', 'address', 'gst_number'] as $f) {
            if (array_key_exists($f, $b) && $b[$f] !== null) $update[$f] = $b[$f];
        }
        if ($update) {
            Database::update('suppliers', $update, 'id = :id', ['id' => $supplier['id']]);
        }
        $row = Database::one('SELECT * FROM suppliers WHERE id = :id', ['id' => $supplier['id']]);
        Response::json(Present::supplier($row));
    }

    public static function delete(array $p): void
    {
        $shop = self::guard($p);
        $supplier = self::find($shop['id'], $p['supplier_id']);
        Database::delete('suppliers', 'id = :id', ['id' => $supplier['id']]);
        Response::noContent();
    }

    private static function find($shopId, $supplierId): array
    {
        $row = Database::one('SELECT * FROM suppliers WHERE id = :id AND shop_id = :s',
            ['id' => (int) $supplierId, 's' => (int) $shopId]);
        if (!$row) {
            throw new ApiException(404, 'Supplier not found');
        }
        return $row;
    }
}
