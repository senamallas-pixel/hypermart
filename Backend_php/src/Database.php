<?php
/**
 * PDO/MySQL singleton with small query helpers.
 */
class Database
{
    private static ?PDO $pdo = null;

    public static function pdo(): PDO
    {
        if (self::$pdo === null) {
            $host = env('DB_HOST', 'localhost');
            $name = env('DB_NAME', 'hypermart');
            $user = env('DB_USER', 'root');
            $pass = env('DB_PASS', '');
            $port = env('DB_PORT', '3306');
            $dsn  = "mysql:host=$host;port=$port;dbname=$name;charset=utf8mb4";
            self::$pdo = new PDO($dsn, $user, $pass, [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]);
        }
        return self::$pdo;
    }

    public static function q(string $sql, array $params = []): PDOStatement
    {
        $stmt = self::pdo()->prepare($sql);
        $stmt->execute($params);
        return $stmt;
    }

    /** Fetch a single row (assoc) or null. */
    public static function one(string $sql, array $params = []): ?array
    {
        $row = self::q($sql, $params)->fetch();
        return $row === false ? null : $row;
    }

    /** Fetch all rows (assoc array). */
    public static function all(string $sql, array $params = []): array
    {
        return self::q($sql, $params)->fetchAll();
    }

    /** Fetch a single scalar value (first column of first row). */
    public static function scalar(string $sql, array $params = [])
    {
        $v = self::q($sql, $params)->fetchColumn();
        return $v === false ? null : $v;
    }

    /** Insert an associative array into $table, return new id. */
    public static function insert(string $table, array $data): int
    {
        $cols  = array_keys($data);
        $names = array_map(fn ($c) => "`$c`", $cols);
        $place = array_map(fn ($c) => ":$c", $cols);
        $sql = "INSERT INTO `$table` (" . implode(',', $names) . ') VALUES (' . implode(',', $place) . ')';
        self::q($sql, $data);
        return (int) self::pdo()->lastInsertId();
    }

    /**
     * Update $table with $data where $where (raw SQL fragment with named
     * placeholders). $whereParams supplies the placeholders used in $where.
     */
    public static function update(string $table, array $data, string $where, array $whereParams = []): void
    {
        if (!$data) {
            return;
        }
        $sets   = [];
        $params = $whereParams;
        foreach ($data as $k => $v) {
            $sets[]          = "`$k` = :set_$k";
            $params["set_$k"] = $v;
        }
        $sql = "UPDATE `$table` SET " . implode(', ', $sets) . " WHERE $where";
        self::q($sql, $params);
    }

    public static function delete(string $table, string $where, array $params = []): void
    {
        self::q("DELETE FROM `$table` WHERE $where", $params);
    }

    public static function begin(): void { self::pdo()->beginTransaction(); }
    public static function commit(): void { self::pdo()->commit(); }
    public static function rollback(): void { if (self::pdo()->inTransaction()) self::pdo()->rollBack(); }
}
