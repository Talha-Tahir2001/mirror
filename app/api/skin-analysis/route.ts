import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { tasks } from '@/db/schema';
import { uploadImage } from '@/lib/youcam/upload';
import { createSkinAnalysisTask } from '@/lib/youcam/skin-analysis';
import { YouCamApiError } from '@/lib/youcam/client';

export async function POST(req: NextRequest) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const lookId = formData.get('lookId');
    const face = formData.get('face');

    if (typeof lookId !== 'string' || !(face instanceof File)) {
        return NextResponse.json(
            { error: 'lookId and face file are required' },
            { status: 400 },
        );
    }

    try {
        const bytes = Buffer.from(await face.arrayBuffer());
        const fileId = await uploadImage({
            fileName: face.name || 'face.jpg',
            contentType: face.type || 'image/jpeg',
            bytes,
        });

        const youcamTaskId = await createSkinAnalysisTask({ srcFileId: fileId });

        const [task] = await db
            .insert(tasks)
            .values({
                youcamTaskId,
                kind: 'skin_analysis',
                status: 'running',
                lookId,
            })
            .returning();

        return NextResponse.json({ task }, { status: 201 });
    } catch (err) {
        if (err instanceof YouCamApiError) {
            return NextResponse.json(
                { error: err.message, errorCode: err.errorCode },
                { status: err.status },
            );
        }
        console.error('skin-analysis route error:', err);
        return NextResponse.json(
            { error: 'Failed to start skin analysis' },
            { status: 500 },
        );
    }
}