// Upstash Redis-backed rate limiter using a fixed-window counter pattern.
// Token bucket would also work but adds complexity. Fixed window is enough
// for the current scale and gives clear retry-after semantics.

import 'server-only'

import { Redis } from '@upstash/redis'
import { serverEnv, assertServerEnv } from '../shared/env'

let cached: Redis | null = null

export function getRedisClient(): Redis {
  assertServerEnv(['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'])
  if (cached) return cached
  const url = serverEnv.UPSTASH_REDIS_REST_URL
  const token = serverEnv.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    throw new Error('UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN required')
  }
  cached = new Redis({ url, token })
  return cached
}

export type RateLimitResult = {
  success: boolean
  limit: number
  remaining: number
  resetSeconds: number
}

// Fixed-window counter. Atomic via INCR + EXPIRE on first hit.
export async function rateLimit(
  key: string,
  limit: number,
  windowSec: number,
): Promise<RateLimitResult> {
  const redis = getRedisClient()
  const bucketKey = `rl:${key}:${Math.floor(Date.now() / 1000 / windowSec)}`
  const count = await redis.incr(bucketKey)
  if (count === 1) {
    await redis.expire(bucketKey, windowSec)
  }
  const remaining = Math.max(0, limit - count)
  const resetSeconds = windowSec - (Math.floor(Date.now() / 1000) % windowSec)
  return {
    success: count <= limit,
    limit,
    remaining,
    resetSeconds,
  }
}

// Idempotency helper. Stores response body for idempotency-key replay.
// TTL defaults to 24 hours.
export async function withIdempotency<T>(
  key: string,
  fn: () => Promise<T>,
  ttlSec = 86_400,
): Promise<T> {
  const redis = getRedisClient()
  const cacheKey = `idem:${key}`
  const cached = await redis.get<string>(cacheKey)
  if (cached) {
    return JSON.parse(cached) as T
  }
  const result = await fn()
  await redis.set(cacheKey, JSON.stringify(result), { ex: ttlSec })
  return result
}

export async function pingRedis(): Promise<{ ok: boolean; error?: string }> {
  try {
    const redis = getRedisClient()
    const reply = await redis.ping()
    if (reply !== 'PONG') return { ok: false, error: `Unexpected reply: ${reply}` }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
