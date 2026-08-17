'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import { RiHome4Line, RiSparkling2Line, RiShirtLine } from '@remixicon/react';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarRail,
} from '@/components/ui/sidebar';

// Extracts the lookId from paths like /looks/[lookId] or /looks/[lookId]/skin
function useLookId(): string | null {
    const pathname = usePathname();
    const match = pathname.match(/\/looks\/([^/]+)/);
    return match ? match[1] : null;
}

export function AppSidebar() {
    const pathname = usePathname();
    const lookId = useLookId();

    return (
        <Sidebar collapsible="icon">
            <SidebarHeader>
                <Link
                    href="/dashboard"
                    className="flex items-center gap-2 px-2 py-1.5 font-semibold tracking-tight"
                >
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                        <RiSparkling2Line className="size-4" />
                    </span>
                    <span className="group-data-[collapsible=icon]:hidden">Mirror</span>
                </Link>
            </SidebarHeader>

            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>Navigation</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    render={<Link href="/dashboard" />}
                                    isActive={pathname === '/dashboard'}
                                    tooltip="Start a look"
                                >
                                    <RiHome4Line />
                                    <span className="group-data-[collapsible=icon]:hidden">
                                        Start a look
                                    </span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>

                {/* Only show look sub-pages when we're inside a /looks/[lookId] route */}
                {lookId && (
                    <SidebarGroup>
                        <SidebarGroupLabel>This look</SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                <SidebarMenuItem>
                                    <SidebarMenuButton
                                        render={<Link href={`/looks/${lookId}`} />}
                                        isActive={pathname === `/looks/${lookId}`}
                                        tooltip="Plan"
                                    >
                                        <RiHome4Line />
                                        <span className="group-data-[collapsible=icon]:hidden">
                                            Plan
                                        </span>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>

                                <SidebarMenuItem>
                                    <SidebarMenuButton
                                        render={<Link href={`/looks/${lookId}/skin`} />}
                                        isActive={pathname === `/looks/${lookId}/skin`}
                                        tooltip="Skin analysis"
                                    >
                                        <RiSparkling2Line />
                                        <span className="group-data-[collapsible=icon]:hidden">
                                            Skin analysis
                                        </span>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>

                                <SidebarMenuItem>
                                    <SidebarMenuButton
                                        render={<Link href={`/looks/${lookId}/outfit`} />}
                                        isActive={pathname === `/looks/${lookId}/outfit`}
                                        tooltip="Outfit try-on"
                                    >
                                        <RiShirtLine />
                                        <span className="group-data-[collapsible=icon]:hidden">
                                            Outfit try-on
                                        </span>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                )}
            </SidebarContent>

            <SidebarFooter>
                <div className="flex items-center gap-2 px-2 py-1.5 group-data-[collapsible=icon]:justify-center">
                    <UserButton />
                    <span className="text-sm text-muted-foreground group-data-[collapsible=icon]:hidden">
                        Account
                    </span>
                </div>
            </SidebarFooter>

            <SidebarRail />
        </Sidebar>
    );
}