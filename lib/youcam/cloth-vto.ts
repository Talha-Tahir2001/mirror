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
 * NOTE: the cloth-v4 status docs we have only document the *success* response
 * shape ({ url }) and error shapes — unlike skin-analysis, no explicit
 * `task_status: "running"` field is documented for this endpoint. This helper
 * treats "no url yet" as still running, which matches the documented examples,
 * but this is worth confirming with one real polling cycle in the Playground
 * before the demo — if the running-state response looks different than
 * expected, the isDone check below needs adjusting.
 */
export async function getClothVtoTask(
    taskId: string,
): Promise<{ isDone: boolean; url?: string; error?: string }> {
    const res = await youcamFetch<ClothVtoStatusResponse>(
        `/s2s/v2.0/task/cloth-v4/${taskId}`,
        { method: 'GET' },
    );

    if (res.url) {
        return { isDone: true, url: res.url };
    }
    if (res.error) {
        return { isDone: true, error: res.error };
    }
    return { isDone: false };
}