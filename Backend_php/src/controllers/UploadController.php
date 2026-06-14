<?php
/**
 * POST /upload — image upload to Cloudinary (signed REST call via cURL).
 */
class UploadController
{
    public static function register(Router $r): void
    {
        $r->post('/upload', [self::class, 'upload']);
    }

    public static function upload(array $p): void
    {
        [$cloud, $key, $secret, $folder] = self::config();
        if (!$cloud || !$key || !$secret) {
            throw new ApiException(500, 'Cloudinary is not configured on server');
        }
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

        $contents = file_get_contents($file['tmp_name']);
        $mime = $file['type'] ?: 'application/octet-stream';
        $dataUri = "data:$mime;base64," . base64_encode($contents);

        $publicId = AuthController::uuid4();
        $timestamp = time();
        // Cloudinary signature: sha1 of sorted params + api_secret
        $toSign = "folder=$folder&public_id=$publicId&timestamp=$timestamp" . $secret;
        $signature = sha1($toSign);

        $ch = curl_init("https://api.cloudinary.com/v1_1/$cloud/image/upload");
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => [
                'file'      => $dataUri,
                'api_key'   => $key,
                'timestamp' => $timestamp,
                'public_id' => $publicId,
                'folder'    => $folder,
                'signature' => $signature,
            ],
            CURLOPT_TIMEOUT        => 60,
        ]);
        $resp = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        $json = json_decode($resp ?: '', true);
        if ($code >= 400 || !isset($json['secure_url'])) {
            $msg = $json['error']['message'] ?? 'unknown error';
            throw new ApiException(500, "Cloudinary upload failed: $msg");
        }
        Response::json(['url' => $json['secure_url']]);
    }

    private static function config(): array
    {
        $url = env('CLOUDINARY_URL', '');
        $folder = env('CLOUDINARY_FOLDER', 'hypermart');
        if ($url && preg_match('#cloudinary://([^:]+):([^@]+)@(.+)#', $url, $m)) {
            return [$m[3], $m[1], $m[2], $folder];
        }
        return [
            env('CLOUDINARY_CLOUD_NAME', ''),
            env('CLOUDINARY_API_KEY', ''),
            env('CLOUDINARY_API_SECRET', ''),
            $folder,
        ];
    }
}
