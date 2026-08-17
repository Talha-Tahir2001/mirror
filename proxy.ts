import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Only these need auth for now. Landing page and webhook receivers (if you add
// them later) should stay public.
const isProtectedRoute = createRouteMatcher([
    '/dashboard(.*)',
    '/looks(.*)',
    '/api/looks(.*)',
    '/api/skin-analysis(.*)',
    '/api/cloth-vto(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
    if (isProtectedRoute(req)) {
        await auth.protect();
    }
});

export const config = {
    matcher: [
        '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
        '/(api|trpc)(.*)',
    ],
};