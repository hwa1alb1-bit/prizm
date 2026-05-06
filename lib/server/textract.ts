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
  // Textract has no cheap describe call. We verify client construction only.
  try {
    getTextractClient()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function getTextractDocumentStatus(
  jobId: string,
): Promise<{ ok: true; status: string } | { ok: false; errorCode: string }> {
  try {
    const result = await getTextractClient().send(
      new GetDocumentAnalysisCommand({
        JobId: jobId,
        MaxResults: 1,
      }),
    )

    return { ok: true, status: result.JobStatus ?? 'UNKNOWN' }
  } catch {
    return { ok: false, errorCode: 'textract_status_unavailable' }
  }
}
