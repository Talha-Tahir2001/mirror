import { put, getDownloadUrl, issueSignedToken, presignUrl } from '@vercel/blob';

/**
 * Downloads a YouCam result (mask image or VTO render) from its temporary
 * signed URL and re-uploads it to our own Vercel Blob storage, returning the
 * file URL. Must be called immediately after a task hits "success" — the
 * source URL is only valid for 2 hours.
 *
 * Files are uploaded with private access so this works regardless of whether
 * the Blob store is configured public or private; callers that need to render
 * the URL (e.g. an <img>) must pass it through `signedBlobUrl` first.
 */
export async function persistYouCamResult(
    sourceUrl: string,
    pathPrefix: string, // e.g. `skin-scans/${lookId}` or `outfit-renders/${lookId}`
): Promise<string> {
    const res = await fetch(sourceUrl);
    if (!res.ok) {
        throw new Error(
            `Failed to download YouCam result from ${sourceUrl}: ${res.status}`,
        );
    }

    const contentType = res.headers.get('content-type') ?? 'image/png';
    const bytes = await res.arrayBuffer();
    const extension = contentType.includes('png') ? 'png' : 'jpg';
    const fileName = `${pathPrefix}/${crypto.randomUUID()}.${extension}`;

    const blob = await put(fileName, bytes, {
        access: 'private',
        contentType,
    });

    return blob.url;
}

/**
 * Same idea, but for a batch of URLs (e.g. skin analysis mask_urls[] across
 * several concerns). Runs in parallel since each is an independent fetch+upload.
 */
export async function persistYouCamResults(
    sourceUrls: string[],
    pathPrefix: string,
): Promise<string[]> {
    return Promise.all(
        sourceUrls.map((url) => persistYouCamResult(url, pathPrefix)),
    );
}

/**
 * Produces a short-lived signed URL for a private blob so it can be rendered
 * client-side. `getDownloadUrl()` only appends `?download=1` and is NOT
 * authenticated, so private stores 403 with it — instead we issue a scoped
 * `get` delegation token and sign the concrete URL with `presignUrl()`.
 * Returns the original URL unchanged if it isn't a blob URL.
 */
export async function signedBlobUrl(
    url: string | null | undefined,
): Promise<string | null> {
    if (!url) return null;
    try {
        const { pathname, hostname } = new URL(url);
        const cleanPath = pathname.replace(/^\//, '');
        const access = hostname.includes('.private.blob.')
            ? 'private'
            : 'public';

        const signedToken = await issueSignedToken({
            pathname: cleanPath,
            operations: ['get'],
        });

        // Sign the concrete blob URL with a short-lived delegation. The
        // pathname must match the token scope; the host is rebuilt from the
        // embedded store id + access, which is why `access` is passed too.
        const presignOptions = {
            operation: 'get' as const,
            pathname: cleanPath,
            access,
        };
        const { presignedUrl } = await presignUrl(
            signedToken,
            presignOptions as Parameters<typeof presignUrl>[1] & {
                access: 'private' | 'public';
            },
        );
        return presignedUrl;
    } catch (err) {
        console.warn(
            'signedBlobUrl presign failed, falling back to download URL:',
            (err as Error).message,
        );
        return getDownloadUrl(url);
    }
}