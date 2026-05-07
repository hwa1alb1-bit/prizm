// AWS Textract client wrapper. Same region and credential model as S3.
// Used to start asynchronous AnalyzeDocument jobs against S3-staged uploads.

import 'server-only'

import { GetDocumentAnalysisCommand, TextractClient } from '@aws-sdk/client-textract'
import { serverEnv } from '../shared/env'
import { getAwsCredentials } from './aws'

let cached: TextractClient | null = null

export function getTextractClient(): TextractClient {
  if (cached) return cached
  cached = new TextractClient({
    region: serverEnv.AWS_REGION,
    credentials: getAwsCredentials(),
  })
  return cached
}

export async function pingTextract(): Promise<{ ok: boolean; error?: string }> {
  // Probe the same read permission used by the processing poller. An invalid
  // job id response proves the call reached Textract with usable credentials.
  try {
    await getTextractClient().send(new GetDocumentAnalysisCommand({ JobId: 'prizm-health-probe' }))
    return { ok: true }
  } catch (err) {
    if (isExpectedTextractProbeMiss(err)) return { ok: true }
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export function isExpectedTextractProbeMiss(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const name = 'name' in err && typeof err.name === 'string' ? err.name.toLowerCase() : ''
  const message =
    'message' in err && typeof err.message === 'string' ? err.message.toLowerCase() : ''
  return (
    name === 'invalidjobidexception' ||
    message.includes('invalid job id') ||
    message.includes('invalid job identifier')
  )
}
