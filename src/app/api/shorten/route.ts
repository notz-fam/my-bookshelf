import { NextRequest, NextResponse } from "next/server";

// Shorten a share URL via a third-party service.
// Proxied through our own API to avoid browser CORS issues and to allow
// provider fallback. Restricted to our own origin so it can't be abused
// as an open URL shortener.

async function shortenTinyUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`
    );
    if (!res.ok) return null;
    const text = (await res.text()).trim();
    return text.startsWith("http") ? text : null;
  } catch {
    return null;
  }
}

async function shortenIsGd(url: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://is.gd/create.php?format=simple&url=${encodeURIComponent(url)}`
    );
    if (!res.ok) return null;
    const text = (await res.text()).trim();
    return text.startsWith("http") ? text : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "url parameter required" }, { status: 400 });
  }

  // Only shorten URLs that point back to this app
  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }
  if (target.hostname !== request.nextUrl.hostname) {
    return NextResponse.json({ error: "URL host not allowed" }, { status: 400 });
  }

  const shortUrl = (await shortenTinyUrl(url)) ?? (await shortenIsGd(url));
  if (!shortUrl) {
    return NextResponse.json({ error: "Failed to shorten URL" }, { status: 502 });
  }

  return NextResponse.json({ shortUrl });
}
