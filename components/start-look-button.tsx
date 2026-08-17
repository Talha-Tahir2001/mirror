'use client';

import Link from 'next/link';
import { Show, SignUpButton } from '@clerk/nextjs';
import { Button, type buttonVariants } from '@/components/ui/button';
import type { VariantProps } from 'class-variance-authority';

interface StartLookButtonProps extends VariantProps<typeof buttonVariants> {
    children: React.ReactNode;
    className?: string;
}

export function StartLookButton({
    children,
    ...buttonProps
}: StartLookButtonProps) {
    return (
        <>
            <Show when="signed-out">
                <SignUpButton mode="modal" forceRedirectUrl="/dashboard">
                    <Button {...buttonProps}>{children}</Button>
                </SignUpButton>
            </Show>
            <Show when="signed-in">
                <Button {...buttonProps}>
                    <Link href="/dashboard">{children}</Link>
                </Button>
            </Show>
        </>
    );
}