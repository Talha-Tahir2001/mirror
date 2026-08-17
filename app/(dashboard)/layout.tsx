'use client';

import { usePathname } from 'next/navigation';
import { Fragment } from 'react';
import { AppSidebar } from '@/components/app-sidebar';
import { ThemeToggle } from '@/components/theme-toggle';
import {
    SidebarProvider,
    SidebarInset,
    SidebarTrigger,
} from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

// Maps path segments to readable labels. Dynamic segments (the lookId) get
// a generic "Look" label rather than showing the raw UUID.
const SEGMENT_LABELS: Record<string, string> = {
    dashboard: 'Start a look',
    looks: 'Looks',
    skin: 'Skin',
    outfit: 'Outfit',
};

function isUuidLike(segment: string) {
    return /^[0-9a-f-]{16,}$/i.test(segment);
}

function useBreadcrumbs() {
    const pathname = usePathname();
    const segments = pathname.split('/').filter(Boolean);

    return segments.map((segment, i) => {
        const href = '/' + segments.slice(0, i + 1).join('/');
        const label = isUuidLike(segment)
            ? 'Look'
            : (SEGMENT_LABELS[segment] ?? segment);
        return { href, label, isLast: i === segments.length - 1 };
    });
}

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const crumbs = useBreadcrumbs();

    return (
        <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
                <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
                    <SidebarTrigger className="-ml-1" />
                    <Separator orientation="vertical" className="mr-2 h-4" />
                    <Breadcrumb>
                        <BreadcrumbList>
                            {crumbs.map((crumb) => (
                                <Fragment key={crumb.href}>
                                    <BreadcrumbItem>
                                        {crumb.isLast ? (
                                            <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                                        ) : (
                                            <BreadcrumbLink href={crumb.href}>
                                                {crumb.label}
                                            </BreadcrumbLink>
                                        )}
                                    </BreadcrumbItem>
                                    {!crumb.isLast && <BreadcrumbSeparator />}
                                </Fragment>
                            ))}
                        </BreadcrumbList>
                    </Breadcrumb>
                    <div className="ml-auto">
                        <ThemeToggle />
                    </div>
                </header>
                <main className="flex-1 p-6">{children}</main>
            </SidebarInset>
        </SidebarProvider>
    );
}