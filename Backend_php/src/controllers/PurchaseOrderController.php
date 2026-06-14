<?php
/**
 * /shops/{id}/purchase-orders/* — list, create, get, status (stock increment on received).
 */
class PurchaseOrderController
{
    public static function register(Router $r): void
    {
        $r->get('/shops/{shop_id}/purchase-orders',  [self::class, 'listPos']);
        $r->post('/shops/{shop_id}/purchase-orders', [self::class, 'create']);
        $r->patch('/shops/{shop_id}/purchase-orders/{po_id}/status', [self::class, 'updateStatus']); // before {po_id}
        $r->get('/shops/{shop_id}/purchase-orders/{po_id}', [self::class, 'getPo']);
    }

    private static function guard(array $p): array
    {
        $user = Auth::requireUser();
        $shop = ShopController::find($p['shop_id']);
        Auth::assertShopOwnership($shop, $user);
        return $shop;
    }

    public static function listPos(array $p): void
    {
        $shop = self::guard($p);
        $rows = Database::all('SELECT * FROM purchase_orders WHERE shop_id = :s ORDER BY created_at DESC', ['s' => $shop['id']]);
        Response::json(array_map([Present::class, 'po'], $rows));
    }

    public static function create(array $p): void
    {
        $shop = self::guard($p);
        $b = Request::body();
        $supplierId = (int) Validation::require($b, 'supplier_id');
        $supplier = Database::one('SELECT * FROM suppliers WHERE id = :id AND shop_id = :s',
            ['id' => $supplierId, 's' => $shop['id']]);
        if (!$supplier) {
            throw new ApiException(404, 'Supplier not found');
        }
        $items = $b['items'] ?? [];
        if (!is_array($items)) $items = [];
        $total = 0.0;
        foreach ($items as $it) {
            $total += (float) ($it['price'] ?? 0) * (int) ($it['quantity'] ?? 0);
        }
        Database::begin();
        try {
            $poId = Database::insert('purchase_orders', [
                'shop_id'      => $shop['id'],
                'supplier_id'  => $supplierId,
                'total_amount' => round($total, 2),
                'status'       => 'draft',
                'notes'        => $b['notes'] ?? null,
                'created_at'   => now_utc(),
            ]);
            foreach ($items as $it) {
                Database::insert('purchase_order_items', [
                    'purchase_order_id' => $poId,
                    'product_id'        => (int) ($it['product_id'] ?? 0),
                    'name'              => (string) ($it['name'] ?? ''),
                    'price'             => (float) ($it['price'] ?? 0),
                    'quantity'          => (int) ($it['quantity'] ?? 0),
                ]);
            }
            Database::commit();
        } catch (Throwable $e) {
            Database::rollback();
            throw $e;
        }
        $po = Database::one('SELECT * FROM purchase_orders WHERE id = :id', ['id' => $poId]);
        Response::json(Present::po($po), 201);
    }

    public static function getPo(array $p): void
    {
        $shop = self::guard($p);
        $po = self::find($shop['id'], $p['po_id']);
        Response::json(Present::po($po));
    }

    public static function updateStatus(array $p): void
    {
        $shop = self::guard($p);
        $po = self::find($shop['id'], $p['po_id']);
        $status = Validation::inEnum(Validation::require(Request::body(), 'status'), Enums::PO_STATUS, 'status');
        Database::begin();
        try {
            Database::update('purchase_orders', ['status' => $status], 'id = :id', ['id' => $po['id']]);
            if ($status === 'received') {
                $items = Database::all('SELECT * FROM purchase_order_items WHERE purchase_order_id = :po', ['po' => $po['id']]);
                foreach ($items as $it) {
                    Database::q('UPDATE products SET stock = stock + :q WHERE id = :id',
                        ['q' => (int) $it['quantity'], 'id' => (int) $it['product_id']]);
                }
            }
            Database::commit();
        } catch (Throwable $e) {
            Database::rollback();
            throw $e;
        }
        $po = Database::one('SELECT * FROM purchase_orders WHERE id = :id', ['id' => $po['id']]);
        Response::json(Present::po($po));
    }

    private static function find($shopId, $poId): array
    {
        $row = Database::one('SELECT * FROM purchase_orders WHERE id = :id AND shop_id = :s',
            ['id' => (int) $poId, 's' => (int) $shopId]);
        if (!$row) {
            throw new ApiException(404, 'Purchase order not found');
        }
        return $row;
    }
}
