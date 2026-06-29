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
          billablePageCount: 1,
          reconciliationReport: null,
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

  it('counts billable pages as the unique source pages with at least one transaction', () => {
    const result = parseTextractStatement({
      JobStatus: 'SUCCEEDED',
      Blocks: [
        { BlockType: 'LINE', Text: 'Bank: PRIZM Credit Union', Confidence: 99, Page: 1 },
        { BlockType: 'LINE', Text: 'Account ending: 4242', Confidence: 99, Page: 1 },
        {
          BlockType: 'LINE',
          Text: 'Statement period: 2026-04-01 - 2026-04-30',
          Confidence: 99,
          Page: 1,
        },
        { BlockType: 'LINE', Text: 'Opening balance: $1,000.00', Confidence: 99, Page: 1 },
        { BlockType: 'LINE', Text: 'Closing balance: $1,250.50', Confidence: 99, Page: 1 },
        { BlockType: 'LINE', Text: 'Reported transaction total: $250.50', Confidence: 99, Page: 1 },
        { BlockType: 'LINE', Text: 'Page 2 — Account Information', Confidence: 99, Page: 2 },
        {
          BlockType: 'LINE',
          Text: 'Routing 011000390 | Account #####4242',
          Confidence: 99,
          Page: 2,
        },
        { BlockType: 'LINE', Text: '2026-04-03 | Coffee Shop | -$12.25', Confidence: 96, Page: 3 },
        {
          BlockType: 'LINE',
          Text: '2026-04-18 | Payroll Deposit | $262.75',
          Confidence: 96,
          Page: 3,
        },
        { BlockType: 'LINE', Text: 'Page 4 — Fee Disclosures', Confidence: 99, Page: 4 },
        {
          BlockType: 'LINE',
          Text: 'Overdraft fee of up to $35 may apply per item.',
          Confidence: 99,
          Page: 4,
        },
        { BlockType: 'LINE', Text: 'Page 5 — Marketing Insert', Confidence: 99, Page: 5 },
      ],
    })

    expect(result.statements[0].billablePageCount).toBe(1)
    expect(result.statements[0].transactions).toHaveLength(2)
  })

  it('identifies major issuers from header context when no Bank:/Issuer: label exists', () => {
    const chaseLike = {
      JobStatus: 'SUCCEEDED',
      Blocks: [
        { BlockType: 'LINE', Text: 'Chase', Confidence: 99, Page: 1 },
        {
          BlockType: 'LINE',
          Text: 'JPMorgan Chase Bank, N.A.  Member FDIC',
          Confidence: 99,
          Page: 1,
        },
        { BlockType: 'LINE', Text: 'Account Summary', Confidence: 99, Page: 1 },
        { BlockType: 'LINE', Text: 'Account number ending in 4242', Confidence: 99, Page: 1 },
        {
          BlockType: 'LINE',
          Text: 'Statement period 04/01/26 - 04/30/26',
          Confidence: 99,
          Page: 1,
        },
        { BlockType: 'LINE', Text: 'Previous Balance $1,200.00', Confidence: 99, Page: 1 },
        { BlockType: 'LINE', Text: 'Payments and Other Credits -$500.00', Confidence: 99, Page: 1 },
        { BlockType: 'LINE', Text: 'Purchases and Other Debits $366.20', Confidence: 99, Page: 1 },
        { BlockType: 'LINE', Text: 'New Balance $1,066.20', Confidence: 99, Page: 1 },
        {
          BlockType: 'LINE',
          Text: '2026-04-15 | Grocery Market | Purchases | -$125.45',
          Confidence: 99,
          Page: 2,
        },
      ],
    }

    const result = parseTextractStatement(chaseLike)
    const statement = result.statements[0]
    expect(statement.bankName).toBe('Chase')
    expect(statement.statementType).toBe('credit_card')
    expect(statement.accountLast4).toBe('4242')
    expect(statement.periodStart).toBe('2026-04-01')
    expect(statement.periodEnd).toBe('2026-04-30')
    expect(statement.openingBalance).toBe(1200)
    expect(statement.closingBalance).toBe(1066.2)
  })

  it('does not infer an issuer from a transaction-row mention alone', () => {
    const result = parseTextractStatement({
      JobStatus: 'SUCCEEDED',
      Blocks: [
        { BlockType: 'LINE', Text: 'Local Credit Union', Confidence: 99, Page: 1 },
        { BlockType: 'LINE', Text: 'Account ending: 4242', Confidence: 99, Page: 1 },
        {
          BlockType: 'LINE',
          Text: 'Statement period: 2026-04-01 - 2026-04-30',
          Confidence: 99,
          Page: 1,
        },
        { BlockType: 'LINE', Text: 'Opening balance: $100.00', Confidence: 99, Page: 1 },
        { BlockType: 'LINE', Text: 'Closing balance: $50.00', Confidence: 99, Page: 1 },
        { BlockType: 'LINE', Text: 'Reported transaction total: -$50.00', Confidence: 99, Page: 1 },
        {
          BlockType: 'LINE',
          Text: '2026-04-03 | Chase Bank ATM withdrawal | -$50.00',
          Confidence: 96,
          Page: 2,
        },
      ],
    })

    expect(result.statements[0].bankName).toBeNull()
  })

  it('produces deterministic output across repeated parses of the same input', () => {
    const input = {
      JobStatus: 'SUCCEEDED',
      Blocks: [
        { BlockType: 'LINE', Text: 'Bank of America', Confidence: 99, Page: 1 },
        { BlockType: 'LINE', Text: 'Account number ending in 9876', Confidence: 99, Page: 1 },
        {
          BlockType: 'LINE',
          Text: 'Statement period 04/01/26 - 04/30/26',
          Confidence: 99,
          Page: 1,
        },
        { BlockType: 'LINE', Text: 'Previous Balance $500.00', Confidence: 99, Page: 1 },
        { BlockType: 'LINE', Text: 'New Balance $475.00', Confidence: 99, Page: 1 },
        {
          BlockType: 'LINE',
          Text: '2026-04-05 | Coffee | Purchases | -$25.00',
          Confidence: 99,
          Page: 2,
        },
      ],
    }

    expect(parseTextractStatement(input)).toEqual(parseTextractStatement(input))
  })

  it('reports billablePageCount of 0 when no transactions extract', () => {
    const result = parseTextractStatement({
      JobStatus: 'SUCCEEDED',
      Blocks: [
        { BlockType: 'LINE', Text: 'Bank: PRIZM Credit Union', Confidence: 99, Page: 1 },
        { BlockType: 'LINE', Text: 'Marketing copy only', Confidence: 99, Page: 2 },
      ],
    })

    expect(result.statements[0].billablePageCount).toBe(0)
  })
})
