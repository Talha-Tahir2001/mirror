import { youcamFetch } from './client';
import type {
    ClothVtoTaskResponse,
    ClothVtoStatusResponse,
    GarmentCategory,
} from '@/types';

interface CreateClothVtoTaskParams {
    srcFileId: string; // uploaded user photo
    // Garment reference can be either an uploaded file_id or a public image
    // URL (e.g. straight from the garments catalog) — exactly one required.
    ref: { fileId: string } | { url: string };
    garmentCategory: GarmentCategory;
    changeShoes?: boolean;
}

export async function createClothVtoTask({
    srcFileId,
    ref,
    garmentCategory,
    changeShoes,
}: CreateClothVtoTaskParams): Promise<string> {
    const res = await youcamFetch<ClothVtoTaskResponse>(
        '/s2s/v2.0/task/cloth-v4',
        {
            method: 'POST',
            body: JSON.stringify({
                src_file_id: srcFileId,
                ...('fileId' in ref
                    ? { ref_file_id: ref.fileId }
                    : { ref_file_url: ref.url }),
                garment_category: garmentCategory,
                ...(changeShoes !== undefined ? { change_shoes: changeShoes } : {}),
            }),
        },
    );

    return res.data.task_id;
}

/**
 * Like the skin-analysis endpoint, cloth-v4 status responses nest under
 * `data.task_status` / `data.results.url` (verified against a live task).
 * A task is done when a render URL is present, or an error is reported;
 * anything else means it's still processing.
 */
export async function getClothVtoTask(
    taskId: string,
): Promise<{ isDone: boolean; url?: string; error?: string }> {
    const res = await youcamFetch<ClothVtoStatusResponse>(
        `/s2s/v2.0/task/cloth-v4/${taskId}`,
        { method: 'GET' },
    );

    const url = res.data?.results?.url;
    const error = res.data?.error;

    if (url) {
        return { isDone: true, url };
    }
    if (error) {
        return { isDone: true, error };
    }
    return { isDone: false };
}