<?php
/**
 * HyperMart PHP API — front controller.
 * All requests under /api/* are rewritten here by .htaccess. This bootstraps
 * the framework, applies CORS, strips the base path, and dispatches routes.
 */

error_reporting(E_ALL);
ini_set('display_errors', '0');               // never leak errors into JSON
date_default_timezone_set('UTC');             // mirror Python datetime.utcnow()

require __DIR__ . '/config.php';

// ── Core framework ──
foreach ([
    'ApiException', 'Database', 'Response', 'Request', 'Enums', 'Auth', 'Present', 'Router', 'Validation',
] as $cls) {
    require __DIR__ . "/src/$cls.php";
}
// ── Controllers ──
foreach (glob(__DIR__ . '/src/controllers/*.php') as $file) {
    require $file;
}
require __DIR__ . '/src/AiTools.php';

// ── CORS (permissive — frontend is same-origin in production) ──
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PATCH, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
header('Access-Control-Max-Age: 86400');
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ── Resolve request path, stripping the script's base directory (e.g. /api) ──
$scriptDir = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '')), '/');
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
if ($scriptDir !== '' && $scriptDir !== '/' && strpos($path, $scriptDir) === 0) {
    $path = substr($path, strlen($scriptDir));
}
$path = '/' . ltrim($path, '/');
if (strlen($path) > 1) {
    $path = rtrim($path, '/');
}

$router = new Router();
AuthController::register($router);
UserController::register($router);
SubscriptionController::register($router);
ShopController::register($router);
ProductController::register($router);
OrderController::register($router);
PaymentController::register($router);
AnalyticsController::register($router);
SupplierController::register($router);
PurchaseOrderController::register($router);
DiscountController::register($router);
UploadController::register($router);
AiController::register($router);

try {
    $router->dispatch($_SERVER['REQUEST_METHOD'] ?? 'GET', $path);
} catch (ApiException $e) {
    Response::error($e->status, $e->detail);
} catch (Throwable $e) {
    // Log server-side; return a generic 500 to the client.
    error_log('[HyperMart] ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    Response::error(500, 'Internal server error');
}
