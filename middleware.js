/**
 * Serves the plain-text CV to terminal clients hitting the root.
 *
 * This cannot be a vercel.json rewrite: Vercel resolves the filesystem BEFORE
 * rewrites, so `/` always matches index.html and the rewrite never runs. Edge
 * middleware runs before that check, which is the only place the swap can
 * happen. (`/cv` still works as a plain rewrite, because no file sits there.)
 */
export const config = { matcher: "/" };

const TERMINAL_CLIENT = /curl|wget|httpie/i;

export default async function middleware(request) {
    const userAgent = request.headers.get("user-agent") ?? "";

    // Anything that isn't a terminal client falls through to the normal site.
    if (!TERMINAL_CLIENT.test(userAgent)) return;

    const cv = await fetch(new URL("/cv.txt", request.url));
    if (!cv.ok) return;

    return new Response(await cv.text(), {
        status: 200,
        headers: {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "public, max-age=300",
        },
    });
}
