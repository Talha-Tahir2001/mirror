interface PollOptions {
    intervalMs?: number;
    timeoutMs?: number;
}

/**
 * Polls `check()` until it returns { done: true } or the timeout elapses.
 * Task results stay queryable for 24h server-side, so this timeout is about
 * not blocking a request/UI forever, not about the task itself expiring.
 */
export async function pollUntilDone<T>(
    check: () => Promise<{ done: boolean; result?: T }>,
    { intervalMs = 2500, timeoutMs = 60_000 }: PollOptions = {},
): Promise<T> {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
        const { done, result } = await check();
        if (done) {
            if (result === undefined) {
                throw new Error('Task finished but no result was returned');
            }
            return result;
        }
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    throw new Error(`Polling timed out after ${timeoutMs}ms`);
}