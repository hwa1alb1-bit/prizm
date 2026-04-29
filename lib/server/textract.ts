// AWS Textract client wrapper. Same region and credential model as S3.
// Used to start asynchronous AnalyzeDocument jobs against S3-staged uploads.

import 'server-only'

import { TextractClient } from '@aws-sdk/client-textract'
import { serverEnv } from '../shared/env'

let cached: TextractClient | null = null

export function getTextractClient(): TextractClient {
  if (cached) return cached
  cached = new TextractClient({
    region: serverEnv.AWS_REGION,
    credentials:
      serverEnv.AWS_ACCESS_KEY_ID && serverEnv.AWS_SECRET_ACCESS_KEY
        ? {
            accessKeyId: serverEnv.AWS_ACCESS_KEY_ID,
            secretAccessKey: serverEnv.AWS_SECRET_ACCESS_KEY,
          }
        : undefined,
  })
  return cached
}

export async function pingTextract(): Promise<{ ok: boolean; error?: string }> {
  // Textract has no cheap describe call. We verify client construction only.
  try {
    getTextractClient()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
