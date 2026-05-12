import 'server-only'

import type { PutObjectCommandInput } from '@aws-sdk/client-s3'
import { S3Client } from '@aws-sdk/client-s3'
import { serverEnv } from '../shared/env'
import { getAwsCredentials } from './aws'

export type DocumentStorageProvider = 's3' | 'r2'

export type DocumentStorageEnv = {
  DOCUMENT_STORAGE_PROVIDER?: string
  AWS_REGION?: string
  S3_UPLOAD_BUCKET?: string
  S3_KMS_KEY_ID?: string
  R2_ACCOUNT_ID?: string
  R2_UPLOAD_BUCKET?: string
  R2_ACCESS_KEY_ID?: string
  R2_SECRET_ACCESS_KEY?: string
}

export type S3DocumentStorageConfig = {
  provider: 's3'
  bucket: string
  awsRegion: string
  requiresAwsKms: true
  kmsKeyId?: string
}

export type R2DocumentStorageConfig = {
  provider: 'r2'
  bucket: string
  endpoint: string
  requiresAwsKms: false
  credentials: {
    accessKeyId: string
    secretAccessKey: string
  }
}

export type DocumentStorageConfig = S3DocumentStorageConfig | R2DocumentStorageConfig

let cachedClient: { key: string; client: S3Client } | null = null

export function resolveDocumentStorageConfig(
  env: DocumentStorageEnv = serverEnv,
  provider: DocumentStorageProvider = resolveDocumentStorageProvider(env),
): DocumentStorageConfig {
  if (provider === 'r2') {
    const accountId = requiredEnv(env.R2_ACCOUNT_ID, 'R2_ACCOUNT_ID')
    return {
      provider,
      bucket: requiredEnv(env.R2_UPLOAD_BUCKET, 'R2_UPLOAD_BUCKET'),
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      requiresAwsKms: false,
      credentials: {
        accessKeyId: requiredEnv(env.R2_ACCESS_KEY_ID, 'R2_ACCESS_KEY_ID'),
        secretAccessKey: requiredEnv(env.R2_SECRET_ACCESS_KEY, 'R2_SECRET_ACCESS_KEY'),
      },
    }
  }

  return {
    provider: 's3',
    bucket: env.S3_UPLOAD_BUCKET ?? 'prizm-uploads-dev',
    awsRegion: env.AWS_REGION ?? 'us-east-1',
    requiresAwsKms: true,
    ...(env.S3_KMS_KEY_ID ? { kmsKeyId: env.S3_KMS_KEY_ID } : {}),
  }
}

export function resolveDocumentStorageProvider(
  env: DocumentStorageEnv = serverEnv,
): DocumentStorageProvider {
  return env.DOCUMENT_STORAGE_PROVIDER === 'r2' ? 'r2' : 's3'
}

export function createDocumentStorageClient(
  config: DocumentStorageConfig = resolveDocumentStorageConfig(),
): S3Client {
  const key = clientCacheKey(config)
  if (cachedClient?.key === key) return cachedClient.client

  const client =
    config.provider === 'r2'
      ? new S3Client({
          region: 'auto',
          endpoint: config.endpoint,
          forcePathStyle: true,
          credentials: config.credentials,
        })
      : new S3Client({
          region: config.awsRegion,
          credentials: getAwsCredentials(),
        })

  cachedClient = { key, client }
  return client
}

export function createUploadObjectCommandInput(
  input: {
    bucket: string
    key: string
    contentType: string
    sizeBytes: number
  },
  config: DocumentStorageConfig = resolveDocumentStorageConfig(),
): PutObjectCommandInput {
  return {
    Bucket: input.bucket,
    Key: input.key,
    ContentType: input.contentType,
    ContentLength: input.sizeBytes,
    ...(config.requiresAwsKms
      ? {
          ServerSideEncryption: 'aws:kms' as const,
          ...(config.kmsKeyId ? { SSEKMSKeyId: config.kmsKeyId } : {}),
        }
      : {}),
  }
}

export function storageConfigForProvider(
  provider?: DocumentStorageProvider,
): DocumentStorageConfig {
  return resolveDocumentStorageConfig(serverEnv, provider ?? resolveDocumentStorageProvider())
}

function requiredEnv(value: string | undefined, name: string): string {
  if (!value) throw new Error(`Missing required server env var: ${name}`)
  return value
}

function clientCacheKey(config: DocumentStorageConfig): string {
  return config.provider === 'r2'
    ? `${config.provider}:${config.endpoint}:${config.bucket}`
    : `${config.provider}:${config.awsRegion}:${config.bucket}`
}
