import 'server-only'

export type ProblemCode =
  | 'PRZM_AUTH_MISSING'
  | 'PRZM_AUTH_INVALID'
  | 'PRZM_AUTH_FORBIDDEN'
  | 'PRZM_VALIDATION_UPLOAD'
  | 'PRZM_INTERNAL_UPLOAD_CREATE_FAILED'

export function problemResponse(input: {
  code: ProblemCode
  title: string
  status: number
  detail: string
  instance: string
}): Response {
  return Response.json(
    {
      type: `https://prizmview.app/errors/${input.code.toLowerCase()}`,
      title: input.title,
      status: input.status,
      detail: input.detail,
      instance: input.instance,
      code: input.code,
      trace_id: crypto.randomUUID(),
    },
    {
      status: input.status,
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'application/problem+json',
      },
    },
  )
}
