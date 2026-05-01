import { NextRequest } from 'next/server'
import { ZodError } from 'zod'
import { getServerClient, getServiceRoleClient } from '@/lib/server/supabase'
import { createPresignedUpload, getUploadBucket } from '@/lib/server/s3'
import { recordAuditEvent } from '@/lib/server/audit'
import { problemResponse } from '@/lib/server/problem'
import {
  buildDocumentS3Key,
  UPLOAD_URL_TTL_SECONDS,
  validateUploadPresignRequest,
} from '@/lib/shared/upload'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type UserContext = {
  userId: string
  workspaceId: string
  role: string
}

export async function POST(req: NextRequest): Promise<Response> {
  const instance = req.nextUrl.pathname
  const accessToken = getBearerToken(req)
  if (!accessToken) {
    return problemResponse({
      code: 'PRZM_AUTH_MISSING',
      title: 'Authentication required',
      status: 401,
      detail: 'Send a Supabase access token in the Authorization header.',
      instance,
    })
  }

  let upload
  try {
    upload = validateUploadPresignRequest(await req.json())
  } catch (err) {
    return problemResponse({
      code: 'PRZM_VALIDATION_UPLOAD',
      title: 'Invalid upload request',
      status: 400,
      detail:
        err instanceof ZodError
          ? err.issues[0]?.message || 'Invalid request body.'
          : 'Invalid request body.',
      instance,
    })
  }

  const userContext = await getUserContext(accessToken)
  if (!userContext) {
    return problemResponse({
      code: 'PRZM_AUTH_INVALID',
      title: 'Invalid authentication',
      status: 401,
      detail: 'The supplied access token is invalid or the user profile is missing.',
      instance,
    })
  }
  if (!['owner', 'admin', 'member'].includes(userContext.role)) {
    return problemResponse({
      code: 'PRZM_AUTH_FORBIDDEN',
      title: 'Upload not allowed',
      status: 403,
      detail: 'Your workspace role does not allow document uploads.',
      instance,
    })
  }

  const documentId = crypto.randomUUID()
  const s3Key = buildDocumentS3Key({
    workspaceId: userContext.workspaceId,
    documentId,
    filename: upload.safeFilename,
  })
  const bucket = getUploadBucket()

  try {
    const presigned = await createPresignedUpload({
      key: s3Key,
      contentType: upload.contentType,
      sizeBytes: upload.sizeBytes,
      expiresIn: UPLOAD_URL_TTL_SECONDS,
    })

    const admin = getServiceRoleClient()
    const { error } = await admin.from('document').insert({
      id: documentId,
      workspace_id: userContext.workspaceId,
      uploaded_by: userContext.userId,
      s3_bucket: bucket,
      s3_key: s3Key,
      filename: upload.safeFilename,
      size_bytes: upload.sizeBytes,
      content_type: upload.contentType,
      status: 'pending',
    })
    if (error) throw new Error(error.message)

    const audit = await recordAuditEvent({
      eventType: 'document.upload_presign_created',
      workspaceId: userContext.workspaceId,
      actorUserId: userContext.userId,
      targetType: 'document',
      targetId: documentId,
      actorIp: req.headers.get('x-forwarded-for'),
      actorUserAgent: req.headers.get('user-agent'),
      metadata: {
        filename: upload.safeFilename,
        sizeBytes: upload.sizeBytes,
        contentType: upload.contentType,
        s3Bucket: bucket,
      },
    })
    if (!audit.ok) throw new Error(audit.error ?? 'audit write failed')

    return Response.json(
      {
        documentId,
        status: 'pending',
        upload: presigned,
      },
      { status: 201, headers: { 'Cache-Control': 'no-store' } },
    )
  } catch {
    return problemResponse({
      code: 'PRZM_INTERNAL_UPLOAD_CREATE_FAILED',
      title: 'Upload could not be created',
      status: 500,
      detail: 'PRIZM could not prepare the upload. Try again or contact support.',
      instance,
    })
  }
}

function getBearerToken(req: NextRequest): string | null {
  const header = req.headers.get('authorization')
  const match = header?.match(/^Bearer\s+(.+)$/i)
  return match?.[1] ?? null
}

async function getUserContext(accessToken: string): Promise<UserContext | null> {
  const client = getServerClient(accessToken)
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser(accessToken)
  if (userError || !user) return null

  const { data, error } = await client
    .from('user_profile')
    .select('id, workspace_id, role')
    .eq('id', user.id)
    .single()
  if (error || !data) return null

  return {
    userId: data.id,
    workspaceId: data.workspace_id,
    role: data.role,
  }
}
