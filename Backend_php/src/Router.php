<?php
/**
 * Tiny method+path router. Patterns use {name} placeholders, e.g.
 * "/shops/{shop_id}/products/{product_id}". Matched params are passed to the
 * handler as an associative array.
 */
class Router
{
    private array $routes = [];

    public function add(string $method, string $pattern, callable $handler): void
    {
        $this->routes[] = [strtoupper($method), $pattern, $handler];
    }

    public function get(string $p, callable $h): void    { $this->add('GET', $p, $h); }
    public function post(string $p, callable $h): void   { $this->add('POST', $p, $h); }
    public function patch(string $p, callable $h): void  { $this->add('PATCH', $p, $h); }
    public function put(string $p, callable $h): void    { $this->add('PUT', $p, $h); }
    public function delete(string $p, callable $h): void { $this->add('DELETE', $p, $h); }

    private function compile(string $pattern): string
    {
        $regex = preg_replace('#\{([a-zA-Z_][a-zA-Z0-9_]*)\}#', '(?P<$1>[^/]+)', $pattern);
        return '#^' . $regex . '$#';
    }

    public function dispatch(string $method, string $path): void
    {
        $method = strtoupper($method);
        $pathMatched = false;
        foreach ($this->routes as [$m, $pattern, $handler]) {
            if (preg_match($this->compile($pattern), $path, $matches)) {
                $pathMatched = true;
                if ($m !== $method) {
                    continue;
                }
                $params = [];
                foreach ($matches as $k => $v) {
                    if (!is_int($k)) {
                        $params[$k] = urldecode($v);
                    }
                }
                $handler($params);
                return;
            }
        }
        if ($pathMatched) {
            Response::error(405, 'Method not allowed');
        }
        Response::error(404, 'Not found');
    }
}
