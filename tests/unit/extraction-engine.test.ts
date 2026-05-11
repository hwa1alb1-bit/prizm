import { describe, expect, it, vi } from 'vitest'
import kotlinBankFixture from '../fixtures/kotlin-worker/bank-statement-response.json'
import kotlinCreditCardFixture from '../fixtures/kotlin-worker/credit-card-statement-response.json'
import creditCardFixture from '../fixtures/parser/textract-credit-card-statement.json'
import bankFixture from '../fixtures/parser/textract-single-statement.json'
import {
  createDefaultExtractionEngine,
  createExtractionEngineByName,
  createKotlinWorkerExtractionEngine,
  createTextractExtractionEngine,
} from '@/lib/server/extraction-engine'
import { getTextractClient } from '@/lib/server/textract'

vi.mock('@/lib/server/textract', () => ({
  getTextractClient: vi.fn(),
}))

const getTextractClientMock = vi.mocked(getTextractClient)

describe('Textract extraction engine', () => {
  it('stays the default extraction engine when no worker flag is set', () => {
    expect(createDefaultExtractionEngine({ env: { NODE_ENV: 'test' } }).name).toBe('textract')
  })

  it('keeps Textract as the production default even when a worker flag is present', () => {
    const worker = workerReturning(kotlinBankFixture)

    expect(
      createDefaultExtractionEngine({
        env: { NODE_ENV: 'production', PRIZM_EXTRACTION_ENGINE: 'kotlin_worker' },
        kotlinWorker: worker,
      }).name,
    ).toBe('textract')
  })

  it('allows a Vercel preview deployment to opt into the worker even though NODE_ENV is production', () => {
    const worker = workerReturning(kotlinBankFixture)

    expect(
      createDefaultExtractionEngine({
        env: {
          NODE_ENV: 'production',
          VERCEL_ENV: 'preview',
          PRIZM_EXTRACTION_ENGINE: 'kotlin_worker',
        },
        kotlinWorker: worker,
      }).name,
    ).toBe('kotlin_worker')
  })

  it('returns normalized bank statement data from Textract output', async () => {
    getTextractClientMock.mockReturnValueOnce(textractClientReturning(bankFixture))

    const result = await createTextractExtractionEngine().poll({ jobId: 'textract_bank_123' })

    expect(result).toMatchObject({
      status: 'succeeded',
      engine: 'textract',
      jobId: 'textract_bank_123',
      statements: [
        {
          statementType: 'bank',
          bankName: 'PRIZM Credit Union',
          accountLast4: '4242',
          reconciles: true,
        },
      ],
    })
  })

  it('returns normalized credit-card statement data from Textract output', async () => {
    getTextractClientMock.mockReturnValueOnce(textractClientReturning(creditCardFixture))

    const result = await createTextractExtractionEngine().poll({ jobId: 'textract_card_123' })

    expect(result).toMatchObject({
      status: 'succeeded',
      engine: 'textract',
      jobId: 'textract_card_123',
      statements: [
        {
          statementType: 'credit_card',
          bankName: 'PRIZM Rewards Visa',
          accountLast4: '9876',
          reconciles: true,
        },
      ],
    })
  })
})

describe('Kotlin worker extraction engine', () => {
  it('can be selected only by an explicit non-production worker flag', () => {
    const worker = workerReturning(kotlinBankFixture)

    expect(
      createDefaultExtractionEngine({
        env: { NODE_ENV: 'test', PRIZM_EXTRACTION_ENGINE: 'kotlin_worker' },
        kotlinWorker: worker,
      }).name,
    ).toBe('kotlin_worker')
  })

  it('can be created by persisted engine name for polling worker jobs', () => {
    const worker = workerReturning(kotlinBankFixture)

    expect(createExtractionEngineByName('kotlin_worker', { kotlinWorker: worker })?.name).toBe(
      'kotlin_worker',
    )
    expect(createExtractionEngineByName('unsupported_worker')).toBeNull()
  })

  it('returns normalized bank statement data from worker output', async () => {
    const worker = workerReturning(kotlinBankFixture)

    const result = await createKotlinWorkerExtractionEngine({ worker }).poll({
      jobId: 'worker_bank_123',
    })

    expect(worker.poll).toHaveBeenCalledWith({ jobId: 'worker_bank_123' })
    expect(result).toMatchObject({
      status: 'succeeded',
      engine: 'kotlin_worker',
      jobId: 'worker_bank_123',
      statements: [
        {
          statementType: 'bank',
          bankName: 'PRIZM Credit Union',
          accountLast4: '4242',
          reconciles: true,
          ready: true,
        },
      ],
    })
  })

  it('returns normalized credit-card statement data from worker output', async () => {
    const worker = workerReturning(kotlinCreditCardFixture)

    const result = await createKotlinWorkerExtractionEngine({ worker }).poll({
      jobId: 'worker_card_123',
    })

    expect(worker.poll).toHaveBeenCalledWith({ jobId: 'worker_card_123' })
    expect(result).toMatchObject({
      status: 'succeeded',
      engine: 'kotlin_worker',
      jobId: 'worker_card_123',
      statements: [
        {
          statementType: 'credit_card',
          bankName: 'PRIZM Rewards Visa',
          accountLast4: '9876',
          reconciles: true,
          ready: true,
          metadata: {
            paymentDueDate: '2026-05-25',
          },
        },
      ],
    })
  })
})

function textractClientReturning(output: unknown) {
  return {
    send: vi.fn().mockResolvedValue(output),
  } as unknown as ReturnType<typeof getTextractClient>
}

function workerReturning(output: unknown) {
  return {
    start: vi.fn(),
    poll: vi.fn().mockResolvedValue(output),
  }
}
