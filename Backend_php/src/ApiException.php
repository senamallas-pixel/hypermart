<?php
/**
 * Thrown anywhere in a controller to abort with a JSON {"detail": ...} error,
 * mirroring FastAPI's HTTPException(status_code, detail).
 */
class ApiException extends Exception
{
    public int $status;
    public $detail;

    public function __construct(int $status, $detail)
    {
        parent::__construct(is_string($detail) ? $detail : 'error');
        $this->status = $status;
        $this->detail = $detail;
    }
}
