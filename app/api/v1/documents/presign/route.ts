import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { getS3Client, getUploadBucket, getKmsKeyId } from '@/lib/server/s3'
import { getServiceRoleClient } from '@/lib/server/supabase'
import type { Database } from '@/lib/shared/db-types'

const MAX_FILE_BYTES = 20 * 1024 * 1024

const requestSchema = z.object({
  filename: z
    .string()
    .min(1)
    .max(255)
    .transform((s) => s.replace(/[^a-zA-Z0-9._-]/g, '_')),
  contentType: z.literal('application/pdf'),
  sizeBytes: z.number().int().min(1).max(MAX_FILE_BYTES),
})

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Route handler context
          }
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: 'unauthorized', detail: 'Not authenticated' },
      { status: 401 },
    )
  }

  const admin = getServiceRoleClient()
  const { data: profile } = await admin
    .from('user_profile')
    .select('workspace_id')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json(
      { error: 'no_workspace', detail: 'User profile not found' },
      { status: 403 },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'invalid_json', detail: 'Invalid JSON body' },
      { status: 400 },
    )
  }

  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_error', detail: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    )
  }

  const { filename, contentType, sizeBytes } = parsed.data
  const workspaceId = profile.workspace_id
  const s3Key = `${workspaceId}/${crypto.randomUUID()}/${filename}`
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  const { data: doc, error: insertError } = await admin
    .from('document')
    .insert({
      filename,
      content_type: contentType,
      size_bytes: sizeBytes,
      workspace_id: workspaceId,
      uploaded_by: user.id,
      status: 'pending',
      s3_bucket: getUploadBucket(),
      s3_key: s3Key,
      expires_at: expiresAt,
    })
    .select('id, s3_key')
    .single()

  if (insertError || !doc) {
    return NextResponse.json(
      {
        error: 'insert_failed',
        detail: insertError?.message ?? 'Failed to create document record',
      },
      { status: 500 },
    )
  }

  const kmsKeyId = getKmsKeyId()
  const command = new PutObjectCommand({
    Bucket: getUploadBucket(),
    Key: doc.s3_key,
    ContentType: contentType,
    ContentLength: sizeBytes,
    ServerSideEncryption: 'aws:kms',
    ...(kmsKeyId ? { SSEKMSKeyId: kmsKeyId } : {}),
  })

  const uploadUrl = await getSignedUrl(getS3Client(), command, { expiresIn: 600 })

  return NextResponse.json({ uploadUrl, documentId: doc.id }, { status: 201 })
}
