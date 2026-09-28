import { NextRequest, NextResponse } from "next/server";
import { resolveShortId } from "@/lib/short-link";

// 短縮URL /s/{id} → /bookshelf?d=... へ直接リダイレクトする（中継ページなし）。
// Slack などのクローラーもリダイレクト先の OGP を読む。

const ID_PATTERN = /^[A-Za-z0-9_-]{8,16}$/;

function notFound() {
  return new NextResponse("この短縮URLは見つかりませんでした。", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!ID_PATTERN.test(id)) return notFound();

  let d: string | null;
  try {
    d = await resolveShortId(id);
  } catch {
    return new NextResponse("短縮URLを一時的に利用できません。", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  if (!d) return notFound();

  const target = new URL("/bookshelf", request.nextUrl.origin);
  target.searchParams.set("d", d);
  // IDはデータのハッシュなので、同じIDの行き先は変わらない
  return NextResponse.redirect(target, {
    status: 302,
    headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
  });
}
