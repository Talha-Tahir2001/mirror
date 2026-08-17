'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { OutfitCarousel, type OutfitOption } from '@/components/outfit-carousel';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export default function OutfitDetailPage() {
    const { lookId } = useParams<{ lookId: string }>();
    const [options, setOptions] = useState<OutfitOption[] | null>(null);
    const [selectedId, setSelectedId] = useState<string>();
    const [outfitStatus, setOutfitStatus] = useState<'running' | 'success' | 'error' | null | undefined>(undefined);

    const load = () => {
        fetch(`/api/looks/${lookId}/outfit`)
            .then((res) => res.json())
            .then((data) => {
                setOptions(data.options);
                setSelectedId(data.selectedId);
                setOutfitStatus(data.outfitStatus);
            })
            .catch(() => setOptions([]));
    };

    useEffect(load, [lookId]);

    const handleSelect = async (id: string) => {
        setSelectedId(id);
        await fetch(`/api/looks/${lookId}/outfit`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ selectedId: id }),
        });
    };

    if (options === null) {
        return (
            <div className="mx-auto max-w-3xl space-y-4">
                <Skeleton className="h-96 w-full rounded-xl" />
            </div>
        );
    }

    if (options.length === 0) {
        return (
            <div className="mx-auto max-w-3xl space-y-2 rounded-lg border border-dashed p-10 text-center">
                <p className="font-serif text-lg">
                    {outfitStatus === 'running'
                        ? 'Preparing your outfits…'
                        : outfitStatus === 'error'
                            ? 'Outfit generation failed'
                            : 'No outfit options yet'}
                </p>
                <p className="mx-auto max-w-md text-sm text-muted-foreground">
                    {outfitStatus === 'running'
                        ? 'Hold tight while your try-ons render.'
                        : outfitStatus === 'error'
                            ? 'This usually needs a clear, full-body photo. Start a new look and upload one.'
                            : 'Outfit try-ons are generated from a full-body photo. Start a new look and upload one to see options here.'}
                </p>
                <Button className="mt-2">
                    <Link href="/dashboard">Start a new look</Link>
                </Button>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-3xl space-y-4">
            <OutfitCarousel
                options={options}
                selectedId={selectedId}
                onSelect={handleSelect}
            />
        </div>
    );
}