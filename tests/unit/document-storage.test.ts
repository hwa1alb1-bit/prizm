import { describe, expect, it } from 'vitest'
import {
  createUploadObjectCommandInput,
  resolveDocumentStorageConfig,
} from '@/lib/server/document-storage'

describe('document storage provider config', () => {
  it('keeps AWS S3 as the default storage provider with KMS upload headers', () => {
    const config = resolveDocumentStorageConfig({
      DOCUMENT_STORAGE_PROVIDER: 's3',
      AWS_REGION: 'us-east-1',
      S3_UPLOAD_BUCKET: 'prizm-s3-uploads',
      S3_KMS_KEY_ID: 'kms-test-key',
    })

    expect(config).toEqual({
      provider: 's3',
      bucket: 'prizm-s3-uploads',
      awsRegion: 'us-east-1',
      requiresAwsKms: true,
      kmsKeyId: 'kms-test-key',
    })
    expect(
      createUploadObjectCommandInput(
        {
          bucket: config.bucket,
          key: 'user_123/doc_123/statement.pdf',
          contentType: 'application/pdf',
          sizeBytes: 4096,
        },
        config,
      ),
    ).toMatchObject({
      Bucket: 'prizm-s3-uploads',
      Key: 'user_123/doc_123/statement.pdf',
      ServerSideEncryption: 'aws:kms',
      SSEKMSKeyId: 'kms-test-key',
    })
  })

  it('uses Cloudflare R2 without AWS KMS upload headers when flagged', () => {
    const config = resolveDocumentStorageConfig({
      DOCUMENT_STORAGE_PROVIDER: 'r2',
      R2_ACCOUNT_ID: 'cf-account-123',
      R2_UPLOAD_BUCKET: 'prizm-r2-uploads',
      R2_ACCESS_KEY_ID: 'r2-access-key',
      R2_SECRET_ACCESS_KEY: 'r2-secret-key',
    })

    expect(config).toEqual({
      provider: 'r2',
      bucket: 'prizm-r2-uploads',
      endpoint: 'https://cf-account-123.r2.cloudflarestorage.com',
      requiresAwsKms: false,
      credentials: {
        accessKeyId: 'r2-access-key',
        secretAccessKey: 'r2-secret-key',
      },
    })
    expect(
      createUploadObjectCommandInput(
        {
          bucket: config.bucket,
          key: 'user_123/doc_123/statement.pdf',
          contentType: 'application/pdf',
          sizeBytes: 4096,
        },
        config,
      ),
    ).toEqual({
      Bucket: 'prizm-r2-uploads',
      Key: 'user_123/doc_123/statement.pdf',
      ContentType: 'application/pdf',
      ContentLength: 4096,
    })
  })
})
