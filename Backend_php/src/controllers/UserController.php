<?php
/**
 * /users/* — profile, change-password, admin user management, multi-location.
 */
class UserController
{
    public static function register(Router $r): void
    {
        // Specific /users/me routes BEFORE /users/{id} ones.
        $r->get('/users/me',                  [self::class, 'getMe']);
        $r->patch('/users/me',                [self::class, 'updateMe']);
        $r->post('/users/me/change-password', [self::class, 'changePassword']);
        $r->delete('/users/me',               [self::class, 'deleteMe']);
        $r->get('/users',                     [self::class, 'listUsers']);
        $r->patch('/users/{user_id}/role',    [self::class, 'changeRole']);
        $r->patch('/users/{user_id}/multi-location', [self::class, 'toggleMultiLocation']);
        $r->delete('/users/{user_id}',        [self::class, 'deleteUser']);
    }

    public static function getMe(array $p): void
    {
        $user = Auth::requireUser();
        Response::json(Present::user($user));
    }

    public static function updateMe(array $p): void
    {
        $user = Auth::requireUser();
        $b = Request::body();
        $update = [];
        foreach (['display_name', 'photo_url', 'phone'] as $f) {
            if (array_key_exists($f, $b) && $b[$f] !== null) {
                $update[$f] = $b[$f];
            }
        }
        // Non-admins cannot change their own role
        if (array_key_exists('role', $b) && $b['role'] !== null && $user['role'] === 'admin') {
            $update['role'] = Validation::inEnum($b['role'], Enums::USER_ROLE, 'role');
        }
        if ($update) {
            Database::update('users', $update, 'id = :id', ['id' => $user['id']]);
        }
        $user = Database::one('SELECT * FROM users WHERE id = :id', ['id' => $user['id']]);
        Response::json(Present::user($user));
    }

    public static function changePassword(array $p): void
    {
        $user = Auth::requireUser();
        $b = Request::body();
        $current = (string) Validation::require($b, 'current_password');
        $new = Validation::password((string) Validation::require($b, 'new_password'), 'New password');
        if (!Auth::verifyPassword($current, $user['password_hash'])) {
            throw new ApiException(401, 'Current password is incorrect');
        }
        Database::update('users', ['password_hash' => Auth::hashPassword($new)], 'id = :id', ['id' => $user['id']]);
        Response::json(['detail' => 'Password changed successfully']);
    }

    public static function deleteMe(array $p): void
    {
        $user = Auth::requireUser();
        if ($user['role'] === 'admin') {
            throw new ApiException(400, 'Admin accounts cannot be self-deleted');
        }
        Database::delete('users', 'id = :id', ['id' => $user['id']]);
        Response::noContent();
    }

    public static function listUsers(array $p): void
    {
        Auth::requireRole('admin');
        $rows = Database::all('SELECT * FROM users ORDER BY created_at DESC');
        Response::json(array_map([Present::class, 'user'], $rows));
    }

    public static function changeRole(array $p): void
    {
        Auth::requireRole('admin');
        $user = Database::one('SELECT * FROM users WHERE id = :id', ['id' => (int) $p['user_id']]);
        if (!$user) {
            throw new ApiException(404, 'User not found');
        }
        $b = Request::body();
        if (!empty($b['role'])) {
            $role = Validation::inEnum($b['role'], Enums::USER_ROLE, 'role');
            Database::update('users', ['role' => $role], 'id = :id', ['id' => $user['id']]);
        }
        $user = Database::one('SELECT * FROM users WHERE id = :id', ['id' => $user['id']]);
        Response::json(Present::user($user));
    }

    public static function toggleMultiLocation(array $p): void
    {
        Auth::requireRole('admin');
        $user = Database::one('SELECT * FROM users WHERE id = :id', ['id' => (int) $p['user_id']]);
        if (!$user) {
            throw new ApiException(404, 'User not found');
        }
        $enabled = (int) Validation::require(Request::body(), 'multi_location_enabled');
        Database::update('users', ['multi_location_enabled' => $enabled], 'id = :id', ['id' => $user['id']]);
        $user = Database::one('SELECT * FROM users WHERE id = :id', ['id' => $user['id']]);
        Response::json(Present::user($user));
    }

    public static function deleteUser(array $p): void
    {
        Auth::requireRole('admin');
        $user = Database::one('SELECT * FROM users WHERE id = :id', ['id' => (int) $p['user_id']]);
        if (!$user) {
            throw new ApiException(404, 'User not found');
        }
        Database::delete('users', 'id = :id', ['id' => $user['id']]);
        Response::noContent();
    }
}
