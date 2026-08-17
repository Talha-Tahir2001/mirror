import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { looks, garments, tasks, outfitRenders, skinScans } from '@/db/schema';
import { uploadImage } from '@/lib/youcam/upload';
import { createClothVtoTask } from '@/lib/youcam/cloth-vto';
import { YouCamApiError } from '@/lib/youcam/client';
import { runMirrorGraph } from '@/lib/agents/graph';
import type { ParsedOccasion } from '@/lib/agents/planner';
import { SkinAnalysisOutputItem } from '@/types';


export async function POST(req: NextRequest) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const lookId = formData.get('lookId');
    const body = formData.get('body');

    if (typeof lookId !== 'string' || !(body instanceof File)) {
        return NextResponse.json(
            { error: 'lookId and body file are required' },
            { status: 400 },
        );
    }

    const [look] = await db.select().from(looks).where(eq(looks.id, lookId));
    if (!look || look.userId !== userId) {
        return NextResponse.json({ error: 'Look not found' }, { status: 404 });
    }

    const catalog = await db.select().from(garments);
    if (catalog.length === 0) {
        return NextResponse.json(
            { error: 'Garment catalog is empty — run the seed script first' },
            { status: 500 },
        );
    }

    // Best-effort: pull in skin concerns if that scan already finished, so the
    // stylist agent can factor color into its reasoning.
    const [existingScan] = await db
        .select()
        .from(skinScans)
        .where(eq(skinScans.lookId, lookId));
    const skinConcerns = (
        (existingScan?.concerns as SkinAnalysisOutputItem[] | undefined) ?? []
    ).map((c) => ({ type: c.type, ui_score: c.ui_score }));

    try {
        const occasion: ParsedOccasion = {
            occasionType: look.occasionType ?? 'general',
            formality: (look.formality as ParsedOccasion['formality']) ?? 'smart_casual',
            timeframeDays: look.timeframeDays ?? 3,
        };

        const selections = await runMirrorGraph({
            occasionText: look.occasionText,
            occasion,
            catalog,
            skinConcerns,
        });

        if (selections.length === 0) {
            return NextResponse.json(
                { error: 'Stylist agent did not return any valid selections' },
                { status: 502 },
            );
        }

        // Upload the body photo once — reused as src for all garment VTO tasks.
        const bytes = Buffer.from(await body.arrayBuffer());
        const srcFileId = await uploadImage({
            fileName: body.name || 'body.jpg',
            contentType: body.type || 'image/jpeg',
            bytes,
        });

        const created = [];
        for (const selection of selections) {
            const garment = catalog.find((g) => g.id === selection.garmentId)!;

            const youcamTaskId = await createClothVtoTask({
                srcFileId,
                ref: { url: garment.imageUrl }, // catalog images are public URLs
                garmentCategory: garment.category,
            });

            const [task] = await db
                .insert(tasks)
                .values({
                    youcamTaskId,
                    kind: 'cloth_vto',
                    status: 'running',
                    lookId,
                })
                .returning();

            const [render] = await db
                .insert(outfitRenders)
                .values({
                    lookId,
                    taskId: task.id,
                    garmentId: garment.id,
                    garmentCategory: garment.category,
                    refImageUrl: garment.imageUrl,
                    reason: selection.reason,
                })
                .returning();

            created.push({ task, render });
        }

        return NextResponse.json({ created }, { status: 201 });
    } catch (err) {
        if (err instanceof YouCamApiError) {
            return NextResponse.json(
                { error: err.message, errorCode: err.errorCode },
                { status: err.status },
            );
        }
        console.error('cloth-vto route error:', err);
        return NextResponse.json(
            { error: 'Failed to start outfit try-on' },
            { status: 500 },
        );
    }
}