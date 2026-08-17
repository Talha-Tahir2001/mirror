'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { RiArrowRightLine } from '@remixicon/react';

const SUGGESTIONS = ['Job interview Friday', 'First date tonight', 'Wedding next month', 'Everyday'];

interface OccasionInputProps {
    onSubmit: (occasionText: string) => void;
    isSubmitting?: boolean;
}

export function OccasionInput({ onSubmit, isSubmitting }: OccasionInputProps) {
    const [value, setValue] = useState('');

    const handleSubmit = () => {
        if (value.trim()) onSubmit(value.trim());
    };

    return (
        <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
            <div className="flex flex-col gap-1.5">
                <h1 className="font-serif text-3xl">What&apos;s the occasion?</h1>
                <p className="text-muted-foreground">
                    Tell Mirror what you&apos;re getting ready for, and it&apos;ll figure out what your skin and outfit need.
                </p>
            </div>

            <Textarea
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Job interview Friday..."
                rows={3}
                className="text-base"
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmit();
                    }
                }}
            />

            <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                    <button
                        key={s}
                        type="button"
                        onClick={() => setValue(s)}
                        className="rounded-full border px-3 py-1 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                    >
                        {s}
                    </button>
                ))}
            </div>

            <Button
                onClick={handleSubmit}
                disabled={!value.trim() || isSubmitting}
                className="self-start"
            >
                {isSubmitting ? 'Starting…' : 'Continue'}
                <RiArrowRightLine data-icon="inline-end" />
            </Button>
        </div>
    );
}