'use client';

import { RiCheckLine, RiLoader4Line, RiCloseLine } from '@remixicon/react';
import { cn } from '@/lib/utils';

export type AgentStepStatus = 'pending' | 'active' | 'done' | 'error';

export interface AgentStep {
    id: string;
    label: string;
    status: AgentStepStatus;
}

interface AgentStatusProps {
    steps: AgentStep[];
}

function StepIcon({ status }: { status: AgentStepStatus }) {
    if (status === 'done') {
        return (
            <span className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <RiCheckLine className="size-3.5" />
            </span>
        );
    }
    if (status === 'active') {
        return (
            <span className="flex size-6 items-center justify-center rounded-full border-2 border-primary">
                <RiLoader4Line className="size-3.5 animate-spin text-primary" />
            </span>
        );
    }
    if (status === 'error') {
        return (
            <span className="flex size-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground">
                <RiCloseLine className="size-3.5" />
            </span>
        );
    }
    return <span className="size-6 rounded-full border-2 border-border" />;
}

export function AgentStatus({ steps }: AgentStatusProps) {
    return (
        <div className="mx-auto flex w-full max-w-md flex-col gap-4">
            {steps.map((step, i) => (
                <div key={step.id} className="flex items-center gap-3">
                    <StepIcon status={step.status} />
                    <span
                        className={cn(
                            'text-sm',
                            step.status === 'pending' && 'text-muted-foreground',
                            step.status === 'error' && 'text-destructive',
                        )}
                    >
                        {step.label}
                    </span>
                    {i < steps.length - 1 && (
                        <span
                            className={cn(
                                'mx-1 h-px flex-1',
                                step.status === 'done' ? 'bg-primary' : 'bg-border',
                            )}
                        />
                    )}
                </div>
            ))}
        </div>
    );
}