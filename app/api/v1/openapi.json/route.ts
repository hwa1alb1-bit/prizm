const problemResponse = {
  description: 'RFC 7807 problem document',
  content: {
    'application/problem+json': {
      schema: { $ref: '#/components/schemas/ProblemDocument' },
    },
  },
}

const jsonOk = {
  description: 'Successful JSON response',
  content: {
    'application/json': {
      schema: { type: 'object', additionalProperties: true },
    },
  },
}

const documentId = {
  name: 'documentId',
  in: 'path',
  required: true,
  schema: { type: 'string' },
}

const exportId = {
  name: 'exportId',
  in: 'path',
  required: true,
  schema: { type: 'string' },
}

const authenticated = [{ cookieAuth: [] }]

const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'PRIZM API',
    version: 'v1',
    description:
      'Public PRIZM API routes for document conversion, export, billing, and privacy workflows.',
  },
  servers: [{ url: 'https://prizmview.app' }],
  paths: {
    '/api/v1/documents/preflight': {
      post: {
        tags: ['Documents'],
        summary: 'Quote a PDF upload before presign',
        security: authenticated,
        responses: {
          '200': jsonOk,
          '400': problemResponse,
          '401': problemResponse,
          '429': problemResponse,
        },
      },
    },
    '/api/v1/documents/presign': {
      post: {
        tags: ['Documents'],
        summary: 'Create a pending document and return an S3 upload URL',
        security: authenticated,
        responses: {
          '201': jsonOk,
          '400': problemResponse,
          '401': problemResponse,
          '429': problemResponse,
        },
      },
    },
    '/api/v1/documents/{documentId}/complete': {
      post: {
        tags: ['Documents'],
        summary: 'Verify a completed browser upload',
        security: authenticated,
        parameters: [documentId],
        responses: {
          '200': jsonOk,
          '401': problemResponse,
          '404': problemResponse,
          '429': problemResponse,
        },
      },
    },
    '/api/v1/documents/{documentId}/convert': {
      post: {
        tags: ['Documents'],
        summary: 'Start document OCR and conversion',
        security: authenticated,
        parameters: [documentId],
        responses: {
          '200': jsonOk,
          '401': problemResponse,
          '409': problemResponse,
          '429': problemResponse,
        },
      },
    },
    '/api/v1/documents/{documentId}/status': {
      get: {
        tags: ['Documents'],
        summary: 'Read document processing status',
        security: authenticated,
        parameters: [documentId],
        responses: {
          '200': jsonOk,
          '401': problemResponse,
          '404': problemResponse,
          '429': problemResponse,
        },
      },
    },
    '/api/v1/documents/{documentId}/statement': {
      patch: {
        tags: ['Documents'],
        summary: 'Edit and review parsed statement data',
        security: authenticated,
        parameters: [documentId],
        responses: {
          '200': jsonOk,
          '400': problemResponse,
          '401': problemResponse,
          '409': problemResponse,
        },
      },
    },
    '/api/v1/documents/{documentId}/export': {
      get: {
        tags: ['Exports'],
        summary: 'Stream a reviewed statement export',
        security: authenticated,
        parameters: [
          documentId,
          {
            name: 'format',
            in: 'query',
            required: false,
            schema: { type: 'string', enum: ['csv', 'xlsx', 'quickbooks_csv', 'xero_csv'] },
          },
        ],
        responses: {
          '200': { description: 'Export file' },
          '401': problemResponse,
          '429': problemResponse,
        },
      },
    },
    '/api/v1/documents/{documentId}/exports': {
      post: {
        tags: ['Exports'],
        summary: 'Create a retained export artifact',
        security: authenticated,
        parameters: [documentId],
        responses: {
          '201': jsonOk,
          '400': problemResponse,
          '401': problemResponse,
          '429': problemResponse,
        },
      },
    },
    '/api/v1/documents/{documentId}/extraction-report': {
      post: {
        tags: ['Documents'],
        summary: 'Report bad or questionable extracted data',
        security: authenticated,
        parameters: [documentId],
        responses: { '201': jsonOk, '400': problemResponse, '401': problemResponse },
      },
    },
    '/api/v1/exports/{exportId}/download': {
      get: {
        tags: ['Exports'],
        summary: 'Create a short-lived export download URL',
        security: authenticated,
        parameters: [exportId],
        responses: {
          '200': jsonOk,
          '401': problemResponse,
          '404': problemResponse,
          '429': problemResponse,
        },
      },
    },
    '/api/v1/billing/checkout': {
      post: {
        tags: ['Billing'],
        summary: 'Create a Stripe Checkout session',
        security: authenticated,
        responses: {
          '201': jsonOk,
          '400': problemResponse,
          '401': problemResponse,
          '429': problemResponse,
        },
      },
    },
    '/api/v1/billing/portal': {
      post: {
        tags: ['Billing'],
        summary: 'Create a Stripe Customer Portal session',
        security: authenticated,
        responses: {
          '201': jsonOk,
          '401': problemResponse,
          '409': problemResponse,
          '429': problemResponse,
        },
      },
    },
    '/api/v1/account/data-export': {
      post: {
        tags: ['Privacy'],
        summary: 'Request a privacy data export workflow',
        security: authenticated,
        responses: { '202': jsonOk, '401': problemResponse, '429': problemResponse },
      },
    },
    '/api/v1/account/delete': {
      post: {
        tags: ['Privacy'],
        summary: 'Request account deletion',
        security: authenticated,
        responses: { '202': jsonOk, '401': problemResponse, '429': problemResponse },
      },
    },
  },
  components: {
    securitySchemes: {
      cookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'sb-access-token',
      },
    },
    schemas: {
      ProblemDocument: {
        type: 'object',
        required: [
          'type',
          'title',
          'status',
          'detail',
          'instance',
          'code',
          'request_id',
          'trace_id',
        ],
        properties: {
          type: { type: 'string', format: 'uri' },
          title: { type: 'string' },
          status: { type: 'integer' },
          detail: { type: 'string' },
          instance: { type: 'string' },
          code: { type: 'string' },
          request_id: { type: 'string' },
          trace_id: { type: 'string' },
        },
      },
    },
  },
} as const

export async function GET(): Promise<Response> {
  return Response.json(openApiDocument, {
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}
