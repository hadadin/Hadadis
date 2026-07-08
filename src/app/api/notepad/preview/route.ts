import { NextRequest, NextResponse } from "next/server";

/**
 * OpenGraph/oEmbed preview fetcher (PRD FR-6.2).
 * Instagram and a few other platforms block scraping (see PRD 17.1 risk) —
 * in that case we fall back to a platform-colored card (icon + domain),
 * never a user-facing error.
 */
export async function POST(req: NextRequest) {
  const { url } = (await req.json()) as { url: string };

  let hostname = "";
  try {
    hostname = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  const platform = detectPlatform(hostname);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        // Some sites (incl. Instagram) serve a scrape-blocked page to
        // non-browser UAs; a browser UA sometimes gets further, but we
        // still always fall back gracefully below.
        "User-Agent":
          "Mozilla/5.0 (compatible; HouseHadadiBot/1.0; +https://example.com)",
      },
    });
    clearTimeout(timeout);
    const html = await res.text();

    const title = matchMeta(html, "og:title") ?? matchTitleTag(html);
    const image = matchMeta(html, "og:image");

    if (title || image) {
      return NextResponse.json({
        title: title ?? hostname,
        thumbnail_url: image ?? null,
        platform,
      });
    }
  } catch {
    // fall through to fallback card
  }

  return NextResponse.json({
    title: hostname,
    thumbnail_url: null,
    platform,
    fallback: true,
  });
}

function matchMeta(html: string, property: string): string | null {
  const re = new RegExp(
    `<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`,
    "i"
  );
  const reversed = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`,
    "i"
  );
  return html.match(re)?.[1] ?? html.match(reversed)?.[1] ?? null;
}

function matchTitleTag(html: string): string | null {
  return html.match(/<title>([^<]+)<\/title>/i)?.[1] ?? null;
}

function detectPlatform(hostname: string): string {
  if (hostname.includes("instagram")) return "instagram";
  if (hostname.includes("youtube") || hostname.includes("youtu.be")) return "youtube";
  if (hostname.includes("tiktok")) return "tiktok";
  return "generic";
}
