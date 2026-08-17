'use client';

import { useRef } from 'react';
import Image from 'next/image';
import { RiArrowLeftSLine, RiArrowRightSLine } from '@remixicon/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface OutfitOption {
    id: string;
    renderUrl: string;
    garmentName: string;
    reason: string; // why the stylist agent picked this, e.g. "Complements your undertone"
}

interface OutfitCarouselProps {
    options: OutfitOption[];
    selectedId?: string;
    onSelect: (id: string) => void;
}

export function OutfitCarousel({
    options,
    selectedId,
    onSelect,
}: OutfitCarouselProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    const scrollBy = (dir: 1 | -1) => {
        scrollRef.current?.scrollBy({ left: dir * 280, behavior: 'smooth' });
    };

    return (
        <div className="relative">
            <div className="mb-3 flex items-center justify-between">
                <h2 className="font-serif text-xl">Outfits for you</h2>
                <div className="flex gap-1">
                    <Button variant="outline" size="icon" onClick={() => scrollBy(-1)}>
                        <RiArrowLeftSLine data-icon />
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => scrollBy(1)}>
                        <RiArrowRightSLine data-icon />
                    </Button>
                </div>
            </div>

            <div
                ref={scrollRef}
                className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 scrollbar-none"
            >
                {options.map((option) => (
                    <Card
                        key={option.id}
                        role="button"
                        onClick={() => onSelect(option.id)}
                        className={cn(
                            'w-64 shrink-0 snap-start overflow-hidden py-0 transition-all',
                            selectedId === option.id
                                ? 'ring-2 ring-accent'
                                : 'hover:opacity-90',
                        )}
                    >
                        <div className="relative aspect-3/4 w-full bg-muted">
                            <Image
                                src={option.renderUrl}
                                alt={option.garmentName}
                                fill
                                className="object-cover"
                            />
                            {selectedId === option.id && (
                                <Badge className="absolute top-2 right-2 bg-accent text-accent-foreground">
                                    Selected
                                </Badge>
                            )}
                        </div>
                        <CardContent className="flex flex-col gap-1 py-3">
                            <p className="text-sm font-medium">{option.garmentName}</p>
                            <p className="text-xs text-muted-foreground">{option.reason}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}