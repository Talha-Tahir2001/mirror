// Path: app/api/skin-analysis/[taskId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { tasks, skinScans } from '@/db/schema';
import { getSkinAnalysisTask } from '@/lib/youcam/skin-analysis';
import { persistYouCamResults } from '@/lib/storage';
import { SkinAnalysisOutputItem } from '@/types';


// YouCam returns either the short code ("error_src_face_too_small") or a
// human-readable sentence — check for both in every branch.
function parseYouCamError(errorStr: string | null): {
    code: string;
    userMessage: string;
} {
    if (!errorStr) {
        return { code: 'unknown', userMessage: 'Something went wrong. Please try again.' };
    }

    if (
        errorStr === 'error_below_min_image_size' ||
        errorStr.includes('below the minimum') ||
        errorStr.includes('minimum required resolution')
    ) {
        return {
            code: 'error_below_min_image_size',
            userMessage: 'The photo resolution is too low. Try using your phone camera directly and upload the original file without compressing it.',
        };
    }

    if (
        errorStr === 'error_exceed_max_image_size' ||
        (errorStr.includes('exceed') && errorStr.includes('size')) ||
        errorStr.includes('too large') ||
        errorStr.includes('maximum size')
    ) {
        return {
            code: 'error_exceed_max_image_size',
            userMessage: 'The photo resolution is too high. A standard-resolution selfie works best.',
        };
    }

    if (
        errorStr === 'error_src_face_too_small' ||
        errorStr.includes('too small') ||
        errorStr.includes('60%')
    ) {
        return {
            code: 'error_src_face_too_small',
            userMessage: 'Your face needs to fill most of the photo. Try a closer selfie — like a passport photo.',
        };
    }

    if (
        errorStr === 'error_lighting_dark' ||
        errorStr.includes('dark') ||
        errorStr.includes('lighting')
    ) {
        return {
            code: 'error_lighting_dark',
            userMessage: 'The photo is too dark. Find a well-lit spot and try again.',
        };
    }

    if (
        errorStr === 'error_no_face' ||
        errorStr.includes('no face') ||
        errorStr.includes('face not detected')
    ) {
        return {
            code: 'error_no_face',
            userMessage: "We couldn't detect a face. Make sure you're looking directly at the camera.",
        };
    }

    if (
        errorStr === 'error_src_face_out_of_bound' ||
        errorStr.includes('out of bound')
    ) {
        return {
            code: 'error_src_face_out_of_bound',
            userMessage: 'Your face is cut off at the edges. Center your face in the frame and try again.',
        };
    }

    // Return the raw code as the code so it's at least visible in logs
    return {
        code: errorStr,
        userMessage: 'Analysis failed. Please try again with a clearer photo.',
    };
}

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ taskId: string }> },
) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { taskId } = await params;

    const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
    if (!task || task.kind !== 'skin_analysis') {
        return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Already resolved — skip hitting YouCam again.
    if (task.status === 'success' || task.status === 'error') {
        return NextResponse.json({ status: task.status, errorCode: task.errorCode });
    }

    let youcamResult;
    try {
        youcamResult = await getSkinAnalysisTask(task.youcamTaskId);
    } catch (err) {
        console.error('[skin-analysis poll] YouCam fetch failed:', err);
        return NextResponse.json({ status: 'running' });
    }

    const youcamStatus = youcamResult.data.task_status;
    console.log(
        `[skin-analysis poll] task=${taskId} youcam_status=${youcamStatus} error=${youcamResult.data.error ?? 'none'}`,
    );

    if (youcamStatus === 'running') {
        return NextResponse.json({ status: 'running' });
    }

    if (youcamStatus === 'error') {
        const errorStr = youcamResult.data.error_message ?? youcamResult.data.error;
        const { code, userMessage } = parseYouCamError(errorStr);
        console.error(
            `[skin-analysis poll] YouCam error for task=${taskId}: ${code} — ${youcamResult.data.error}`,
        );

        await db
            .update(tasks)
            .set({ status: 'error', errorCode: code, completedAt: new Date() })
            .where(eq(tasks.id, taskId));

        return NextResponse.json({ status: 'error', errorCode: code, userMessage });
    }

    // Success — update task row.
    await db
        .update(tasks)
        .set({ status: 'success', completedAt: new Date() })
        .where(eq(tasks.id, taskId));

    const output: SkinAnalysisOutputItem[] = youcamResult.data.results?.output ?? [];

    if (output.length === 0) {
        console.warn('[skin-analysis poll] YouCam returned success but empty output array');
    }

    const allMaskUrls = output.flatMap((item) => item.mask_urls ?? []);
    let storedMaskUrls: string[] = [];

    if (allMaskUrls.length > 0) {
        try {
            storedMaskUrls = await persistYouCamResults(allMaskUrls, `skin-scans/${task.lookId}`);
        } catch (err) {
            console.error('[skin-analysis poll] Failed to persist mask images:', err);
        }
    }

    await db.insert(skinScans).values({
        lookId: task.lookId,
        taskId: task.id,
        mode: 'sd',
        concerns: output,
        storedMaskUrls,
    });

    return NextResponse.json({ status: 'success', output });
}