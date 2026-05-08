import { describe, expect, it } from 'vitest'
import { GET } from '@/app/api/v1/openapi.json/route'

describe('OpenAPI contract route', () => {
  it('publishes the implemented public v1 API surface and excludes internal webhooks', async () => {
    const response = await GET()
    const spec = await response.json()

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(spec.openapi).toBe('3.1.0')
    expect(spec.info.title).toBe('PRIZM API')

    for (const path of [
      '/api/v1/documents/preflight',
      '/api/v1/documents/presign',
      '/api/v1/documents/{documentId}/complete',
      '/api/v1/documents/{documentId}/convert',
      '/api/v1/documents/{documentId}/status',
      '/api/v1/documents/{documentId}/statement',
      '/api/v1/documents/{documentId}/export',
      '/api/v1/documents/{documentId}/exports',
      '/api/v1/documents/{documentId}/extraction-report',
      '/api/v1/exports/{exportId}/download',
      '/api/v1/billing/checkout',
      '/api/v1/billing/portal',
      '/api/v1/account/data-export',
      '/api/v1/account/delete',
    ]) {
      expect(spec.paths[path], `${path} should be documented`).toBeDefined()
    }

    expect(spec.paths['/api/v1/webhooks/stripe']).toBeUndefined()
    expect(spec.components.schemas.ProblemDocument.required).toEqual(
      expect.arrayContaining([
        'type',
        'title',
        'status',
        'detail',
        'code',
        'request_id',
        'trace_id',
      ]),
    )
  })
})
