<?php
/**
 * POST /upload — image upload to the local (Hostinger) filesystem.
 *
 * Files are written under the API root's `uploads/` directory (served directly
 * by Apache because .htaccess only rewrites non-existent paths to index.php).
 * The endpoint returns a relative URL (e.g. `/uploads/<uuid>.jpg`); the frontend
 * prepends VITE_API_URL, yielding `https://<domain>/api/uploads/<uuid>.jpg`.
 */
class UploadController
{
    public static function register(Router $r): void
    {
        $r->post('/upload', [self::class, 'upload']);
    }

    public static function upload(array $p): void
    {
        if (empty($_FILES['file']) || !is_uploaded_file($_FILES['file']['tmp_name'])) {
            throw new ApiException(400, 'No file uploaded');
        }
        $file = $_FILES['file'];
        $ext = strtolower(pathinfo($file['name'] ?? 'image.bin', PATHINFO_EXTENSION));
        if (!in_array($ext, ['jpg', 'jpeg', 'png', 'gif', 'webp'], true)) {
            throw new ApiException(400, 'Only image files are allowed (jpg, png, gif, webp)');
        }
        $maxBytes = (int) env('MAX_UPLOAD_MB', '5') * 1024 * 1024;
        if (($file['size'] ?? 0) > $maxBytes) {
            throw new ApiException(413, 'File too large. Maximum size is ' . env('MAX_UPLOAD_MB', '5') . 'MB');
        }

        [$dir, $prefix] = self::config();
        if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
            throw new ApiException(500, 'Upload directory is not writable on server');
        }

        $filename = AuthController::uuid4() . '.' . $ext;
        $dest = rtrim($dir, '/\\') . DIRECTORY_SEPARATOR . $filename;
        if (!move_uploaded_file($file['tmp_name'], $dest)) {
            throw new ApiException(500, 'Failed to store uploaded file');
        }
        @chmod($dest, 0644);

        Response::json(['url' => rtrim($prefix, '/') . '/' . $filename]);
    }

    /**
     * Returns [absolute filesystem dir, public URL prefix].
     * Defaults to the `uploads/` folder under the API root, served at `/uploads`.
     */
    private static function config(): array
    {
        $apiRoot = dirname(__DIR__, 2);                         // Backend_php (= public_html/api)
        $dir = env('UPLOAD_DIR', $apiRoot . '/uploads');
        $prefix = env('UPLOAD_URL_PREFIX', '/uploads');
        return [$dir, $prefix];
    }
}
