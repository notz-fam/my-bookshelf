import { after, NextRequest, NextResponse } from "next/server";
import { decodeBookshelfData } from "@/lib/url";
import {
  createShortId,
  MAX_DATA_LENGTH,
  ShortLinkUnavailableError,
} from "@/lib/short-link";

// 本棚データ（?d= の値）を保存して、このアプリのドメインの短縮URL（/s/{id}）を返す。
// 本棚データとして読めるものだけを受け付けるので、任意URLの短縮には使えない。

export async function POST(request: NextRequest) {
  let d: unknown;
  try {
    ({ d } = (await request.json()) as { d?: unknown });
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof d !== "string" || !d || d.length > MAX_DATA_LENGTH) {
    return NextResponse.json({ error: "d parameter required" }, { status: 400 });
  }
  if (!decodeBookshelfData(d)) {
    return NextResponse.json({ error: "Invalid bookshelf data" }, { status: 400 });
  }

  try {
    const id = await createShortId(d);
    // OGP画像の生成には数秒かかるので、URLが貼られる前に生成して CDN にキャッシュさせておく
    // （クローラーは画像の取得に時間がかかると諦める）
    after(() => fetch(`${request.nextUrl.origin}/api/og?s=${id}`).catch(() => {}));
    return NextResponse.json({ shortUrl: `${request.nextUrl.origin}/s/${id}` });
  } catch (e) {
    if (e instanceof ShortLinkUnavailableError) {
      return NextResponse.json({ error: "Short links are not configured" }, { status: 503 });
    }
    return NextResponse.json({ error: "Failed to shorten URL" }, { status: 500 });
  }
}
