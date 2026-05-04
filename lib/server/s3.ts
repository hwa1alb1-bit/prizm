// AWS S3 client wrapper. Region pinned to env. In production on Vercel,
// credentials come from OIDC role assumption when AWS_ROLE_ARN is configured.
// In local dev, AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are read from env.

import 'server-only'

import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3'
import { serverEnv } from '../shared/env'
import { getAwsCredentials } from './aws'

let cached: S3Client | null = null

export function getS3Client(): S3Client {
  if (cached) return cached
  cached = new S3Client({
    region: serverEnv.AWS_REGION,
    credentials: getAwsCredentials(),
  })
  return cached
}

export function getUploadBucket(): string {
  return serverEnv.S3_UPLOAD_BUCKET
}

export function getKmsKeyId(): string | undefined {
  return serverEnv.S3_KMS_KEY_ID
}

export async function pingS3(): Promise<{ ok: boolean; error?: string }> {
  try {
    const client = getS3Client()
    const bucket = getUploadBucket()
    await client.send(new HeadBucketCommand({ Bucket: bucket }))
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
