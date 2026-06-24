export type WorkflowStep = {
  title: string
  body: string
}

export const STEPS: ReadonlyArray<WorkflowStep> = [
  {
    title: 'Securely upload your PDF',
    body: 'Upload bank statements, credit card statements, transaction reports, or other financial PDFs.',
  },
  {
    title: 'We extract the data',
    body: 'Our parser identifies transaction dates, descriptions, debits, credits, balances, fees, deposits, withdrawals, and other key statement details.',
  },
  {
    title: 'Review and verify',
    body: 'Check your extracted rows before export, make adjustments where needed, and stay in control of the final spreadsheet output.',
  },
  {
    title: 'Export clean files',
    body: 'Download structured CSV or Excel files ready for bookkeeping, reconciliation, reporting, tax prep, or financial analysis.',
  },
]
