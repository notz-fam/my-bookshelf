import { createHash } from "node:crypto";
import { Redis } from "@upstash/redis";

// 自前の短縮URL。本棚データ（共有URLの ?d=）を短いIDで Upstash Redis に保存し、
// /s/{id} から /bookshelf?d=... へリダイレクトする。
// 外部の短縮サービスは中継ページやアフィリエイト経由を挟むことがあるため使わない。

const KEY_PREFIX = "s:";
const ID_LENGTHS = [8, 12, 16];
/** 短縮IDの形式（ID_LENGTHS のいずれかの長さの base64url） */
export const SHORT_ID_PATTERN = /^[A-Za-z0-9_-]{8,16}$/;
/** 保存を受け付ける ?d= の最大長（異常に大きなデータで Redis を埋められないように） */
export const MAX_DATA_LENGTH = 20000;

// Vercel Marketplace の Upstash 連携は KV_REST_API_*、Upstash 直接だと UPSTASH_REDIS_REST_* を設定する
function getRedis(): Redis | null {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export class ShortLinkUnavailableError extends Error {}

/**
 * データのハッシュをIDにする。同じ本棚を何度共有しても同じ短縮URLになる。
 * 万一ハッシュの先頭が別データと衝突したら、IDを長くして保存し直す。
 */
export async function createShortId(data: string): Promise<string> {
  const redis = getRedis();
  if (!redis) throw new ShortLinkUnavailableError("Redis is not configured");

  const hash = createHash("sha256").update(data).digest("base64url");
  for (const len of ID_LENGTHS) {
    const id = hash.slice(0, len);
    const key = KEY_PREFIX + id;
    const created = await redis.set(key, data, { nx: true });
    if (created) return id;
    const existing = await redis.get<string>(key);
    if (existing === data) return id;
  }
  throw new Error("Short id collision");
}

export async function resolveShortId(id: string): Promise<string | null> {
  const redis = getRedis();
  if (!redis) throw new ShortLinkUnavailableError("Redis is not configured");
  return redis.get<string>(KEY_PREFIX + id);
}
