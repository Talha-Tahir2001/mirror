// Path: components/photo-capture.tsx
'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { RiCameraLine, RiCloseLine, RiUserLine, RiCheckLine, RiLoader4Line } from '@remixicon/react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cropFaceForYouCam } from '@/lib/crop-face';

type ProcessingState = 'idle' | 'processing' | 'done';

interface PhotoSlotProps {
    label: string;
    hint: string;
    required?: boolean;
    file: File | null;
    processingState?: ProcessingState;
    onChange: (file: File | null) => void;
}

function PhotoSlot({
    label,
    hint,
    required,
    file,
    processingState = 'idle',
    onChange,
}: PhotoSlotProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    // Preview is built here in the event handler (not an effect) so it doesn't
    // trip the set-state-in-effect lint rule. It shows the selected original;
    // the parent may swap `file` for the analysis-prepared version afterwards.
    const handleFile = (f: File | null) => {
        setPreviewUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return f ? URL.createObjectURL(f) : null;
        });
        onChange(f);
    };

    return (
        <Card className="relative flex aspect-[3/4] flex-col items-center justify-center gap-2 overflow-hidden p-4 text-center">
            <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />

            {previewUrl && file ? (
                <>
                    <Image src={previewUrl} alt={label} fill className="object-cover" />

                    {/* Processing indicator */}
                    {processingState === 'processing' && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/60 backdrop-blur-sm">
                            <RiLoader4Line className="size-6 animate-spin text-primary" />
                            <span className="text-xs font-medium">Optimising…</span>
                        </div>
                    )}
                    {processingState === 'done' && (
                        <div className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
                            <RiCheckLine className="size-3" />
                            Ready
                        </div>
                    )}

                    <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        className="absolute top-2 right-2 z-10"
                        onClick={() => handleFile(null)}
                    >
                        <RiCloseLine className="size-4" />
                    </Button>
                </>
            ) : (
                <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    className="flex flex-col items-center gap-2 text-muted-foreground"
                >
                    <span className="flex size-12 items-center justify-center rounded-full bg-muted">
                        <RiCameraLine className="size-5" />
                    </span>
                    <span className="text-sm font-medium text-foreground">{label}</span>
                    <span className="text-xs">{hint}</span>
                    {required && <span className="text-xs text-primary">Required</span>}
                </button>
            )}
        </Card>
    );
}

interface PhotoCaptureProps {
    onChange: (photos: { face: File | null; body: File | null }) => void;
}

export function PhotoCapture({ onChange }: PhotoCaptureProps) {
    const [face, setFace] = useState<File | null>(null);
    const [body, setBody] = useState<File | null>(null);
    const [faceState, setFaceState] = useState<ProcessingState>('idle');
    const [faceWarning, setFaceWarning] = useState<string | null>(null);

    const handleFaceChange = async (f: File | null) => {
        if (!f) {
            setFace(null);
            setFaceState('idle');
            setFaceWarning(null);
            onChange({ face: null, body });
            return;
        }

        setFaceState('processing');
        setFaceWarning(null);
        setFace(f);
        onChange({ face: f, body });

        try {
            const { file, diagnostics } = await cropFaceForYouCam(f);
            setFace(file);
            setFaceState('done');

            const messages: string[] = [];
            if (diagnostics.warnings.includes('dark')) {
                messages.push('This photo looks dark — move to brighter light and retake for best results.');
            }
            if (diagnostics.warnings.includes('small')) {
                messages.push('This photo is quite low-res — try a closer, higher-resolution selfie.');
            }
            setFaceWarning(messages.length ? messages.join(' ') : null);

            onChange({ face: file, body });
        } catch {
            // Crop failed — just use the original, YouCam will tell us if it's bad
            setFace(f);
            setFaceState('done');
            onChange({ face: f, body });
        }
    };

    const handleBodyChange = (f: File | null) => {
        setBody(f);
        onChange({ face, body: f });
    };

    return (
        <div className="mx-auto w-full max-w-xl space-y-4">
            <div className="space-y-1.5">
                <h2 className="font-serif text-2xl">Show Mirror your look</h2>
                <p className="text-sm text-muted-foreground">
                    Upload a selfie for skin analysis. We automatically crop it to meet the analysis requirements — any clear front-facing photo works.
                </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <PhotoSlot
                        label="Selfie"
                        hint="Front-facing, good lighting"
                        required
                        file={face}
                        processingState={faceState}
                        onChange={handleFaceChange}
                    />
                    {faceWarning ? (
                        <p className="text-center text-xs text-amber-600 dark:text-amber-400">
                            {faceWarning}
                        </p>
                    ) : (
                        <p className="text-center text-xs text-muted-foreground">
                            Auto-cropped for analysis
                        </p>
                    )}
                </div>

                <div className="space-y-1.5">
                    <PhotoSlot
                        label="Full body"
                        hint="Optional — for outfit try-on"
                        file={body}
                        onChange={handleBodyChange}
                    />
                    <p className="text-center text-xs text-muted-foreground">
                        Standing, facing forward
                    </p>
                </div>
            </div>

            {!body && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <RiUserLine className="size-3.5 shrink-0" />
                    Skip the body photo to get skin results only.
                </p>
            )}
        </div>
    );
}