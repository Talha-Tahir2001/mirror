'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { SkinReportCard } from '@/components/skin-report-card';
import { Skeleton } from '@/components/ui/skeleton';
import type { SkinAnalysisOutputItem } from '@/types';

// TODO: expects GET /api/looks/[lookId]/skin returning the persisted
// concerns array — not built yet, see app/db/schema.ts skinScans table.
export default function SkinDetailPage() {
    const { lookId } = useParams<{ lookId: string }>();
    const [concerns, setConcerns] = useState<SkinAnalysisOutputItem[] | null>(
        null,
    );

    useEffect(() => {
        fetch(`/api/looks/${lookId}/skin`)
            .then((res) => res.json())
            .then((data) => setConcerns(data.concerns))
            .catch(() => setConcerns([]));
    }, [lookId]);

    return (
        <div className="mx-auto max-w-xl space-y-4">
            <h1 className="font-serif text-2xl">Full skin report</h1>
            {concerns ? (
                <SkinReportCard concerns={concerns} />
            ) : (
                <Skeleton className="h-96 w-full rounded-xl" />
            )}
        </div>
    );
}