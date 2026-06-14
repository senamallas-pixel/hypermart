-- HyperMart — MySQL schema (PHP backend)
-- Mirrors backend/models.py. Enum columns store the SQLAlchemy KEY strings
-- (e.g. category 'vegetables', location 'green_valley', status 'approved').
-- Import via phpMyAdmin → Import, or: mysql -u USER -p DBNAME < schema.sql

SET FOREIGN_KEY_CHECKS = 0;

-- ── users ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id                     INT AUTO_INCREMENT PRIMARY KEY,
    uid                    VARCHAR(128)  NOT NULL,
    email                  VARCHAR(255)  NOT NULL,
    display_name           VARCHAR(255)  NOT NULL,
    photo_url              VARCHAR(1024) NULL,
    role                   VARCHAR(20)   NOT NULL DEFAULT 'customer',
    phone                  VARCHAR(20)   NULL,
    password_hash          VARCHAR(256)  NULL,
    multi_location_enabled INT           NOT NULL DEFAULT 0,
    created_at             DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login             DATETIME      NULL,
    UNIQUE KEY uq_users_uid   (uid),
    UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── shops ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shops (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    owner_id        INT           NOT NULL,
    name            VARCHAR(255)  NOT NULL,
    address         TEXT          NOT NULL,
    category        VARCHAR(30)   NOT NULL,
    location_name   VARCHAR(30)   NOT NULL,
    status          VARCHAR(20)   NOT NULL DEFAULT 'pending',
    logo            VARCHAR(1024) NULL,
    timings         VARCHAR(100)  NULL,
    lat             DOUBLE        NULL,
    lng             DOUBLE        NULL,
    rating          DOUBLE        NOT NULL DEFAULT 4.5,
    review_count    INT           NOT NULL DEFAULT 0,
    delivery_radius DOUBLE        NULL,
    pincode         VARCHAR(10)   NULL,
    city            VARCHAR(100)  NULL,
    state           VARCHAR(100)  NULL,
    upi_id          VARCHAR(255)  NULL,
    created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_shops_location (location_name),
    KEY idx_shops_status   (status),
    KEY idx_shops_owner     (owner_id),
    CONSTRAINT fk_shops_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── products ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    shop_id             INT           NOT NULL,
    name                VARCHAR(255)  NOT NULL,
    description         TEXT          NULL,
    price               DOUBLE        NOT NULL,
    mrp                 DOUBLE        NOT NULL,
    unit                VARCHAR(50)   NOT NULL,
    category            VARCHAR(30)   NOT NULL,
    stock               INT           NOT NULL DEFAULT 0,
    low_stock_threshold INT           NOT NULL DEFAULT 10,
    expiry_date         DATETIME      NULL,
    image               VARCHAR(1024) NULL,
    status              VARCHAR(20)   NOT NULL DEFAULT 'active',
    created_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_products_shop   (shop_id),
    KEY idx_products_status (status),
    CONSTRAINT fk_products_shop FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── orders ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    shop_id             INT          NOT NULL,
    shop_name           VARCHAR(255) NOT NULL,
    customer_id         INT          NOT NULL,
    total               DOUBLE       NOT NULL,
    subtotal            DOUBLE       NULL,
    item_discounts      DOUBLE       NULL DEFAULT 0,
    bill_discount       DOUBLE       NULL DEFAULT 0,
    total_discount      DOUBLE       NULL DEFAULT 0,
    order_type          VARCHAR(20)  NULL DEFAULT 'online',
    status              VARCHAR(20)  NOT NULL DEFAULT 'pending',
    payment_status      VARCHAR(20)  NOT NULL DEFAULT 'pending',
    payment_method      VARCHAR(20)  NULL DEFAULT 'cash',
    razorpay_order_id   VARCHAR(255) NULL,
    razorpay_payment_id VARCHAR(255) NULL,
    delivery_address    TEXT         NOT NULL,
    created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME     NULL,
    accepted_at         DATETIME     NULL,
    out_for_delivery_at DATETIME     NULL,
    delivered_at        DATETIME     NULL,
    KEY idx_orders_shop     (shop_id),
    KEY idx_orders_customer (customer_id),
    KEY idx_orders_status   (status),
    CONSTRAINT fk_orders_shop     FOREIGN KEY (shop_id)     REFERENCES shops(id) ON DELETE RESTRICT,
    CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── order_items ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_items (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    order_id   INT          NOT NULL,
    product_id INT          NOT NULL,
    name       VARCHAR(255) NOT NULL,
    price      DOUBLE       NOT NULL,
    quantity   INT          NOT NULL,
    KEY idx_order_items_order (order_id),
    CONSTRAINT fk_order_items_order   FOREIGN KEY (order_id)   REFERENCES orders(id)   ON DELETE CASCADE,
    CONSTRAINT fk_order_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── subscriptions ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT        NOT NULL,
    plan_amount DOUBLE     NOT NULL DEFAULT 10.0,
    status      VARCHAR(20) NOT NULL DEFAULT 'pending',
    starts_at   DATETIME   NULL,
    expires_at  DATETIME   NULL,
    created_at  DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_subscriptions_user (user_id),
    CONSTRAINT fk_subscriptions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── reviews ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    shop_id     INT      NOT NULL,
    customer_id INT      NOT NULL,
    rating      INT      NOT NULL,
    comment     TEXT     NULL,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_reviews_shop     (shop_id),
    KEY idx_reviews_customer (customer_id),
    CONSTRAINT fk_reviews_shop     FOREIGN KEY (shop_id)     REFERENCES shops(id) ON DELETE CASCADE,
    CONSTRAINT fk_reviews_customer FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── password_reset_tokens ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    user_id    INT         NOT NULL,
    token      VARCHAR(64) NOT NULL,
    expires_at DATETIME    NOT NULL,
    used       INT         NOT NULL DEFAULT 0,
    UNIQUE KEY uq_prt_token (token),
    CONSTRAINT fk_prt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── suppliers ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suppliers (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    shop_id        INT          NOT NULL,
    name           VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255) NULL,
    phone          VARCHAR(20)  NULL,
    email          VARCHAR(255) NULL,
    address        TEXT         NULL,
    gst_number     VARCHAR(50)  NULL,
    created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_suppliers_shop (shop_id),
    CONSTRAINT fk_suppliers_shop FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── purchase_orders ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_orders (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    shop_id      INT        NOT NULL,
    supplier_id  INT        NOT NULL,
    total_amount DOUBLE     NOT NULL DEFAULT 0,
    status       VARCHAR(20) NOT NULL DEFAULT 'draft',
    notes        TEXT       NULL,
    created_at   DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_po_shop (shop_id),
    CONSTRAINT fk_po_shop     FOREIGN KEY (shop_id)     REFERENCES shops(id)     ON DELETE CASCADE,
    CONSTRAINT fk_po_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── purchase_order_items ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_order_items (
    id                INT AUTO_INCREMENT PRIMARY KEY,
    purchase_order_id INT          NOT NULL,
    product_id        INT          NOT NULL,
    name              VARCHAR(255) NOT NULL,
    price             DOUBLE       NOT NULL,
    quantity          INT          NOT NULL,
    KEY idx_poi_po (purchase_order_id),
    CONSTRAINT fk_poi_po      FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_poi_product FOREIGN KEY (product_id)        REFERENCES products(id)        ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── product_discounts ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_discounts (
    id                   INT AUTO_INCREMENT PRIMARY KEY,
    shop_id              INT          NOT NULL,
    product_id           INT          NOT NULL,
    product_name         VARCHAR(255) NULL,
    `type`               VARCHAR(20)  NOT NULL,
    buy_qty              INT          NULL,
    get_qty              INT          NULL,
    bulk_price           DOUBLE       NULL,
    discount_value       DOUBLE       NULL,
    discount_amount_type VARCHAR(20)  NOT NULL DEFAULT 'percentage',
    status               VARCHAR(20)  NOT NULL DEFAULT 'active',
    valid_till           DATETIME     NULL,
    created_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_pd_shop    (shop_id),
    KEY idx_pd_product (product_id),
    CONSTRAINT fk_pd_shop    FOREIGN KEY (shop_id)    REFERENCES shops(id)    ON DELETE CASCADE,
    CONSTRAINT fk_pd_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── order_discounts ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_discounts (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    shop_id        INT         NOT NULL,
    min_bill_value DOUBLE      NOT NULL,
    discount_type  VARCHAR(20) NOT NULL DEFAULT 'percentage',
    discount_value DOUBLE      NOT NULL,
    status         VARCHAR(20) NOT NULL DEFAULT 'active',
    valid_till     DATETIME    NULL,
    created_at     DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_od_shop (shop_id),
    CONSTRAINT fk_od_shop FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ── notifications ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    user_id    INT          NOT NULL,
    type       VARCHAR(40)  NOT NULL,
    title      VARCHAR(255) NOT NULL,
    message    TEXT         NULL,
    order_id   INT          NULL,
    is_read    TINYINT      NOT NULL DEFAULT 0,
    created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_notif_user (user_id, is_read),
    CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
