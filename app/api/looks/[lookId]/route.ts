import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db';
import { looks, tasks, skinScans, outfitRenders, garments } from '@/db/schema';
import { signedBlobUrl } from '@/lib/storage';
import { generateNarrative } from '@/lib/agents/synthesis-agent';
import { SkinAnalysisOutputItem } from '@/types';


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

    // Skin task status
    const [skinTask] = await db
        .select()
        .from(tasks)
        .where(and(eq(tasks.lookId, lookId), eq(tasks.kind, 'skin_analysis')));

    // Outfit tasks (may be multiple — one per garment)
    const outfitTasks = await db
        .select()
        .from(tasks)
        .where(and(eq(tasks.lookId, lookId), eq(tasks.kind, 'cloth_vto')));

    // Persisted skin concerns (only present once skin task is done)
    const [skinScan] = await db
        .select()
        .from(skinScans)
        .where(eq(skinScans.lookId, lookId));

    // All outfit renders with garment name
    const renders = await db
        .select({
            id: outfitRenders.id,
            storedRenderUrl: outfitRenders.storedRenderUrl,
            reason: outfitRenders.reason,
            garmentName: garments.name,
        })
        .from(outfitRenders)
        .leftJoin(garments, eq(outfitRenders.garmentId, garments.id))
        .where(eq(outfitRenders.lookId, lookId));

    // The currently selected render (set by PATCH below)
    const selectedRender = look.selectedOutfitRenderId
        ? renders.find((r) => r.id === look.selectedOutfitRenderId)
        : renders.find((r) => r.storedRenderUrl); // default: first completed one

    const selectedOutfitUrl = await signedBlobUrl(
        selectedRender?.storedRenderUrl ?? null,
    );

    return NextResponse.json({
        id: look.id,
        occasionText: look.occasionText,
        skinTask: skinTask
            ? { id: skinTask.id, status: skinTask.status }
            : null,
        outfitTask: outfitTasks.length
            ? {
                // Aggregate: running if any are running, error only if all failed
                status: outfitTasks.some((t) => t.status === 'running')
                    ? 'running'
                    : outfitTasks.some((t) => t.status === 'success')
                        ? 'success'
                        : 'error',
            }
            : null,
        skinConcerns: skinScan
            ? (skinScan.concerns as SkinAnalysisOutputItem[])
            : null,
        selectedOutfitUrl,
        selectedOutfitName: selectedRender?.garmentName ?? null,
        narrative: look.narrative ?? null,
    });
}

// POST /api/looks/[lookId] — generate (and persist) the styling narrative.
// Combines the skin report + chosen outfit through the synthesis agent.
export async function POST(
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

    const [skinScan] = await db
        .select()
        .from(skinScans)
        .where(eq(skinScans.lookId, lookId));
    if (!skinScan) {
        return NextResponse.json(
            { error: 'Run the skin analysis first so the narrative can reference it' },
            { status: 400 },
        );
    }

    const renders = await db
        .select({
            storedRenderUrl: outfitRenders.storedRenderUrl,
            reason: outfitRenders.reason,
            garmentName: garments.name,
        })
        .from(outfitRenders)
        .leftJoin(garments, eq(outfitRenders.garmentId, garments.id))
        .where(eq(outfitRenders.lookId, lookId));

    const finished = renders.filter((r) => r.storedRenderUrl && r.reason);
    if (finished.length === 0) {
        return NextResponse.json(
            { error: 'No completed outfit renders with styling reasons yet' },
            { status: 400 },
        );
    }

    try {
        const narrative = await generateNarrative({
            occasionText: look.occasionText,
            occasionType: look.occasionType ?? 'general',
            formality: look.formality ?? 'smart_casual',
            skinConcerns: (skinScan.concerns as SkinAnalysisOutputItem[]).map((c) => ({
                type: c.type,
                ui_score: c.ui_score,
            })),
            garments: finished.map((r) => ({
                name: r.garmentName ?? 'Garment',
                reason: r.reason!,
            })),
        });

        await db
            .update(looks)
            .set({ narrative })
            .where(eq(looks.id, lookId));

        return NextResponse.json({ narrative });
    } catch (err) {
        console.error('narrative generation error:', err);
        return NextResponse.json(
            { error: 'Failed to generate styling narrative' },
            { status: 500 },
        );
    }
}

// PATCH /api/looks/[lookId] — persist the user's selected outfit
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ lookId: string }> },
) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { lookId } = await params;
    const { selectedOutfitRenderId } = await req.json();

    const [look] = await db.select().from(looks).where(
        and(eq(looks.id, lookId), eq(looks.userId, userId)),
    );
    if (!look) {
        return NextResponse.json({ error: 'Look not found' }, { status: 404 });
    }

    await db
        .update(looks)
        .set({ selectedOutfitRenderId })
        .where(eq(looks.id, lookId));

    return NextResponse.json({ ok: true });
}