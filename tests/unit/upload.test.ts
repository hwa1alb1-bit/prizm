import { describe, expect, it } from 'vitest'
import {
  buildDocumentS3Key,
  MAX_UPLOAD_BYTES,
  sanitizeFilename,
  validateUploadPresignRequest,
} from '@/lib/shared/upload'

describe('upload helpers', () => {
  it('accepts a valid PDF upload request', () => {
    const result = validateUploadPresignRequest({
      filename: ' April Statement.pdf ',
      contentType: 'application/pdf',
      sizeBytes: 1024,
    })

    expect(result).toEqual({
      filename: 'April Statement.pdf',
      safeFilename: 'April Statement.pdf',
      contentType: 'application/pdf',
      sizeBytes: 1024,
    })
  })

  it('rejects non-PDF uploads', () => {
    expect(() =>
      validateUploadPresignRequest({
        filename: 'statement.csv',
        contentType: 'text/csv',
        sizeBytes: 1024,
      }),
    ).toThrow()
  })

  it('rejects uploads over the storage limit', () => {
    expect(() =>
      validateUploadPresignRequest({
        filename: 'statement.pdf',
        contentType: 'application/pdf',
        sizeBytes: MAX_UPLOAD_BYTES + 1,
      }),
    ).toThrow()
  })

  it('rejects path-like filenames', () => {
    expect(() =>
      validateUploadPresignRequest({
        filename: '../statement.pdf',
        contentType: 'application/pdf',
        sizeBytes: 1024,
      }),
    ).toThrow()
  })

  it('normalizes filename whitespace and control characters', () => {
    expect(sanitizeFilename(' Jan\u0000\tStatement\n.pdf ')).toBe('Jan Statement .pdf')
  })

  it('builds scoped S3 keys with encoded path segments', () => {
    expect(
      buildDocumentS3Key({
        workspaceId: 'workspace/id',
        documentId: 'document id',
        filename: 'April Statement.pdf',
      }),
    ).toBe('workspaces/workspace%2Fid/documents/document%20id/April%20Statement.pdf')
  })
})
