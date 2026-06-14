<?php
/**
 * HyperMart — demo seed (PHP port of backend/seed.py).
 *
 *   CLI:   php seed.php            (seed; safe to re-run)
 *          php seed.php --reset    (drop + recreate schema, then seed)
 *   HTTP:  GET /api/seed.php?token=<SEED_TOKEN>[&reset=1]
 *          (requires a non-empty SEED_TOKEN in .env; delete/lock this file after use)
 *
 * Demo credentials:
 *   Admin    : senamallas@gmail.com / Admin@123
 *   Owner 1  : anand@example.com    / Owner@123
 *   Owner 2  : priya@example.com    / Owner@123
 *   Customer : ravi@example.com     / Customer@123
 *   Customer : kavita@example.com   / Customer@123
 */

require __DIR__ . '/config.php';
require __DIR__ . '/src/Database.php';
require __DIR__ . '/src/ApiException.php';
require __DIR__ . '/src/Request.php';
require __DIR__ . '/src/Auth.php';
require __DIR__ . '/src/Enums.php';

$isCli = (PHP_SAPI === 'cli');
$reset = false;
if ($isCli) {
    $reset = in_array('--reset', $argv ?? [], true);
} else {
    $token = env('SEED_TOKEN', '');
    if ($token === '' || ($_GET['token'] ?? '') !== $token) {
        http_response_code(403);
        exit('Forbidden: invalid or missing seed token.');
    }
    $reset = !empty($_GET['reset']);
    header('Content-Type: text/plain; charset=utf-8');
}

function out(string $s): void { echo $s . "\n"; }

$pdo = Database::pdo();

if ($reset) {
    $tables = ['order_discounts', 'product_discounts', 'purchase_order_items', 'purchase_orders',
        'suppliers', 'password_reset_tokens', 'reviews', 'subscriptions', 'order_items',
        'orders', 'products', 'shops', 'users'];
    $pdo->exec('SET FOREIGN_KEY_CHECKS = 0');
    foreach ($tables as $t) { $pdo->exec("DROP TABLE IF EXISTS `$t`"); }
    $pdo->exec('SET FOREIGN_KEY_CHECKS = 1');
    $pdo->exec(file_get_contents(__DIR__ . '/schema.sql'));
    out('Tables dropped and recreated.');
}

function uuid4(): string { return AuthController_uuid4(); }
function AuthController_uuid4(): string
{
    $d = random_bytes(16);
    $d[6] = chr((ord($d[6]) & 0x0f) | 0x40);
    $d[8] = chr((ord($d[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($d), 4));
}

$now = now_utc();
$plus = fn (int $days) => gmdate('Y-m-d H:i:s', time() + $days * 86400);
$minus = fn (int $secs) => gmdate('Y-m-d H:i:s', time() - $secs);

// ── Users ──
$USERS = [
    ['uid' => 'admin-001', 'email' => 'senamallas@gmail.com', 'display_name' => 'Admin User',   'role' => 'admin',    'phone' => '+91-9000000001', 'password' => 'Admin@123'],
    ['uid' => 'owner-001', 'email' => 'anand@example.com',    'display_name' => 'Anand Kumar',  'role' => 'owner',    'phone' => '+91-9000000002', 'password' => 'Owner@123'],
    ['uid' => 'owner-002', 'email' => 'priya@example.com',    'display_name' => 'Priya Sharma', 'role' => 'owner',    'phone' => '+91-9000000003', 'password' => 'Owner@123'],
    ['uid' => 'cust-001',  'email' => 'ravi@example.com',     'display_name' => 'Ravi Verma',   'role' => 'customer', 'phone' => '+91-9000000004', 'password' => 'Customer@123'],
    ['uid' => 'cust-002',  'email' => 'kavita@example.com',   'display_name' => 'Kavita Singh', 'role' => 'customer', 'phone' => '+91-9000000005', 'password' => 'Customer@123'],
];
$userIds = [];
foreach ($USERS as $u) {
    $existing = Database::one('SELECT id FROM users WHERE uid = :uid', ['uid' => $u['uid']]);
    if ($existing) { $userIds[] = (int) $existing['id']; continue; }
    $userIds[] = Database::insert('users', [
        'uid' => $u['uid'], 'email' => $u['email'], 'display_name' => $u['display_name'],
        'role' => $u['role'], 'phone' => $u['phone'],
        'password_hash' => Auth::hashPassword($u['password']),
        'created_at' => $now, 'last_login' => $now,
    ]);
}

// ── Subscriptions for owners (active) ──
foreach ([1, 2] as $idx) {
    $oid = $userIds[$idx];
    if (!Database::one('SELECT id FROM subscriptions WHERE user_id = :u', ['u' => $oid])) {
        Database::insert('subscriptions', [
            'user_id' => $oid, 'plan_amount' => 10.0, 'status' => 'active',
            'starts_at' => $now, 'expires_at' => $plus(30), 'created_at' => $now,
        ]);
    }
}

// ── Shops (owner_idx, key fields) ──
$SHOPS = [
    [1, 'Anand Groceries',   'grocery',   'green_valley',   '12, Main St, Green Valley',     '8 AM – 10 PM', 'approved', 4.6, 28, 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&q=80'],
    [1, 'Anand Dairy Fresh', 'dairy',     'milk_lane',      '5, Milk Lane, Sector 4',        '6 AM – 8 PM',  'approved', 4.8, 44, 'https://images.unsplash.com/photo-1563636619-e9107da5a163?w=400&q=80'],
    [2, 'Priya Bakery',      'bakery',    'central_market', '27, Baker St, Central Market',  '7 AM – 9 PM',  'approved', 4.7, 16, 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&q=80'],
    [2, 'Priya Vegetables',  'vegetables','green_valley',   '8, Veggie Row, Green Valley',   '7 AM – 7 PM',  'approved', 4.5, 19, 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&q=80'],
    [2, 'Priya Beverages',   'beverages', 'food_plaza',     '3, Food Plaza, Block B',        '9 AM – 11 PM', 'approved', 4.4, 8,  'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=400&q=80'],
    [1, 'Anand Household',   'household', 'old_town',       '101, Old Town Bazaar',          '9 AM – 8 PM',  'pending',  4.3, 0,  'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80'],
];
$shopIds = [];
foreach ($SHOPS as $i => $s) {
    $existing = Database::one('SELECT id FROM shops WHERE name = :n', ['n' => $s[1]]);
    if ($existing) { $shopIds[] = (int) $existing['id']; continue; }
    $shopIds[] = Database::insert('shops', [
        'owner_id' => $userIds[$s[0]], 'name' => $s[1], 'category' => $s[2], 'location_name' => $s[3],
        'address' => $s[4], 'timings' => $s[5], 'status' => $s[6], 'rating' => $s[7], 'review_count' => $s[8],
        'logo' => $s[9], 'delivery_radius' => 3.0 + $i * 0.5, 'pincode' => '50000' . ($i + 1),
        'city' => 'Hyderabad', 'state' => 'Telangana', 'created_at' => $now,
    ]);
}

// ── Products (shop_idx, name, category, price, mrp, unit, stock, image) ──
$PRODUCTS = [
    [0, 'Basmati Rice (5 kg)', 'grocery', 320, 370, '5 kg bag', 50, 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&q=80'],
    [0, 'Toor Dal (1 kg)', 'grocery', 130, 145, '1 kg', 80, 'https://images.unsplash.com/photo-1585996853881-dad6643844b6?w=400&q=80'],
    [0, 'Sunflower Oil (1 L)', 'grocery', 155, 175, '1 L bottle', 30, 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400&q=80'],
    [0, 'Sugar (1 kg)', 'grocery', 45, 50, '1 kg', 100, 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400&q=80'],
    [0, 'Wheat Flour (5 kg)', 'grocery', 210, 230, '5 kg bag', 60, 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=400&q=80'],
    [0, 'Chana Dal (500 g)', 'grocery', 65, 72, '500 g', 45, 'https://images.unsplash.com/photo-1585996853881-dad6643844b6?w=400&q=80'],
    [0, 'Mustard Oil (1 L)', 'grocery', 175, 195, '1 L bottle', 20, 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400&q=80'],
    [0, 'Salt (1 kg)', 'grocery', 18, 20, '1 kg', 200, 'https://images.unsplash.com/photo-1518110925495-5fe2fda0442c?w=400&q=80'],
    [1, 'Full Cream Milk (1 L)', 'dairy', 62, 65, '1 L pouch', 120, 'https://images.unsplash.com/photo-1563636619-e9107da5a163?w=400&q=80'],
    [1, 'Paneer (200 g)', 'dairy', 90, 100, '200 g pack', 40, 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=400&q=80'],
    [1, 'Butter (100 g)', 'dairy', 55, 60, '100 g', 30, 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=400&q=80'],
    [1, 'Fresh Curd (500 g)', 'dairy', 40, 45, '500 g', 60, 'https://images.unsplash.com/photo-1571212515416-fef01fc43637?w=400&q=80'],
    [1, 'Ghee (500 g)', 'dairy', 280, 320, '500 g jar', 15, 'https://images.unsplash.com/photo-1631125915902-d8abe9225ff2?w=400&q=80'],
    [1, 'Cheese Slices (200 g)', 'dairy', 110, 125, '200 g box', 25, 'https://images.unsplash.com/photo-1552767059-ce182ead6c1b?w=400&q=80'],
    [2, 'Multigrain Bread', 'bakery', 40, 45, '400 g loaf', 25, 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&q=80'],
    [2, 'Butter Cookies (200 g)', 'bakery', 60, 70, '200 g box', 15, 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400&q=80'],
    [2, 'Croissant (4 pcs)', 'bakery', 90, 100, '4 pieces', 20, 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400&q=80'],
    [2, 'Chocolate Cake (500 g)', 'bakery', 250, 290, '500 g cake', 8, 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&q=80'],
    [2, 'White Bread', 'bakery', 30, 35, '400 g loaf', 30, 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&q=80'],
    [3, 'Tomatoes (1 kg)', 'vegetables', 40, 50, '1 kg', 80, 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=400&q=80'],
    [3, 'Onions (1 kg)', 'vegetables', 35, 40, '1 kg', 100, 'https://images.unsplash.com/photo-1508747703725-719777637510?w=400&q=80'],
    [3, 'Potatoes (1 kg)', 'vegetables', 30, 35, '1 kg', 120, 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=400&q=80'],
    [3, 'Spinach (250 g)', 'vegetables', 20, 25, '250 g bunch', 50, 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=400&q=80'],
    [3, 'Capsicum (500 g)', 'vegetables', 45, 55, '500 g', 40, 'https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?w=400&q=80'],
    [3, 'Carrots (500 g)', 'vegetables', 25, 30, '500 g', 60, 'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=400&q=80'],
    [3, 'Coriander Leaves (100 g)', 'vegetables', 15, 20, '100 g bunch', 70, 'https://images.unsplash.com/photo-1526318896980-cf78c088247c?w=400&q=80'],
    [4, 'Mango Juice (1 L)', 'beverages', 85, 95, '1 L carton', 40, 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=400&q=80'],
    [4, 'Mineral Water (1 L)', 'beverages', 20, 20, '1 L bottle', 200, 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=400&q=80'],
    [4, 'Green Tea (25 bags)', 'beverages', 120, 140, '25 bags box', 30, 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&q=80'],
    [4, 'Coca-Cola (2 L)', 'beverages', 90, 95, '2 L bottle', 50, 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=400&q=80'],
    [4, 'Orange Juice (1 L)', 'beverages', 80, 90, '1 L carton', 35, 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=400&q=80'],
];
// Each row: [shop_idx, name, category, price, mrp, unit, stock, image]
$prodIds = [];
foreach ($PRODUCTS as $i => $p) {
    $shopId = $shopIds[$p[0]];
    $existing = Database::one('SELECT id FROM products WHERE shop_id = :s AND name = :n', ['s' => $shopId, 'n' => $p[1]]);
    if ($existing) { $prodIds[] = (int) $existing['id']; continue; }
    // expiry / low stock rules mirror seed.py
    $expiry = null;
    if ($i % 5 === 0)      $expiry = $plus(15);
    elseif ($i % 7 === 0)  $expiry = $plus(90);
    $stock = (int) $p[6];
    if ($i === 2) $stock = 5;  // low stock item
    $prodIds[] = Database::insert('products', [
        'shop_id'             => $shopId,
        'name'                => $p[1],
        'category'            => $p[2],
        'price'               => $p[3],
        'mrp'                 => $p[4],
        'unit'                => $p[5],
        'stock'               => $stock,
        'low_stock_threshold' => 10,
        'expiry_date'         => $expiry,
        'image'               => $p[7],
        'status'              => 'active',
        'created_at'          => $now,
    ]);
}

// ── Sample orders (1 delivered, 1 accepted) for Ravi ──
$ravi = $userIds[3];
if (!Database::one('SELECT id FROM orders WHERE customer_id = :c', ['c' => $ravi])) {
    $ricePrice = $PRODUCTS[0][3]; $dalPrice = $PRODUCTS[1][3]; $milkPrice = $PRODUCTS[8][3];
    $o1 = Database::insert('orders', [
        'shop_id' => $shopIds[0], 'shop_name' => $SHOPS[0][1], 'customer_id' => $ravi,
        'total' => $ricePrice + $dalPrice, 'status' => 'delivered', 'payment_status' => 'paid',
        'order_type' => 'online', 'payment_method' => 'cash',
        'delivery_address' => '42, Green Valley Road', 'created_at' => $minus(2 * 86400),
    ]);
    Database::insert('order_items', ['order_id' => $o1, 'product_id' => $prodIds[0], 'name' => $PRODUCTS[0][1], 'price' => $ricePrice, 'quantity' => 1]);
    Database::insert('order_items', ['order_id' => $o1, 'product_id' => $prodIds[1], 'name' => $PRODUCTS[1][1], 'price' => $dalPrice, 'quantity' => 1]);

    $o2 = Database::insert('orders', [
        'shop_id' => $shopIds[1], 'shop_name' => $SHOPS[1][1], 'customer_id' => $ravi,
        'total' => $milkPrice * 2, 'status' => 'accepted', 'payment_status' => 'pending',
        'order_type' => 'online', 'payment_method' => 'cash',
        'delivery_address' => '42, Green Valley Road', 'created_at' => $minus(3 * 3600),
    ]);
    Database::insert('order_items', ['order_id' => $o2, 'product_id' => $prodIds[8], 'name' => $PRODUCTS[8][1], 'price' => $milkPrice, 'quantity' => 2]);
}

// ── Suppliers (shop_idx, name, contact, phone, email, address, gst) ──
$SUPPLIERS = [
    [0, 'Metro Wholesale',     'Raj Malhotra',  '+91-9800000001', 'metro@wholesale.com', 'Industrial Area, Phase 2', '29AABCM1234A1Z1'],
    [0, 'Agro Fresh Supplies', 'Suresh Patel',  '+91-9800000002', 'agro@fresh.com',      'Farm Road, Sector 7',      '29AABCA5678B2Z2'],
    [1, 'Nandini Dairy Co-op', 'Lakshmi Devi',  '+91-9800000003', 'nandini@dairy.com',   'Dairy Complex, Milk Lane', '29AABCN9012C3Z3'],
    [2, 'Flour Power Mills',   'Amit Sharma',   '+91-9800000004', 'flour@power.com',     'Mill Road, Old Town',      '29AABCF3456D4Z4'],
];
$supplierIds = [];
foreach ($SUPPLIERS as $s) {
    $shopId = $shopIds[$s[0]];
    $existing = Database::one('SELECT id FROM suppliers WHERE shop_id = :s AND name = :n', ['s' => $shopId, 'n' => $s[1]]);
    if ($existing) { $supplierIds[] = (int) $existing['id']; continue; }
    $supplierIds[] = Database::insert('suppliers', [
        'shop_id' => $shopId, 'name' => $s[1], 'contact_person' => $s[2], 'phone' => $s[3],
        'email' => $s[4], 'address' => $s[5], 'gst_number' => $s[6], 'created_at' => $now,
    ]);
}

// ── Purchase Orders ──
if (!Database::one('SELECT id FROM purchase_orders LIMIT 1')) {
    $po1 = Database::insert('purchase_orders', [
        'shop_id' => $shopIds[0], 'supplier_id' => $supplierIds[0], 'total_amount' => 15000.0,
        'status' => 'received', 'notes' => 'Monthly stock replenishment', 'created_at' => $minus(5 * 86400),
    ]);
    Database::insert('purchase_order_items', ['purchase_order_id' => $po1, 'product_id' => $prodIds[0], 'name' => 'Basmati Rice (5 kg)', 'price' => 300, 'quantity' => 30]);
    Database::insert('purchase_order_items', ['purchase_order_id' => $po1, 'product_id' => $prodIds[1], 'name' => 'Toor Dal (1 kg)', 'price' => 120, 'quantity' => 50]);

    $po2 = Database::insert('purchase_orders', [
        'shop_id' => $shopIds[1], 'supplier_id' => $supplierIds[2], 'total_amount' => 8500.0,
        'status' => 'sent', 'notes' => 'Weekly dairy restock', 'created_at' => $minus(1 * 86400),
    ]);
    Database::insert('purchase_order_items', ['purchase_order_id' => $po2, 'product_id' => $prodIds[8], 'name' => 'Full Cream Milk (1 L)', 'price' => 58, 'quantity' => 100]);
    Database::insert('purchase_order_items', ['purchase_order_id' => $po2, 'product_id' => $prodIds[9], 'name' => 'Paneer (200 g)', 'price' => 80, 'quantity' => 30]);
}

// ── Product Discounts ──
if (!Database::one('SELECT id FROM product_discounts LIMIT 1')) {
    Database::insert('product_discounts', ['shop_id' => $shopIds[0], 'product_id' => $prodIds[3], 'product_name' => 'Sugar (1 kg)', 'type' => 'bogo', 'buy_qty' => 2, 'get_qty' => 1, 'status' => 'active', 'discount_amount_type' => 'percentage', 'valid_till' => $plus(30), 'created_at' => $now]);
    Database::insert('product_discounts', ['shop_id' => $shopIds[1], 'product_id' => $prodIds[8], 'product_name' => 'Full Cream Milk (1 L)', 'type' => 'buy_x_get_y', 'buy_qty' => 3, 'get_qty' => 1, 'status' => 'active', 'discount_amount_type' => 'percentage', 'valid_till' => $plus(15), 'created_at' => $now]);
    Database::insert('product_discounts', ['shop_id' => $shopIds[2], 'product_id' => $prodIds[14], 'product_name' => 'Multigrain Bread', 'type' => 'bulk_price', 'buy_qty' => 3, 'bulk_price' => 100.0, 'status' => 'active', 'discount_amount_type' => 'percentage', 'valid_till' => $plus(20), 'created_at' => $now]);
    Database::insert('product_discounts', ['shop_id' => $shopIds[3], 'product_id' => $prodIds[19], 'product_name' => 'Tomatoes (1 kg)', 'type' => 'individual', 'discount_value' => 10.0, 'status' => 'active', 'discount_amount_type' => 'percentage', 'valid_till' => $plus(10), 'created_at' => $now]);
}

// ── Order Discounts ──
if (!Database::one('SELECT id FROM order_discounts LIMIT 1')) {
    Database::insert('order_discounts', ['shop_id' => $shopIds[0], 'min_bill_value' => 500.0, 'discount_type' => 'percentage', 'discount_value' => 5.0, 'status' => 'active', 'valid_till' => $plus(30), 'created_at' => $now]);
    Database::insert('order_discounts', ['shop_id' => $shopIds[0], 'min_bill_value' => 1000.0, 'discount_type' => 'flat', 'discount_value' => 50.0, 'status' => 'active', 'valid_till' => $plus(30), 'created_at' => $now]);
    Database::insert('order_discounts', ['shop_id' => $shopIds[2], 'min_bill_value' => 300.0, 'discount_type' => 'percentage', 'discount_value' => 10.0, 'status' => 'active', 'valid_till' => $plus(20), 'created_at' => $now]);
}

out('');
out('Seed complete.');
out('  Admin    : senamallas@gmail.com / Admin@123');
out('  Owner 1  : anand@example.com    / Owner@123');
out('  Owner 2  : priya@example.com    / Owner@123');
out('  Customer : ravi@example.com     / Customer@123');
out('  Customer : kavita@example.com   / Customer@123');
