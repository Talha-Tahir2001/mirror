import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db';
import { looks, skinScans } from '@/db/schema';
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

    const [scan] = await db
        .select()
        .from(skinScans)
        .where(eq(skinScans.lookId, lookId));

    if (!scan) {
        return NextResponse.json(
            { concerns: null, status: 'pending' },
            { status: 202 },
        );
    }

    return NextResponse.json({
        concerns: scan.concerns as SkinAnalysisOutputItem[],
        storedMaskUrls: scan.storedMaskUrls,
        mode: scan.mode,
        status: 'success',
    });
}