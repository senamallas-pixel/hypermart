<?php
define( 'WP_CACHE', true );

/**
 * The base configuration for WordPress
 *
 * The wp-config.php creation script uses this file during the installation.
 * You don't have to use the web site, you can copy this file to "wp-config.php"
 * and fill in the values.
 *
 * This file contains the following configurations:
 *
 * * Database settings
 * * Secret keys
 * * Database table prefix
 * * Localized language
 * * ABSPATH
 *
 * @link https://wordpress.org/support/article/editing-wp-config-php/
 *
 * @package WordPress
 */

// ** Database settings - You can get this info from your web host ** //
/** The name of the database for WordPress */
define( 'DB_NAME', 'u529915367_BGnAs' );

/** Database username */
define( 'DB_USER', 'u529915367_cVwDw' );

/** Database password */
define( 'DB_PASSWORD', 'hjPUcQUsRD' );

/** Database hostname */
define( 'DB_HOST', '127.0.0.1' );

/** Database charset to use in creating database tables. */
define( 'DB_CHARSET', 'utf8' );

/** The database collate type. Don't change this if in doubt. */
define( 'DB_COLLATE', '' );

/**#@+
 * Authentication unique keys and salts.
 *
 * Change these to different unique phrases! You can generate these using
 * the {@link https://api.wordpress.org/secret-key/1.1/salt/ WordPress.org secret-key service}.
 *
 * You can change these at any point in time to invalidate all existing cookies.
 * This will force all users to have to log in again.
 *
 * @since 2.6.0
 */
define( 'AUTH_KEY',          '^HI!Ue#XfNu?(7jR}U1[L2aD<{I7(7lkjt.+~bJyxY|[(506oYv6(S E,]biS ^V' );
define( 'SECURE_AUTH_KEY',   '5b#`b=D?m~syJlededc>^,)=OPhPB_E+=N!ef% O?Ouk)@8#NUTivR37(T=qtvHt' );
define( 'LOGGED_IN_KEY',     'H}qv)!HDRh oq~O{{jao4?3NWY9{&db>TA>.m5*kC:Q(.+]=P3EMkz@pk*Ri>JtK' );
define( 'NONCE_KEY',         'N33g+04V%D{{@zR%3Q/8vh6:pZ328ig?!qD.|/z{U.x%SyY&p^r,@;V5k!D<bjPE' );
define( 'AUTH_SALT',         '>^$!=<!dZo)/VqF1T;;_vB2xBk^RY[M`%X-.eAqwya6*4#n-QgdCT}x5Ecd YHgo' );
define( 'SECURE_AUTH_SALT',  '9=WjXyORYRK#6~JHUD_rnvo,~C+K-ej]k TW.S!> /SZUC5yu(zp{NT+OH`1|]YS' );
define( 'LOGGED_IN_SALT',    'I,%eILRrb=}3/gY6QJd6{Y+J6*Hck&:<II,>tJ!/&_o3W=.^Sw=kDpyJquQ^-3] ' );
define( 'NONCE_SALT',        't443bu&010OS~>/SP<JCb`M#TiS}VnR;Rb`j!;@RQB,;_t9fZP~mfKU8 a65_TtP' );
define( 'WP_CACHE_KEY_SALT', 'QHA$Gbmx9(/+@4CT3H[9`6c~yPPX>j[bM}qMEV/xcqopq|2HMR*gf}k! 6!Y=@<S' );


/**#@-*/

/**
 * WordPress database table prefix.
 *
 * You can have multiple installations in one database if you give each
 * a unique prefix. Only numbers, letters, and underscores please!
 */
$table_prefix = 'wp_';


/* Add any custom values between this line and the "stop editing" line. */



/**
 * For developers: WordPress debugging mode.
 *
 * Change this to true to enable the display of notices during development.
 * It is strongly recommended that plugin and theme developers use WP_DEBUG
 * in their development environments.
 *
 * For information on other constants that can be used for debugging,
 * visit the documentation.
 *
 * @link https://wordpress.org/support/article/debugging-in-wordpress/
 */
if ( ! defined( 'WP_DEBUG' ) ) {
	define( 'WP_DEBUG', false );
}

define( 'FS_METHOD', 'direct' );
define( 'COOKIEHASH', 'fb7fff3259668e64e807036e60f17c09' );
define( 'WP_AUTO_UPDATE_CORE', 'minor' );
define( 'SURECART_ENCRYPTION_KEY', 'H}qv)!HDRh oq~O{{jao4?3NWY9{&db>TA>.m5*kC:Q(.+]=P3EMkz@pk*Ri>JtK' );
/* That's all, stop editing! Happy publishing. */

/** Absolute path to the WordPress directory. */
if ( ! defined( 'ABSPATH' ) ) {
	define( 'ABSPATH', __DIR__ . '/' );
}

/** Sets up WordPress vars and included files. */
require_once ABSPATH . 'wp-settings.php';
