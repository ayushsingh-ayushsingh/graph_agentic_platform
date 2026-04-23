import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export async function proxy(request: NextRequest) {
    const sessionCookie = getSessionCookie(request);
    const { pathname, search } = request.nextUrl;

    const PROTECTED_ROUTES = ["/dashboard", "/create"];
    const isProtected = PROTECTED_ROUTES.some(route => pathname.startsWith(route));

    if (isProtected && !sessionCookie) {
        const from = encodeURIComponent(pathname + search);
        return NextResponse.redirect(new URL(`/auth?from=${from}`, request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/dashboard/:path*", "/create/:path*"],
};
