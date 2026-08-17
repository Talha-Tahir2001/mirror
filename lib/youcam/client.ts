const YOUCAM_API_BASE = 'https://yce-api-01.makeupar.com';

export class YouCamApiError extends Error {
    constructor(
        message: string,
        public status: number,
        public errorCode?: string,
    ) {
        super(message);
        this.name = 'YouCamApiError';
    }
}

function apiKey(): string {
    const key = process.env.YOUCAM_API_KEY;
    if (!key) {
        throw new Error('YOUCAM_API_KEY is not set');
    }
    return key;
}

/**
 * Thin wrapper around fetch for YouCam's s2s endpoints.
 * Throws YouCamApiError on non-2xx so callers don't have to check res.ok everywhere.
 */
export async function youcamFetch<T>(
    path: string,
    init?: RequestInit,
): Promise<T> {
    const res = await fetch(`${YOUCAM_API_BASE}${path}`, {
        ...init,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey()}`,
            ...init?.headers,
        },
    });

    const body = await res.json();

    if (!res.ok) {
        throw new YouCamApiError(
            body?.error ?? `YouCam API error (${res.status})`,
            res.status,
            body?.error_code,
        );
    }

    return body as T;
}

/**
 * Uploads raw file bytes to the presigned URL returned by the File API.
 * This is a separate, non-authenticated request — the presigned URL carries
 * its own auth via the query string signature.
 */
export async function uploadToPresignedUrl(
    url: string,
    method: string,
    headers: Record<string, string>,
    body: Buffer | Blob,
): Promise<void> {
    const res = await fetch(url, {
        method,
        headers,
        body: body as any,
    });

    if (!res.ok) {
        throw new Error(
            `Failed to upload file to presigned URL: ${res.status} ${res.statusText}`,
        );
    }
}