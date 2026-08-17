import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { desc, and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { looks, tasks, skinScans } from '@/db/schema';
import { parseOccasion } from '@/lib/agents/planner';
import { SkinAnalysisOutputItem } from '@/types';

export async function POST(req: NextRequest) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { occasionText } = await req.json();
    if (!occasionText || typeof occasionText !== 'string') {
        return NextResponse.json(
            { error: 'occasionText is required' },
            { status: 400 },
        );
    }

    const parsed = parseOccasion(occasionText);

    const [look] = await db
        .insert(looks)
        .values({
            userId,
            occasionText,
            occasionType: parsed.occasionType,
            formality: parsed.formality,
            timeframeDays: parsed.timeframeDays,
        })
        .returning();

    return NextResponse.json({ look }, { status: 201 });
}

interface LookAggregate {
    skinTask: { status: string; errorCode: string | null } | null;
    outfitCounts: { running: number; success: number; error: number } | null;
    concerns: SkinAnalysisOutputItem[];
}

// GET /api/looks — recent looks for this user, summarized for a history list.
export async function GET() {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const recent = await db
        .select()
        .from(looks)
        .where(eq(looks.userId, userId))
        .orderBy(desc(looks.createdAt))
        .limit(20);

    if (recent.length === 0) {
        return NextResponse.json([]);
    }

    const lookIds = recent.map((l) => l.id);

    const [skinTasks, outfitTasks, scans] = await Promise.all([
        db
            .select()
            .from(tasks)
            .where(and(inArray(tasks.lookId, lookIds), eq(tasks.kind, 'skin_analysis'))),
        db
            .select()
            .from(tasks)
            .where(and(inArray(tasks.lookId, lookIds), eq(tasks.kind, 'cloth_vto'))),
        db.select().from(skinScans).where(inArray(skinScans.lookId, lookIds)),
    ]);

    const byLook = new Map<string, LookAggregate>();
    for (const id of lookIds) {
        byLook.set(id, { skinTask: null, outfitCounts: null, concerns: [] });
    }

    for (const t of skinTasks) {
        const agg = byLook.get(t.lookId);
        if (agg) agg.skinTask = { status: t.status, errorCode: t.errorCode };
    }
    for (const t of outfitTasks) {
        const agg = byLook.get(t.lookId);
        if (agg) {
            agg.outfitCounts ??= { running: 0, success: 0, error: 0 };
            agg.outfitCounts[t.status as 'running' | 'success' | 'error']++;
        }
    }
    for (const s of scans) {
        const agg = byLook.get(s.lookId);
        if (agg) agg.concerns = s.concerns as SkinAnalysisOutputItem[];
    }

    return NextResponse.json(
        recent.map((look) => {
            const agg = byLook.get(look.id)!;
            const o = agg.outfitCounts;
            const outfitStatus = !o
                ? null
                : o.running > 0
                    ? 'running'
                    : o.success > 0
                        ? 'success'
                        : 'error';
            return {
                id: look.id,
                occasionText: look.occasionText,
                createdAt: look.createdAt,
                skinTask: agg.skinTask,
                outfitStatus,
                concerns: agg.concerns,
            };
        }),
    );
}