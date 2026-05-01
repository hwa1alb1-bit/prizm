// AWS S3 client wrapper. Region pinned to env. In production on Vercel,
// credentials come from OIDC role assumption via the default credential chain.
// In local dev, AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are read from env.

import 'server-only'

import { S3Client, HeadBucketCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
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

export type PresignedUpload = {
  url: string
  method: 'PUT'
  headers: Record<string, string>
  expiresIn: number
}

export async function createPresignedUpload(input: {
  key: string
  contentType: string
  sizeBytes: number
  expiresIn: number
}): Promise<PresignedUpload> {
  const bucket = getUploadBucket()
  const kmsKeyId = getKmsKeyId()
  const headers: Record<string, string> = {
    'content-type': input.contentType,
  }
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: input.key,
    ContentType: input.contentType,
    ContentLength: input.sizeBytes,
    ServerSideEncryption: kmsKeyId ? 'aws:kms' : undefined,
    SSEKMSKeyId: kmsKeyId,
  })

  const url = await getSignedUrl(getS3Client(), command, { expiresIn: input.expiresIn })
  return {
    url,
    method: 'PUT',
    headers,
    expiresIn: input.expiresIn,
  }
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
