'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { OccasionInput } from '@/components/occasion-input';
import { PhotoCapture } from '@/components/photo-capture';
import { CONCERN_META } from '@/components/skin-report-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { SkinAnalysisOutputItem } from '@/types';

type Step = 'occasion' | 'photos';

interface LookHistoryItem {
    id: string;
    occasionText: string;
    createdAt: string;
    skinTask: { status: 'running' | 'success' | 'error'; errorCode: string | null } | null;
    outfitStatus: 'running' | 'success' | 'error' | null;
    concerns: SkinAnalysisOutputItem[];
}

const ERROR_LABELS: Record<string, string> = {
    error_lighting_dark: 'photo too dark',
    error_below_min_image_size: 'photo too small',
    error_exceed_max_image_size: 'photo too large',
    error_src_face_too_small: 'face too small',
    error_src_face_out_of_bound: 'face cut off',
    error_no_face: 'no face detected',
};

function statusCopy(item: LookHistoryItem): { text: string; tone: 'ok' | 'err' | 'run' } {
    if (item.skinTask?.status === 'running') {
        return { text: 'Analyzing skin…', tone: 'run' };
    }
    if (item.skinTask?.status === 'error') {
        const hint = item.skinTask.errorCode
            ? ` · ${ERROR_LABELS[item.skinTask.errorCode] ?? 'try again'}`
            : '';
        return { text: `Skin failed${hint}`, tone: 'err' };
    }
    if (item.skinTask?.status === 'success') {
        const outfitText =
            item.outfitStatus === 'running'
                ? ' · outfit running'
                : item.outfitStatus === 'success'
                    ? ' · outfit ready'
                    : item.outfitStatus === 'error'
                        ? ' · outfit failed'
                        : '';
        return { text: `Skin ready${outfitText}`, tone: 'ok' };
    }
    return { text: 'Starting…', tone: 'run' };
}

function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.max(1, Math.floor(diff / 60000));
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

const BADGE_TONE: Record<string, string> = {
    ok: 'bg-primary text-primary-foreground',
    err: 'bg-destructive/10 text-destructive',
    run: 'bg-muted text-muted-foreground',
};

export default function DashboardPage() {
    const router = useRouter();
    const [step, setStep] = useState<Step>('occasion');
    const [occasionText, setOccasionText] = useState('');
    const [photos, setPhotos] = useState<{ face: File | null; body: File | null }>({
        face: null,
        body: null,
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [history, setHistory] = useState<LookHistoryItem[] | null>(null);

    const loadHistory = () => {
        fetch('/api/looks')
            .then((r) => r.json())
            .then(setHistory)
            .catch(() => setHistory([]));
    };

    useEffect(loadHistory, []);

    const handleOccasionSubmit = (text: string) => {
        setOccasionText(text);
        setStep('photos');
    };

    const handleStartAnalysis = async () => {
        if (!photos.face) return;
        setIsSubmitting(true);
        setError(null);

        try {
            const lookRes = await fetch('/api/looks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ occasionText }),
            });
            if (!lookRes.ok) throw new Error('Could not start this look');
            const { look } = await lookRes.json();

            const formData = new FormData();
            formData.append('lookId', look.id);
            formData.append('face', photos.face);
            if (photos.body) formData.append('body', photos.body);

            await fetch('/api/skin-analysis', { method: 'POST', body: formData });
            if (photos.body) {
                await fetch('/api/cloth-vto', { method: 'POST', body: formData });
            }

            router.push(`/looks/${look.id}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Something went wrong');
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex w-full flex-col items-center gap-10">
            <div className="flex min-h-[60vh] flex-col items-center justify-center">
                {step === 'occasion' && (
                    <OccasionInput onSubmit={handleOccasionSubmit} />
                )}

                {step === 'photos' && (
                    <div className="flex w-full max-w-xl flex-col gap-6">
                        <PhotoCapture onChange={setPhotos} />
                        {error && <p className="text-sm text-destructive">{error}</p>}
                        <div className="flex items-center gap-3">
                            <Button variant="ghost" onClick={() => setStep('occasion')}>
                                Back
                            </Button>
                            <Button
                                onClick={handleStartAnalysis}
                                disabled={!photos.face || isSubmitting}
                            >
                                {isSubmitting ? 'Starting…' : 'Analyze my look'}
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            <Card className="w-full max-w-xl">
                <CardHeader>
                    <CardTitle className="font-serif text-lg">Recent looks</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col">
                    {history === null ? (
                        <p className="text-sm text-muted-foreground">Loading…</p>
                    ) : history.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            No looks yet — start one above and your results will show up here.
                        </p>
                    ) : (
                        history.map((item) => {
                            const status = statusCopy(item);
                            const topConcerns = item.concerns
                                .filter((c) => CONCERN_META[c.type])
                                .slice(0, 2);
                            return (
                                <Link
                                    key={item.id}
                                    href={`/looks/${item.id}`}
                                    className="-mx-2 flex items-center justify-between gap-3 rounded-none px-2 py-2.5 transition-colors hover:bg-muted/60"
                                >
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-medium">
                                            {item.occasionText}
                                        </p>
                                        <p className="truncate text-xs text-muted-foreground">
                                            {item.skinTask?.status === 'success' && topConcerns.length
                                                ? topConcerns
                                                      .map((c) => `${CONCERN_META[c.type].label} ${c.ui_score}`)
                                                      .join(' · ')
                                                : timeAgo(item.createdAt)}
                                        </p>
                                    </div>
                                    <Badge className={BADGE_TONE[status.tone]}>
                                        {status.text}
                                    </Badge>
                                </Link>
                            );
                        })
                    )}
                </CardContent>
            </Card>
        </div>
    );
}