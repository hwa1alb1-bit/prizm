import { describe, expect, it } from 'vitest'
import fixture from '../fixtures/parser/textract-single-statement.json'
import { parseTextractStatement } from '@/lib/server/statement-parser'

describe('parseTextractStatement', () => {
  it('converts Textract lines into one ready reconciled statement with confidence and review flags', () => {
    const result = parseTextractStatement(fixture)

    expect(result).toEqual({
      documentState: 'ready',
      statements: [
        {
          bankName: 'PRIZM Credit Union',
          accountLast4: '4242',
          periodStart: '2026-04-01',
          periodEnd: '2026-04-30',
          openingBalance: 1000,
          closingBalance: 1250.5,
          reportedTotal: 250.5,
          computedTotal: 250.5,
          reconciles: true,
          ready: true,
          confidence: {
            overall: 0.96,
            fields: 0.98,
            transactions: 0.89,
          },
          reviewFlags: ['low_confidence_transactions'],
          transactions: [
            {
              date: '2026-04-03',
              description: 'Coffee Shop',
              amount: -12.25,
              confidence: 0.97,
            },
            {
              date: '2026-04-18',
              description: 'Payroll Deposit',
              amount: 262.75,
              confidence: 0.82,
            },
          ],
        },
      ],
    })
  })
})
