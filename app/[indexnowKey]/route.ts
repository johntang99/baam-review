import { NextResponse } from "next/server";

/**
 * Serves the IndexNow ownership key file.
 *
 * IndexNow's protocol requires `https://<host>/<key>.txt` to return
 * the key as plain text. Without this, Bing rejects our push pings as
 * unauthenticated.
 *
 * This route intercepts ANY top-level path like `/abc123.txt` and
 * checks if the requested path (minus the `.txt`) matches our
 * configured key. Hitting it with the wrong key returns 404 — so
 * crawlers can't enumerate our key by guessing.
 *
 * Why a dynamic segment ([indexnowKey]) and not a static file: the
 * key is set per-environment via INDEXNOW_KEY. Hardcoding a path
 * would leak the key into the repo. With the dynamic segment, the
 * key never appears in version control — only in .env.local and
 * production env vars.
 *
 * Caveat: this route's catch-all nature means any `/<x>` request
 * with no other matching route falls through here. We return 404 for
 * non-matching requests so the rest of the routing still works.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ indexnowKey: string }> },
) {
  const { indexnowKey: requested } = await params;
  const configured = process.env.INDEXNOW_KEY;

  // Strip the `.txt` suffix the IndexNow spec puts on the key file.
  const requestedKey = requested.endsWith(".txt")
    ? requested.slice(0, -4)
    : requested;

  if (!configured) {
    return new NextResponse("Not configured", { status: 404 });
  }
  if (requestedKey !== configured) {
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(configured, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
