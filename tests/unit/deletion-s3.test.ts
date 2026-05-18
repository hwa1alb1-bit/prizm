import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DeleteObjectCommand,
  GetBucketLifecycleConfigurationCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3'
import {
  createDocumentStorageClient,
  storageConfigForProvider,
} from '@/lib/server/document-storage'
import { deleteOrVerifyS3Object, verifyUploadBucketLifecycle } from '@/lib/server/deletion/s3'
import { getS3Client, getUploadBucket } from '@/lib/server/s3'

vi.mock('@/lib/server/s3', () => ({
  getS3Client: vi.fn(),
  getUploadBucket: vi.fn(() => 'prizm-uploads-test'),
}))

vi.mock('@/lib/server/document-storage', () => ({
  createDocumentStorageClient: vi.fn(),
  storageConfigForProvider: vi.fn((provider: 's3' | 'r2' = 's3') => ({
    provider,
    bucket: provider === 'r2' ? 'prizm-r2-uploads' : 'prizm-uploads-test',
  })),
}))

const getS3ClientMock = vi.mocked(getS3Client)
const getUploadBucketMock = vi.mocked(getUploadBucket)
const createDocumentStorageClientMock = vi.mocked(createDocumentStorageClient)
const storageConfigForProviderMock = vi.mocked(storageConfigForProvider)

describe('deletion S3 controls', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('deletes an existing object and verifies it is absent afterward', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(notFoundError())
    getS3ClientMock.mockReturnValue({ send } as never)

    const result = await deleteOrVerifyS3Object({
      bucket: 'prizm-uploads-test',
      key: 'user/doc/statement.pdf',
    })

    expect(result).toEqual({ ok: true, state: 'deleted' })
    expect(send.mock.calls[0]?.[0]).toBeInstanceOf(HeadObjectCommand)
    expect(send.mock.calls[1]?.[0]).toBeInstanceOf(DeleteObjectCommand)
    expect(send.mock.calls[2]?.[0]).toBeInstanceOf(HeadObjectCommand)
  })

  it('treats an already-missing object as verified absent', async () => {
    const send = vi.fn().mockRejectedValueOnce(notFoundError())
    getS3ClientMock.mockReturnValue({ send } as never)

    const result = await deleteOrVerifyS3Object({
      bucket: 'prizm-uploads-test',
      key: 'user/doc/statement.pdf',
    })

    expect(result).toEqual({ ok: true, state: 'absent' })
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('uses the provider-neutral storage client for R2 deletion candidates', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(notFoundError())
    createDocumentStorageClientMock.mockReturnValue({ send } as never)

    const result = await deleteOrVerifyS3Object({
      storageProvider: 'r2',
      bucket: 'legacy-bucket',
      key: 'legacy-key',
      storageBucket: 'prizm-r2-uploads',
      storageKey: 'user/doc/statement.pdf',
    })

    expect(result).toEqual({ ok: true, state: 'deleted' })
    expect(storageConfigForProviderMock).toHaveBeenCalledWith('r2')
    expect(createDocumentStorageClientMock).toHaveBeenCalled()
    expect(send.mock.calls[0]?.[0]).toBeInstanceOf(HeadObjectCommand)
  })

  it('verifies the upload bucket has an enabled one-day lifecycle expiration', async () => {
    const send = vi.fn().mockResolvedValue({
      Rules: [
        {
          ID: 'expire-after-1-day',
          Status: 'Enabled',
          Expiration: { Days: 1 },
        },
      ],
    })

    const result = await verifyUploadBucketLifecycle({ send } as never)

    expect(result).toEqual({
      ok: true,
      status: 'configured',
      ruleId: 'expire-after-1-day',
    })
    expect(getUploadBucketMock).toHaveBeenCalled()
    expect(send.mock.calls[0]?.[0]).toBeInstanceOf(GetBucketLifecycleConfigurationCommand)
  })
})

function notFoundError(): Error {
  return Object.assign(new Error('not found'), {
    name: 'NotFound',
    $metadata: { httpStatusCode: 404 },
  })
}
