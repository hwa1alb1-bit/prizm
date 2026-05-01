import { z } from 'zod'

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024
export const UPLOAD_URL_TTL_SECONDS = 10 * 60

const filenameSchema = z
  .string()
  .trim()
  .min(1)
  .max(180)
  .refine((value) => !/[\\/]/.test(value), 'filename must not contain path separators')

export const uploadPresignRequestSchema = z.object({
  filename: filenameSchema,
  contentType: z.literal('application/pdf'),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(MAX_UPLOAD_BYTES, `file must be ${MAX_UPLOAD_BYTES} bytes or smaller`),
})

export type UploadPresignRequest = z.infer<typeof uploadPresignRequestSchema>

export type ValidatedUpload = UploadPresignRequest & {
  safeFilename: string
}

export function validateUploadPresignRequest(input: unknown): ValidatedUpload {
  const parsed = uploadPresignRequestSchema.parse(input)
  return {
    ...parsed,
    safeFilename: sanitizeFilename(parsed.filename),
  }
}

export function sanitizeFilename(filename: string): string {
  const trimmed = filename.trim()
  const withoutControls = trimmed.replace(/[\u0000-\u001f\u007f]/g, ' ')
  const collapsed = withoutControls.replace(/\s+/g, ' ')
  return collapsed || 'statement.pdf'
}

export function buildDocumentS3Key(input: {
  workspaceId: string
  documentId: string
  filename: string
}): string {
  return [
    'workspaces',
    encodeURIComponent(input.workspaceId),
    'documents',
    encodeURIComponent(input.documentId),
    encodeURIComponent(input.filename),
  ].join('/')
}
