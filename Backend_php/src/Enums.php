<?php
/**
 * Enum maps. SQLAlchemy persists enum KEYS (e.g. "vegetables", "green_valley"),
 * while the API (and the React frontend) exchanges enum VALUES
 * (e.g. "Vegetables & Fruits", "Green Valley"). Only ShopCategory and
 * ShopLocation differ between key and value; all other enums use key == value.
 */
class Enums
{
    public const CATEGORY = [
        'grocery'       => 'Grocery',
        'dairy'         => 'Dairy',
        'vegetables'    => 'Vegetables & Fruits',
        'meat'          => 'Meat',
        'bakery'        => 'Bakery & Snacks',
        'beverages'     => 'Beverages',
        'household'     => 'Household',
        'personal_care' => 'Personal Care',
    ];

    public const LOCATION = [
        'green_valley'   => 'Green Valley',
        'central_market' => 'Central Market',
        'food_plaza'     => 'Food Plaza',
        'milk_lane'      => 'Milk Lane',
        'old_town'       => 'Old Town',
    ];

    public const SHOP_STATUS   = ['pending', 'approved', 'suspended'];
    public const PRODUCT_STATUS = ['active', 'out_of_stock'];
    public const ORDER_STATUS  = ['pending', 'accepted', 'ready', 'out_for_delivery', 'delivered', 'rejected'];
    public const PAYMENT_STATUS = ['pending', 'paid'];
    public const USER_ROLE     = ['customer', 'owner', 'admin'];
    public const SUB_STATUS    = ['pending', 'active', 'expired'];
    public const PO_STATUS     = ['draft', 'sent', 'received', 'cancelled'];
    public const DISCOUNT_TYPE = ['bogo', 'buy_x_get_y', 'bulk_price', 'individual'];
    public const AMOUNT_TYPE   = ['percentage', 'flat'];

    // ── Category key <-> value ──
    public static function catKeyToValue(?string $key): ?string
    {
        if ($key === null) return null;
        return self::CATEGORY[$key] ?? $key;
    }

    public static function catValueToKey(?string $value): ?string
    {
        if ($value === null || $value === '') return null;
        $flip = array_flip(self::CATEGORY);
        if (isset($flip[$value])) return $flip[$value];          // value supplied
        if (isset(self::CATEGORY[$value])) return $value;        // key already supplied
        return null;
    }

    // ── Location key <-> value ──
    public static function locKeyToValue(?string $key): ?string
    {
        if ($key === null) return null;
        return self::LOCATION[$key] ?? $key;
    }

    public static function locValueToKey(?string $value): ?string
    {
        if ($value === null || $value === '') return null;
        $flip = array_flip(self::LOCATION);
        if (isset($flip[$value])) return $flip[$value];
        if (isset(self::LOCATION[$value])) return $value;
        return null;
    }
}
