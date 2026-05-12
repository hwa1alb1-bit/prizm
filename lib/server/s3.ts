// AWS S3 client wrapper. Region pinned to env. In production on Vercel,
// credentials come from OIDC role assumption when AWS_ROLE_ARN is configured.
// In local dev, AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are read from env.

import 'server-only'

import { HeadBucketCommand } from '@aws-sdk/client-s3'
import {
  createDocumentStorageClient,
  resolveDocumentStorageConfig,
  resolveDocumentStorageProvider,
  type DocumentStorageProvider,
} from './document-storage'

export function getS3Client() {
  return createDocumentStorageClient()
}

export function getUploadBucket(provider?: DocumentStorageProvider): string {
  return resolveDocumentStorageConfig(undefined, provider ?? resolveDocumentStorageProvider())
    .bucket
}

export function getKmsKeyId(provider?: DocumentStorageProvider): string | undefined {
  const config = resolveDocumentStorageConfig(
    undefined,
    provider ?? resolveDocumentStorageProvider(),
  )
  return config.provider === 's3' ? config.kmsKeyId : undefined
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
