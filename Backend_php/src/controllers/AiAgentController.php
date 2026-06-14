<?php
/**
 * /ai/agent/* — the autonomous agent loop (client-orchestrated).
 *   POST /ai/agent/start   {message}                    -> run_id + first step
 *   POST /ai/agent/step    {run_id}                      -> advance one round
 *   POST /ai/agent/confirm {run_id, pending_id, approve} -> execute/deny a gated action
 *
 * All endpoints require a logged-in user; the AgentService re-checks role +
 * ownership server-side for every tool, so the LLM is never trusted for authz.
 */
class AiAgentController
{
    public static function register(Router $r): void
    {
        $r->post('/ai/agent/start',   [self::class, 'start']);
        $r->post('/ai/agent/step',    [self::class, 'step']);
        $r->post('/ai/agent/confirm', [self::class, 'confirm']);
    }

    public static function start(array $p): void
    {
        $user = Auth::requireUser();
        $message = trim((string) Request::input('message', ''));
        if ($message === '') {
            throw new ApiException(422, 'message is required');
        }
        $svc = new AgentService($user);
        Response::json($svc->start($message));
    }

    public static function step(array $p): void
    {
        $user = Auth::requireUser();
        $runId = (string) Request::input('run_id', '');
        if ($runId === '') {
            throw new ApiException(422, 'run_id is required');
        }
        $svc = new AgentService($user);
        Response::json($svc->step($runId));
    }

    public static function confirm(array $p): void
    {
        $user = Auth::requireUser();
        $runId = (string) Request::input('run_id', '');
        $pendingId = (int) Request::input('pending_id', 0);
        $approve = (bool) Request::input('approve', false);
        if ($runId === '' || $pendingId <= 0) {
            throw new ApiException(422, 'run_id and pending_id are required');
        }
        $svc = new AgentService($user);
        Response::json($svc->confirm($runId, $pendingId, $approve));
    }
}
