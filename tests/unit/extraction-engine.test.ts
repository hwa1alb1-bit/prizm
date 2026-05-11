import { describe, expect, it, vi } from 'vitest'
import creditCardFixture from '../fixtures/parser/textract-credit-card-statement.json'
import bankFixture from '../fixtures/parser/textract-single-statement.json'
import { createTextractExtractionEngine } from '@/lib/server/extraction-engine'
import { getTextractClient } from '@/lib/server/textract'

vi.mock('@/lib/server/textract', () => ({
  getTextractClient: vi.fn(),
}))

const getTextractClientMock = vi.mocked(getTextractClient)

describe('Textract extraction engine', () => {
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

function textractClientReturning(output: unknown) {
  return {
    send: vi.fn().mockResolvedValue(output),
  } as unknown as ReturnType<typeof getTextractClient>
}
