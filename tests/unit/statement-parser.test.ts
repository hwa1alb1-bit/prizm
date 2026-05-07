import { describe, expect, it } from 'vitest'
import creditCardFixture from '../fixtures/parser/textract-credit-card-statement.json'
import fixture from '../fixtures/parser/textract-single-statement.json'
import { parseTextractStatement } from '@/lib/server/statement-parser'

describe('parseTextractStatement', () => {
  it('converts Textract lines into one ready reconciled statement with confidence and review flags', () => {
    const result = parseTextractStatement(fixture)

    expect(result).toEqual({
      documentState: 'ready',
      statements: [
        {
          statementType: 'bank',
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
          metadata: {},
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

  it('detects credit-card statements with card metadata, signed transactions, and activity reconciliation', () => {
    const result = parseTextractStatement(creditCardFixture)

    expect(result.documentState).toBe('ready')
    expect(result.statements).toHaveLength(1)
    expect(result.statements[0]).toMatchObject({
      statementType: 'credit_card',
      bankName: 'PRIZM Rewards Visa',
      accountLast4: '9876',
      periodStart: '2026-04-01',
      periodEnd: '2026-04-30',
      openingBalance: 1200,
      closingBalance: 1066.2,
      reportedTotal: -133.8,
      computedTotal: -133.8,
      reconciles: true,
      ready: true,
      metadata: {
        paymentDueDate: '2026-05-25',
        minimumPaymentDue: 35,
        previousBalance: 1200,
        newBalance: 1066.2,
        creditLimit: 5000,
        availableCredit: 3933.8,
        purchaseTotal: 325.45,
        paymentTotal: 500,
        feeTotal: 29,
        interestTotal: 12.75,
        rewardsEarned: 1,
      },
      transactions: [
        {
          date: '2026-04-03',
          transaction_date: '2026-04-03',
          description: 'Grocery Market',
          merchant: 'Grocery Market',
          amount: -125.45,
          debit: 125.45,
          statement_section: 'Purchases',
        },
        {
          date: '2026-04-11',
          transaction_date: '2026-04-11',
          description: 'Online Electronics',
          merchant: 'Online Electronics',
          amount: -200,
          debit: 200,
          statement_section: 'Purchases',
        },
        {
          date: '2026-04-15',
          transaction_date: '2026-04-15',
          description: 'Thank You Payment',
          merchant: 'Thank You Payment',
          amount: 500,
          credit: 500,
          statement_section: 'Payments and Credits',
        },
        {
          date: '2026-04-20',
          transaction_date: '2026-04-20',
          description: 'Late Payment Fee',
          merchant: 'Late Payment Fee',
          amount: -29,
          debit: 29,
          statement_section: 'Fees',
        },
        {
          date: '2026-04-30',
          transaction_date: '2026-04-30',
          description: 'Interest Charge Purchases',
          merchant: 'Interest Charge Purchases',
          amount: -12.75,
          debit: 12.75,
          statement_section: 'Interest Charged',
        },
        {
          date: '2026-04-30',
          transaction_date: '2026-04-30',
          description: 'Rewards Statement Credit',
          merchant: 'Rewards Statement Credit',
          amount: 1,
          credit: 1,
          statement_section: 'Rewards Credits',
        },
      ],
    })
  })
})
