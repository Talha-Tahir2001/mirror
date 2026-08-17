import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { tasks, outfitRenders } from '@/db/schema';
import { getClothVtoTask } from '@/lib/youcam/cloth-vto';
import { persistYouCamResult, signedBlobUrl } from '@/lib/storage';

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
    if (!task || task.kind !== 'cloth_vto') {
        return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    if (task.status === 'success' || task.status === 'error') {
        const [render] = await db
            .select()
            .from(outfitRenders)
            .where(eq(outfitRenders.taskId, taskId));
        return NextResponse.json({
            status: task.status,
            renderUrl: await signedBlobUrl(render?.storedRenderUrl ?? null),
        });
    }

    const result = await getClothVtoTask(task.youcamTaskId);

    if (!result.isDone) {
        return NextResponse.json({ status: 'running' });
    }

    if (result.error || !result.url) {
        await db
            .update(tasks)
            .set({ status: 'error', completedAt: new Date() })
            .where(eq(tasks.id, taskId));
        return NextResponse.json({ status: 'error', error: result.error });
    }

    // Persist the render image before the 2h YouCam link dies.
    const storedRenderUrl = await persistYouCamResult(
        result.url,
        `outfit-renders/${task.lookId}`,
    );

    await db
        .update(tasks)
        .set({ status: 'success', completedAt: new Date() })
        .where(eq(tasks.id, taskId));

    await db
        .update(outfitRenders)
        .set({ storedRenderUrl })
        .where(eq(outfitRenders.taskId, taskId));

    return NextResponse.json({
        status: 'success',
        renderUrl: await signedBlobUrl(storedRenderUrl),
    });
}