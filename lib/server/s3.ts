// AWS S3 client wrapper. Region pinned to env. In production on Vercel,
// credentials come from OIDC role assumption via the default credential chain.
// In local dev, AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are read from env.

import 'server-only'

import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3'
import { serverEnv } from '../shared/env'

let cached: S3Client | null = null

export function getS3Client(): S3Client {
  if (cached) return cached
  cached = new S3Client({
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
