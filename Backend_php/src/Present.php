<?php
/**
 * Presenters: shape raw DB rows into the exact JSON the FastAPI backend
 * returned (types, nullable fields, ISO datetimes, enum value mapping,
 * computed fields like line_total).
 */
class Present
{
    /** MySQL "Y-m-d H:i:s" -> ISO "Y-m-dTH:i:s" (matches Pydantic naive datetime). */
    public static function iso($v): ?string
    {
        if ($v === null || $v === '') return null;
        // Stored datetimes are UTC (gmdate). Mark them with 'Z' so clients parse
        // them as UTC and convert to the viewer's local time correctly.
        return str_replace(' ', 'T', substr((string) $v, 0, 19)) . 'Z';
    }

    private static function f($v): ?float { return $v === null ? null : (float) $v; }
    private static function i($v): ?int   { return $v === null ? null : (int) $v; }

    public static function user(array $u): array
    {
        return [
            'id'                     => (int) $u['id'],
            'uid'                    => $u['uid'],
            'email'                  => $u['email'],
            'display_name'           => $u['display_name'],
            'photo_url'              => $u['photo_url'],
            'role'                   => $u['role'],
            'phone'                  => $u['phone'],
            'multi_location_enabled' => (int) ($u['multi_location_enabled'] ?? 0),
            'created_at'             => self::iso($u['created_at']),
            'last_login'             => self::iso($u['last_login']),
        ];
    }

    public static function shop(array $s): array
    {
        return [
            'id'              => (int) $s['id'],
            'owner_id'        => (int) $s['owner_id'],
            'name'            => $s['name'],
            'address'         => $s['address'],
            'category'        => Enums::catKeyToValue($s['category']),
            'location_name'   => Enums::locKeyToValue($s['location_name']),
            'status'          => $s['status'],
            'logo'            => $s['logo'],
            'timings'         => $s['timings'],
            'lat'             => self::f($s['lat']),
            'lng'             => self::f($s['lng']),
            'rating'          => self::f($s['rating']),
            'review_count'    => (int) $s['review_count'],
            'delivery_radius' => self::f($s['delivery_radius']),
            'pincode'         => $s['pincode'],
            'city'            => $s['city'],
            'state'           => $s['state'],
            'upi_id'          => $s['upi_id'],
            'created_at'      => self::iso($s['created_at']),
        ];
    }

    public static function product(array $p): array
    {
        return [
            'id'                  => (int) $p['id'],
            'shop_id'             => (int) $p['shop_id'],
            'name'                => $p['name'],
            'description'         => $p['description'],
            'price'               => self::f($p['price']),
            'mrp'                 => self::f($p['mrp']),
            'unit'                => $p['unit'],
            'category'            => Enums::catKeyToValue($p['category']),
            'stock'               => (int) $p['stock'],
            'low_stock_threshold' => (int) ($p['low_stock_threshold'] ?? 10),
            'expiry_date'         => self::iso($p['expiry_date'] ?? null),
            'image'               => $p['image'],
            'status'              => $p['status'],
            'created_at'          => self::iso($p['created_at']),
        ];
    }

    public static function orderItem(array $it): array
    {
        $price = (float) $it['price'];
        $qty   = (int) $it['quantity'];
        return [
            'id'         => (int) $it['id'],
            'product_id' => (int) $it['product_id'],
            'name'       => $it['name'],
            'price'      => $price,
            'quantity'   => $qty,
            'line_total' => round($price * $qty, 2),
        ];
    }

    public static function order(array $o): array
    {
        $items = Database::all('SELECT * FROM order_items WHERE order_id = :o ORDER BY id', ['o' => $o['id']]);
        return [
            'id'                  => (int) $o['id'],
            'shop_id'             => (int) $o['shop_id'],
            'shop_name'           => $o['shop_name'],
            'customer_id'         => (int) $o['customer_id'],
            'items'               => array_map([self::class, 'orderItem'], $items),
            'total'               => self::f($o['total']),
            'subtotal'            => self::f($o['subtotal']),
            'item_discounts'      => self::f($o['item_discounts']),
            'bill_discount'       => self::f($o['bill_discount']),
            'total_discount'      => self::f($o['total_discount']),
            'order_type'          => $o['order_type'] ?? 'online',
            'status'              => $o['status'],
            'payment_status'      => $o['payment_status'],
            'payment_method'      => $o['payment_method'] ?? 'cash',
            'razorpay_order_id'   => $o['razorpay_order_id'],
            'razorpay_payment_id' => $o['razorpay_payment_id'],
            'delivery_address'    => $o['delivery_address'],
            'created_at'          => self::iso($o['created_at']),
            'updated_at'          => self::iso($o['updated_at']),
            'accepted_at'         => self::iso($o['accepted_at']),
            'out_for_delivery_at' => self::iso($o['out_for_delivery_at']),
            'delivered_at'        => self::iso($o['delivered_at']),
        ];
    }

    public static function subscription(array $s): array
    {
        return [
            'id'          => (int) $s['id'],
            'user_id'     => (int) $s['user_id'],
            'plan_amount' => self::f($s['plan_amount']),
            'status'      => $s['status'],
            'starts_at'   => self::iso($s['starts_at']),
            'expires_at'  => self::iso($s['expires_at']),
            'created_at'  => self::iso($s['created_at']),
        ];
    }

    public static function review(array $r, string $customerName = ''): array
    {
        return [
            'id'            => (int) $r['id'],
            'shop_id'       => (int) $r['shop_id'],
            'customer_id'   => (int) $r['customer_id'],
            'customer_name' => $customerName,
            'rating'        => (int) $r['rating'],
            'comment'       => $r['comment'],
            'created_at'    => self::iso($r['created_at']),
        ];
    }

    public static function supplier(array $s): array
    {
        return [
            'id'             => (int) $s['id'],
            'shop_id'        => (int) $s['shop_id'],
            'name'           => $s['name'],
            'contact_person' => $s['contact_person'],
            'phone'          => $s['phone'],
            'email'          => $s['email'],
            'address'        => $s['address'],
            'gst_number'     => $s['gst_number'],
            'created_at'     => self::iso($s['created_at']),
        ];
    }

    public static function poItem(array $it): array
    {
        return [
            'id'         => (int) $it['id'],
            'product_id' => (int) $it['product_id'],
            'name'       => $it['name'],
            'price'      => self::f($it['price']),
            'quantity'   => (int) $it['quantity'],
        ];
    }

    public static function po(array $po): array
    {
        $items = Database::all('SELECT * FROM purchase_order_items WHERE purchase_order_id = :p ORDER BY id', ['p' => $po['id']]);
        return [
            'id'           => (int) $po['id'],
            'shop_id'      => (int) $po['shop_id'],
            'supplier_id'  => (int) $po['supplier_id'],
            'total_amount' => self::f($po['total_amount']),
            'status'       => $po['status'],
            'notes'        => $po['notes'],
            'items'        => array_map([self::class, 'poItem'], $items),
            'created_at'   => self::iso($po['created_at']),
        ];
    }

    public static function productDiscount(array $d): array
    {
        return [
            'id'                   => (int) $d['id'],
            'shop_id'              => (int) $d['shop_id'],
            'product_id'           => (int) $d['product_id'],
            'product_name'         => $d['product_name'],
            'type'                 => $d['type'],
            'buy_qty'              => self::i($d['buy_qty']),
            'get_qty'              => self::i($d['get_qty']),
            'bulk_price'           => self::f($d['bulk_price']),
            'discount_value'       => self::f($d['discount_value']),
            'discount_amount_type' => $d['discount_amount_type'],
            'status'               => $d['status'],
            'valid_till'           => self::iso($d['valid_till']),
            'created_at'           => self::iso($d['created_at']),
        ];
    }

    public static function orderDiscount(array $d): array
    {
        return [
            'id'             => (int) $d['id'],
            'shop_id'        => (int) $d['shop_id'],
            'min_bill_value' => self::f($d['min_bill_value']),
            'discount_type'  => $d['discount_type'],
            'discount_value' => self::f($d['discount_value']),
            'status'         => $d['status'],
            'valid_till'     => self::iso($d['valid_till']),
            'created_at'     => self::iso($d['created_at']),
        ];
    }
}
