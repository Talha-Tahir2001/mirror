import { youcamFetch } from './client';
import type { SkinAnalysisTaskResponse, SkinConcern } from '@/types';

// SD concerns worth asking for in the interview/occasion flow: things that are
// visible and plausibly fixable in a few days. Skipping wrinkle/age_spot/firmness —
// not fixable on a short timeframe and not what "meets the moment" for this use case.
export const DEFAULT_SD_CONCERNS: SkinConcern[] = [
    'redness',
    'acne',
    'texture',
    'oiliness',
    'dark_circle_v2',
    'moisture',
];

interface CreateSkinAnalysisTaskParams {
    srcFileId: string;
    concerns?: SkinConcern[];
}

interface CreateTaskResponse {
    status: number;
    data: { task_id: string };
}

/**
 * NOTE: this assumes the v2.1 request body has the same shape as v2.0
 * (src_file_id / dst_actions / format) — the docs we have confirm v2.1 changed
 * the underlying engine and output resolution, not the request schema, but this
 * is worth a one-off Playground check before relying on it in the demo.
 */
export async function createSkinAnalysisTask({
    srcFileId,
    concerns = DEFAULT_SD_CONCERNS,
}: CreateSkinAnalysisTaskParams): Promise<string> {
    const res = await youcamFetch<CreateTaskResponse>(
        '/s2s/v2.1/task/skin-analysis',
        {
            method: 'POST',
            body: JSON.stringify({
                src_file_id: srcFileId,
                dst_actions: concerns,
                format: 'json', // JSON gives us output[] directly, no zip to unpack
            }),
        },
    );

    return res.data.task_id;
}

export async function getSkinAnalysisTask(
    taskId: string,
): Promise<SkinAnalysisTaskResponse> {
    return youcamFetch<SkinAnalysisTaskResponse>(
        `/s2s/v2.1/task/skin-analysis/${taskId}`,
        { method: 'GET' },
    );
}