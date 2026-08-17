'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { RiSunLine, RiMoonLine } from '@remixicon/react';
import { Button } from '@/components/ui/button';

export function ThemeToggle() {
    const { resolvedTheme, setTheme } = useTheme();
    // Avoids a hydration mismatch: server doesn't know the user's theme yet.
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    if (!mounted) {
        return <div className="size-9" />;
    }

    const isDark = resolvedTheme === 'dark';

    return (
        <Button
            variant="ghost"
            size="icon"
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
        >
            {isDark ? (
                <RiSunLine data-icon />
            ) : (
                <RiMoonLine data-icon />
            )}
        </Button>
    );
}