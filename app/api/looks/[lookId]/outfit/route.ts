import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db';
import { looks, tasks, outfitRenders, garments } from '@/db/schema';
import { signedBlobUrl } from '@/lib/storage';

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ lookId: string }> },
) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { lookId } = await params;

    const [look] = await db.select().from(looks).where(
        and(eq(looks.id, lookId), eq(looks.userId, userId)),
    );
    if (!look) {
        return NextResponse.json({ error: 'Look not found' }, { status: 404 });
    }

    const renders = await db
        .select({
            id: outfitRenders.id,
            renderUrl: outfitRenders.storedRenderUrl,
            reason: outfitRenders.reason,
            garmentName: garments.name,
            garmentCategory: outfitRenders.garmentCategory,
        })
        .from(outfitRenders)
        .leftJoin(garments, eq(outfitRenders.garmentId, garments.id))
        .where(eq(outfitRenders.lookId, lookId));

    const outfitTasks = await db
        .select()
        .from(tasks)
        .where(and(eq(tasks.lookId, lookId), eq(tasks.kind, 'cloth_vto')));

    const outfitStatus = outfitTasks.length
        ? outfitTasks.some((t) => t.status === 'running')
            ? 'running'
            : outfitTasks.some((t) => t.status === 'success')
                ? 'success'
                : 'error'
        : null;

    // Normalise for the OutfitCarousel component shape. Private-blob URLs are
    // signed so the browser can load them.
    const options = [];
    for (const r of renders) {
        if (!r.renderUrl) continue;
        options.push({
            id: r.id,
            renderUrl: (await signedBlobUrl(r.renderUrl))!,
            garmentName: r.garmentName ?? r.garmentCategory,
            reason: r.reason ?? '',
        });
    }

    return NextResponse.json({
        options,
        selectedId: look.selectedOutfitRenderId ?? options[0]?.id ?? null,
        outfitStatus,
    });
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ lookId: string }> },
) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { lookId } = await params;
    const { selectedId } = await req.json();

    const [look] = await db.select().from(looks).where(
        and(eq(looks.id, lookId), eq(looks.userId, userId)),
    );
    if (!look) {
        return NextResponse.json({ error: 'Look not found' }, { status: 404 });
    }

    await db
        .update(looks)
        .set({ selectedOutfitRenderId: selectedId })
        .where(eq(looks.id, lookId));

    return NextResponse.json({ ok: true });
}