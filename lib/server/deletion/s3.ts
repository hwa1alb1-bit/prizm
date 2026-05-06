import 'server-only'

import {
  DeleteObjectCommand,
  GetBucketLifecycleConfigurationCommand,
  HeadObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3'
import { getS3Client, getUploadBucket } from '../s3'

export type S3DeletionState = 'deleted' | 'absent'

export type S3DeletionResult =
  | { ok: true; state: S3DeletionState }
  | { ok: false; errorCode: 's3_delete_failed' | 's3_object_still_present' }

export async function deleteOrVerifyS3Object(input: {
  bucket: string
  key: string
}): Promise<S3DeletionResult> {
  const client = getS3Client()

  try {
    await client.send(new HeadObjectCommand({ Bucket: input.bucket, Key: input.key }))
  } catch (err) {
    if (isS3NotFound(err)) return { ok: true, state: 'absent' }
    return { ok: false, errorCode: 's3_delete_failed' }
  }

  try {
    await client.send(new DeleteObjectCommand({ Bucket: input.bucket, Key: input.key }))
  } catch {
    return { ok: false, errorCode: 's3_delete_failed' }
  }

  try {
    await client.send(new HeadObjectCommand({ Bucket: input.bucket, Key: input.key }))
    return { ok: false, errorCode: 's3_object_still_present' }
  } catch (err) {
    if (isS3NotFound(err)) return { ok: true, state: 'deleted' }
    return { ok: false, errorCode: 's3_delete_failed' }
  }
}

export type UploadBucketLifecycleResult =
  | { ok: true; status: 'configured'; ruleId: string | null }
  | { ok: false; status: 'missing' | 'invalid'; errorCode: string }

export async function verifyUploadBucketLifecycle(
  client: S3Client = getS3Client(),
): Promise<UploadBucketLifecycleResult> {
  try {
    const lifecycle = await client.send(
      new GetBucketLifecycleConfigurationCommand({ Bucket: getUploadBucket() }),
    )
    const rule =
      lifecycle.Rules?.find(
        (candidate) =>
          candidate.Status === 'Enabled' &&
          candidate.Expiration?.Days !== undefined &&
          candidate.Expiration.Days <= 1,
      ) ?? null

    if (!rule) {
      return { ok: false, status: 'invalid', errorCode: 's3_lifecycle_rule_invalid' }
    }

    return { ok: true, status: 'configured', ruleId: rule.ID ?? null }
  } catch (err) {
    if (isS3NotFound(err)) {
      return { ok: false, status: 'missing', errorCode: 's3_lifecycle_rule_missing' }
    }
    return { ok: false, status: 'invalid', errorCode: 's3_lifecycle_check_failed' }
  }
}

function isS3NotFound(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  const candidate = err as Error & { name?: string; $metadata?: { httpStatusCode?: number } }
  return (
    candidate.name === 'NotFound' ||
    candidate.name === 'NoSuchKey' ||
    candidate.name === 'NoSuchLifecycleConfiguration' ||
    candidate.$metadata?.httpStatusCode === 404
  )
}
