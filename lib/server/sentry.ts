// Thin Sentry wrapper. Init lives in instrumentation.ts and the
// sentry.{client,server,edge}.config.ts files at the project root, per
// @sentry/nextjs convention. This module exposes capture helpers only.

import 'server-only'

import * as Sentry from '@sentry/nextjs'
import { publicEnv } from '../shared/env'

export function captureException(err: unknown, context?: Record<string, unknown>): void {
  if (!publicEnv.NEXT_PUBLIC_SENTRY_DSN) {
    // eslint-disable-next-line no-console
    console.error('[sentry-disabled]', err, context)
    return
  }
  Sentry.captureException(err, context ? { extra: context } : undefined)
}

export function captureMessage(msg: string, context?: Record<string, unknown>): void {
  if (!publicEnv.NEXT_PUBLIC_SENTRY_DSN) {
    // eslint-disable-next-line no-console
    console.warn('[sentry-disabled]', msg, context)
    return
  }
  Sentry.captureMessage(msg, context ? { extra: context } : undefined)
}

export function pingSentry(): { ok: boolean; error?: string } {
  // No live ping. We verify DSN configured.
  if (!publicEnv.NEXT_PUBLIC_SENTRY_DSN) {
    return { ok: false, error: 'NEXT_PUBLIC_SENTRY_DSN not configured' }
  }
  return { ok: true }
}
