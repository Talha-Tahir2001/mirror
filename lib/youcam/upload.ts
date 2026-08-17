import { youcamFetch, uploadToPresignedUrl } from './client';
import type { FileUploadResponse } from '@/types/index';

interface UploadImageParams {
    fileName: string;
    contentType: string; // e.g. 'image/jpg'
    bytes: Buffer;
}

/**
 * Full two-step YouCam upload: register the file to get a file_id + presigned
 * URL, then PUT the actual bytes to that URL. Returns the file_id, which is
 * what task-creation endpoints (skin-analysis, cloth-v4) expect as src_file_id
 * or ref_file_id.
 */
export async function uploadImage({
    fileName,
    contentType,
    bytes,
}: UploadImageParams): Promise<string> {
    const registerRes = await youcamFetch<FileUploadResponse>('/s2s/v2.0/file', {
        method: 'POST',
        body: JSON.stringify({
            files: [
                {
                    content_type: contentType,
                    file_name: fileName,
                    file_size: bytes.length,
                },
            ],
        }),
    });

    const file = registerRes.data.files[0];
    const uploadRequest = file.requests[0];

    await uploadToPresignedUrl(
        uploadRequest.url,
        uploadRequest.method,
        uploadRequest.headers,
        bytes,
    );

    return file.file_id;
}