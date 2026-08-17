'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { AgentStatus, type AgentStep } from '@/components/agent-status';
import { SkinReportCard, CONCERN_META } from '@/components/skin-report-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SkinAnalysisOutputItem } from '@/types';


interface TaskRef {
    id: string;
    status: 'running' | 'success' | 'error';
    errorCode?: string;
    userMessage?: string; // set by the polling route on error
}

interface LookDetail {
    id: string;
    occasionText: string;
    skinTask: TaskRef | null;
    outfitTask: { status: 'running' | 'success' | 'error' } | null;
    outfitTasks: { id: string; status: 'running' | 'success' | 'error' }[];
    skinConcerns: SkinAnalysisOutputItem[] | null;
    selectedOutfitUrl: string | null;
    selectedOutfitName: string | null;
    narrative: string | null;
}

// Polls a single YouCam task endpoint until it resolves, calling onDone when
// it transitions out of "running". Cleans up on unmount.
function useTaskPoller(
    taskId: string | undefined,
    kind: 'skin-analysis' | 'cloth-vto',
    onDone: (data?: Record<string, string>) => void,
) {
    const onDoneRef = useRef(onDone);
    useEffect(() => {
        onDoneRef.current = onDone;
    });

    useEffect(() => {
        if (!taskId) return;

        let cancelled = false;

        const poll = async () => {
            try {
                const res = await fetch(`/api/${kind}/${taskId}`);
                if (cancelled || !res.ok) return;
                const data = await res.json();
                if (data.status === 'success' || data.status === 'error') {
                    clearInterval(interval);
                    if (!cancelled) onDoneRef.current(data);
                }
            } catch {
                // network glitch — keep polling
            }
        };

        // Kick off immediately, then every 2.5s
        const interval = setInterval(poll, 2500);
        poll();
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [taskId, kind]);
}

export default function LookPage() {
    const { lookId } = useParams<{ lookId: string }>();
    const [look, setLook] = useState<LookDetail | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const [skinErrorMessage, setSkinErrorMessage] = useState<string | null>(null);
    const [generatingNarrative, setGeneratingNarrative] = useState(false);

    // Fetch the look detail (status + results) from our look endpoint.
    // Re-fetches whenever refreshKey bumps (triggered by task pollers finishing).
    useEffect(() => {
        let cancelled = false;
        fetch(`/api/looks/${lookId}`)
            .then((r) => r.json())
            .then((data) => { if (!cancelled) setLook(data); })
            .catch(() => { });
        return () => { cancelled = true; };
    }, [lookId, refreshKey]);

    const bump = (data?: Record<string, string>) => {
        if (data?.userMessage) setSkinErrorMessage(data.userMessage);
        setRefreshKey((k) => k + 1);
    };

    const handleGenerateNarrative = async () => {
        setGeneratingNarrative(true);
        try {
            await fetch(`/api/looks/${lookId}`, { method: 'POST' });
        } catch {
            // network glitch — button stays enabled via the refresh below
        }
        setGeneratingNarrative(false);
        setRefreshKey((k) => k + 1);
    };

    // These two hooks drive the actual YouCam polling — they call the
    // task-specific routes that advance the status in our DB, then trigger
    // a look re-fetch so the UI updates.
    useTaskPoller(
        look?.skinTask?.status === 'running' ? look.skinTask.id : undefined,
        'skin-analysis',
        bump,
    );

    // For outfit tasks we poll each running task through the cloth-vto
    // endpoint, which advances the task (and persists the render) in our DB,
    // then re-fetch the look so the UI updates.
    useEffect(() => {
        if (!look) return;
        if (look.outfitTask?.status !== 'running') return;

        let cancelled = false;
        let tasks = look.outfitTasks;

        const tick = async () => {
            await Promise.all(
                tasks
                    .filter((t) => t.status === 'running')
                    .map((t) =>
                        fetch(`/api/cloth-vto/${t.id}`).catch(() => null),
                    ),
            );

            const res = await fetch(`/api/looks/${lookId}`);
            if (cancelled || !res.ok) return;
            const data: LookDetail = await res.json();
            tasks = data.outfitTasks ?? [];
            setLook(data);
            if (data.outfitTask?.status !== 'running') clearInterval(interval);
        };

        const interval = setInterval(tick, 2500);
        tick();

        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [lookId, look?.outfitTask?.status]);

    if (!look) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center">
                <AgentStatus
                    steps={[{ id: 'load', label: 'Loading your look…', status: 'active' }]}
                />
            </div>
        );
    }

    const skinStatus = look.skinTask?.status ?? 'running';
    const outfitStatus = look.outfitTask?.status ?? null;
    const isProcessing = skinStatus === 'running' || outfitStatus === 'running';
    const hasFailed = skinStatus === 'error' && !look.skinConcerns;

    if (hasFailed) {
        return (
            <div className="mx-auto max-w-2xl space-y-4">
                <div>
                    <p className="text-sm text-muted-foreground">Your look for</p>
                    <h1 className="font-serif text-2xl">{look.occasionText}</h1>
                </div>
                <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 space-y-2">
                    <p className="text-sm font-medium text-destructive">Skin analysis didn&apos;t complete</p>
                    <p className="text-sm text-muted-foreground">
                        {skinErrorMessage ?? "This usually means the photo wasn't clear enough — try a closer, well-lit selfie with your face filling most of the frame."}
                    </p>
                </div>
                <Button>
                    <Link href="/dashboard">Try again</Link>
                </Button>
            </div>
        );
    }

    if (isProcessing) {
        const steps: AgentStep[] = [
            { id: 'read', label: 'Reading the occasion', status: 'done' },
            {
                id: 'skin',
                label: 'Checking your skin',
                status:
                    skinStatus === 'success' ? 'done'
                        : skinStatus === 'error' ? 'error'
                            : 'active',
            },
            ...(outfitStatus !== null
                ? [{
                    id: 'outfit',
                    label: 'Matching outfits to your skin tone',
                    status:
                        outfitStatus === 'success' ? 'done'
                            : outfitStatus === 'error' ? 'error'
                                : ('active' as const),
                } as AgentStep]
                : []),
        ];

        return (
            <div className="flex min-h-[60vh] items-center justify-center">
                <AgentStatus steps={steps} />
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-2xl space-y-6">
            <div>
                <p className="text-sm text-muted-foreground">Your look for</p>
                <h1 className="font-serif text-2xl">{look.occasionText}</h1>
            </div>

            {look.skinConcerns && (
                <div className="space-y-2">
                    <SkinReportCard
                        concerns={look.skinConcerns
                            .filter((c) => CONCERN_META[c.type])
                            .slice(0, 3)}
                    />
                    <Button variant="link" className="px-0">
                        <Link href={`/looks/${look.id}/skin`}>See full skin report →</Link>
                    </Button>
                </div>
            )}

            {look.selectedOutfitUrl && (
                <Card className="overflow-hidden py-0">
                    <CardContent className="flex items-center gap-4 p-4">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={look.selectedOutfitUrl}
                            alt={look.selectedOutfitName ?? 'Selected outfit'}
                            className="size-20 rounded-lg object-cover"
                        />
                        <div className="flex-1">
                            <p className="text-sm font-medium">{look.selectedOutfitName}</p>
                            <Button variant="link" className="h-auto px-0 text-xs">
                                <Link href={`/looks/${look.id}/outfit`}>
                                    See other options →
                                </Link>
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {look.narrative ? (
                <Card className="border-accent/50 bg-accent/5 py-0">
                    <CardContent className="space-y-1 p-4">
                        <p className="text-xs font-medium tracking-wide uppercase">
                            Your styling summary
                        </p>
                        <p className="text-sm leading-relaxed">{look.narrative}</p>
                    </CardContent>
                </Card>
            ) : outfitStatus === 'success' ? (
                <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleGenerateNarrative}
                    disabled={generatingNarrative}
                >
                    {generatingNarrative
                        ? 'Writing your summary…'
                        : 'Get your styling summary'}
                </Button>
            ) : (
                <div className="space-y-2 rounded-lg border border-dashed p-4 text-center">
                    <p className="text-sm text-muted-foreground">
                        Your styling summary unlocks once your outfit options are ready.
                    </p>
                    <Button variant="link" className="px-0">
                        <Link href="/dashboard">Start a new look to generate outfits →</Link>
                    </Button>
                </div>
            )}

            <Button className="w-full" size="lg">
                <Link href="/dashboard">Start a new look</Link>
            </Button>
        </div>
    );
}