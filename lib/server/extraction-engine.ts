import 'server-only'

import { GetDocumentAnalysisCommand, StartDocumentAnalysisCommand } from '@aws-sdk/client-textract'
import {
  parseTextractStatement,
  type ParsedStatement,
  type TextractOutput,
} from './statement-parser'
import { getTextractClient } from './textract'

export const DEFAULT_EXTRACTION_ENGINE = 'textract'

export type ExtractionStartInput = {
  documentId: string
  s3Bucket: string
  s3Key: string
}

export type ExtractionStartResult = {
  engine: string
  jobId: string
}

export type ExtractionPollInput = {
  jobId: string
}

export type ExtractionPollResult =
  | {
      status: 'in_progress'
      engine: string
      jobId: string
    }
  | {
      status: 'failed'
      engine: string
      jobId: string
      failureReason: string
    }
  | {
      status: 'succeeded'
      engine: string
      jobId: string
      statements: ParsedStatement[]
    }

export type ExtractionEngine = {
  name: string
  start: (input: ExtractionStartInput) => Promise<ExtractionStartResult>
  poll: (input: ExtractionPollInput) => Promise<ExtractionPollResult>
}

export function createDefaultExtractionEngine(): ExtractionEngine {
  return createTextractExtractionEngine()
}

export function createTextractExtractionEngine(): ExtractionEngine {
  return {
    name: DEFAULT_EXTRACTION_ENGINE,
    start: startTextractExtraction,
    poll: pollTextractExtraction,
  }
}

async function startTextractExtraction(
  input: ExtractionStartInput,
): Promise<ExtractionStartResult> {
  const result = await getTextractClient().send(
    new StartDocumentAnalysisCommand({
      ClientRequestToken: textractClientToken(input.documentId),
      DocumentLocation: {
        S3Object: {
          Bucket: input.s3Bucket,
          Name: input.s3Key,
        },
      },
      FeatureTypes: ['TABLES', 'FORMS'],
    }),
  )

  if (!result.JobId) throw new Error('textract_job_id_missing')
  return {
    engine: DEFAULT_EXTRACTION_ENGINE,
    jobId: result.JobId,
  }
}

async function pollTextractExtraction(input: ExtractionPollInput): Promise<ExtractionPollResult> {
  const output = await getTextractAnalysis(input)

  if (output.JobStatus === 'IN_PROGRESS') {
    return {
      status: 'in_progress',
      engine: DEFAULT_EXTRACTION_ENGINE,
      jobId: input.jobId,
    }
  }

  if (output.JobStatus !== 'SUCCEEDED') {
    return {
      status: 'failed',
      engine: DEFAULT_EXTRACTION_ENGINE,
      jobId: input.jobId,
      failureReason: `Textract analysis finished with status ${output.JobStatus ?? 'UNKNOWN'}.`,
    }
  }

  const parsed = parseTextractStatement(output)
  return {
    status: 'succeeded',
    engine: DEFAULT_EXTRACTION_ENGINE,
    jobId: input.jobId,
    statements: parsed.statements,
  }
}

async function getTextractAnalysis(input: { jobId: string }): Promise<TextractOutput> {
  const blocks: NonNullable<TextractOutput['Blocks']> = []
  let nextToken: string | undefined
  let jobStatus: TextractOutput['JobStatus']

  do {
    const result = await getTextractClient().send(
      new GetDocumentAnalysisCommand({
        JobId: input.jobId,
        NextToken: nextToken,
      }),
    )
    jobStatus = result.JobStatus
    blocks.push(...(result.Blocks ?? []))
    nextToken = result.NextToken
  } while (nextToken)

  return {
    JobStatus: jobStatus,
    Blocks: blocks.map((block) => ({
      BlockType: block.BlockType,
      Text: block.Text,
      Confidence: block.Confidence,
    })),
  }
}

function textractClientToken(documentId: string): string {
  return documentId.replace(/[^A-Za-z0-9-_]/g, '_').slice(0, 64)
}
