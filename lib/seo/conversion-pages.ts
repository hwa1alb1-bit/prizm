import type { FaqItem } from './site'

export type ConversionPageKey = 'converter' | 'excel' | 'csv' | 'scanned' | 'faq'

export type EvidenceFact = {
  label: string
  value: string
}

export type ConversionSection = {
  title: string
  body: string
  facts?: EvidenceFact[]
}

export type ConversionPageData = {
  key: ConversionPageKey
  path: string
  title: string
  description: string
  eyebrow: string
  h1: string
  intro: string
  primaryCta: string
  evidence: EvidenceFact[]
  sections: ConversionSection[]
  faq: FaqItem[]
}

export const relatedConversionLinks = [
  {
    href: '/bank-statement-converter',
    label: 'bank statement converter',
  },
  {
    href: '/bank-statement-to-excel',
    label: 'bank statement to Excel',
  },
  {
    href: '/bank-statement-to-csv',
    label: 'bank statement to CSV',
  },
  {
    href: '/convert-scanned-bank-statements',
    label: 'scanned bank statements',
  },
  {
    href: '/faq/bank-statement-conversion',
    label: 'bank statement conversion FAQ',
  },
] as const

const sharedFaq: FaqItem[] = [
  {
    question: 'Can I review transactions before export?',
    answer:
      'Yes. StatementStudio opens extracted rows in review before users export spreadsheet files.',
  },
  {
    question: 'What export formats are supported?',
    answer: 'The current product supports XLSX, CSV, QuickBooks CSV, and Xero CSV exports.',
  },
]

export const conversionPages: Record<ConversionPageKey, ConversionPageData> = {
  converter: {
    key: 'converter',
    path: '/bank-statement-converter',
    title: 'Convert Bank Statements to Excel or CSV | StatementStudio',
    description:
      'Convert PDF bank statements into reviewable Excel or CSV exports with secure upload, extraction evidence, and clear retention.',
    eyebrow: 'Bank statement converter',
    h1: 'Bank Statement Converter for Excel and CSV',
    intro:
      'Use StatementStudio to move a PDF statement through a secure upload, extraction, review, and export path without burying the evidence.',
    primaryCta: 'Start conversion',
    evidence: [
      { label: 'Input', value: 'One PDF statement per conversion' },
      { label: 'Review', value: 'Rows checked before export' },
      { label: 'Exports', value: 'XLSX, CSV, QuickBooks CSV, Xero CSV' },
      { label: 'Retention', value: '24-hour document window' },
    ],
    sections: [
      {
        title: 'What the converter does',
        body: 'StatementStudio converts bank and credit-card statement PDFs into structured rows with dates, descriptions, debits, credits, balances, and statement metadata.',
      },
      {
        title: 'Three-step operating path',
        body: 'Upload the PDF, review extracted rows and balance evidence, then export the spreadsheet format your accounting workflow needs.',
        facts: [
          { label: 'Upload', value: 'Hash, duplicate check, secure upload URL' },
          { label: 'Extract', value: 'Statement rows and account metadata' },
          { label: 'Export', value: 'Spreadsheet artifact after review' },
        ],
      },
      {
        title: 'Security and privacy',
        body: 'The public product pages link to active security, privacy, status, and subprocessor surfaces instead of relying on vague badges.',
      },
    ],
    faq: sharedFaq,
  },
  excel: {
    key: 'excel',
    path: '/bank-statement-to-excel',
    title: 'Bank Statement to Excel Converter | StatementStudio',
    description:
      'Convert PDF bank statements to Excel with reviewable transaction columns, balance checks, and export-ready spreadsheet output.',
    eyebrow: 'Excel conversion',
    h1: 'Convert PDF Bank Statements to Excel',
    intro:
      'Turn a statement PDF into an Excel-ready transaction table for cleanup, reconciliation, lender review, or client bookkeeping.',
    primaryCta: 'Start conversion',
    evidence: [
      { label: 'Columns', value: 'date, description, debit, credit, balance' },
      { label: 'Metadata', value: 'Account and statement fields when available' },
      { label: 'Review', value: 'Editable rows before export' },
      { label: 'Export', value: '.xlsx spreadsheet output' },
    ],
    sections: [
      {
        title: 'Why Excel matters',
        body: 'Excel gives accountants and finance teams a familiar review surface for sorting, filtering, tagging, and reconciling transactions before client delivery.',
      },
      {
        title: 'Transaction structure',
        body: 'The review table keeps date, description, debit, credit, balance, and account metadata visible so exceptions can be corrected before export.',
      },
      {
        title: 'From PDF to workbook',
        body: 'Upload the statement, confirm the quote, let extraction create the review record, then export an XLSX file after the rows are checked.',
      },
    ],
    faq: sharedFaq,
  },
  csv: {
    key: 'csv',
    path: '/bank-statement-to-csv',
    title: 'Bank Statement to CSV Converter | StatementStudio',
    description:
      'Convert bank statements to CSV for accounting imports, custom workflows, and spreadsheet review before export.',
    eyebrow: 'CSV conversion',
    h1: 'Convert Bank Statements to CSV',
    intro:
      'Create a clean CSV export from bank statement PDFs when you need portable transaction data for accounting imports or custom workflows.',
    primaryCta: 'Start conversion',
    evidence: [
      { label: 'Format', value: 'Comma-separated transaction rows' },
      { label: 'Imports', value: 'QuickBooks CSV and Xero CSV options' },
      { label: 'Validation', value: 'Review before export' },
      { label: 'Caveat', value: 'Check imported data in the target system' },
    ],
    sections: [
      {
        title: 'Why CSV matters',
        body: 'CSV is useful when bank feeds fail, when accounting tools need imports, or when a finance team wants a simple data handoff.',
      },
      {
        title: 'Clean column structure',
        body: 'StatementStudio keeps statement data in predictable columns so downstream tools can map dates, descriptions, amounts, and balances.',
      },
      {
        title: 'Review before import',
        body: 'Users should review the imported data inside your accounting system after export, especially when payee names or categories are later transformed.',
      },
    ],
    faq: sharedFaq,
  },
  scanned: {
    key: 'scanned',
    path: '/convert-scanned-bank-statements',
    title: 'Convert scanned bank statements | StatementStudio',
    description:
      'Convert scanned bank statements into spreadsheet data with honest OCR limits, review steps, and balance-check evidence.',
    eyebrow: 'Scanned statements',
    h1: 'Convert Scanned Bank Statements Into Spreadsheet Data',
    intro:
      'Scanned statements need OCR-backed extraction and a careful review pass. StatementStudio keeps quality limits visible before export.',
    primaryCta: 'Start conversion',
    evidence: [
      { label: 'Best input', value: 'Clear pages with readable dates and amounts' },
      { label: 'Quality risks', value: 'Cropped edges, blur, handwriting, low contrast' },
      { label: 'Review', value: 'Balance and row checks before export' },
      { label: 'Output', value: 'Spreadsheet data after correction' },
    ],
    sections: [
      {
        title: 'What makes scanned statements harder',
        body: 'A scanned PDF is an image of a statement. Cropped edges, blur, handwriting, or low contrast can reduce extraction quality and require more review.',
      },
      {
        title: 'How to improve results',
        body: 'Use complete pages, avoid shadows, keep text upright, and make sure dates, descriptions, and amounts are readable before upload.',
      },
      {
        title: 'Review is still required',
        body: 'OCR can misread characters. StatementStudio keeps review and balance checks in the workflow so users can correct rows before export.',
      },
    ],
    faq: [
      {
        question: 'Can scanned bank statements be converted?',
        answer:
          'Yes, when OCR-backed extraction can read the page image. Poor scan quality can still require manual correction.',
      },
      ...sharedFaq,
    ],
  },
  faq: {
    key: 'faq',
    path: '/faq/bank-statement-conversion',
    title: 'Bank Statement Conversion FAQ | StatementStudio',
    description:
      'Answers about bank statement conversion, Excel and CSV exports, scanned PDFs, review, accuracy, and secure document handling.',
    eyebrow: 'Conversion FAQ',
    h1: 'Bank Statement Conversion FAQ',
    intro:
      'Direct answers for accountants, bookkeepers, lenders, investigators, and finance teams converting bank statement PDFs.',
    primaryCta: 'Start conversion',
    evidence: [
      { label: 'Scope', value: 'PDF statement to spreadsheet review' },
      { label: 'Exports', value: 'XLSX, CSV, QuickBooks CSV, Xero CSV' },
      { label: 'Trust', value: 'Security, privacy, status, and retention links' },
      { label: 'Review', value: 'Rows can be checked before export' },
    ],
    sections: [
      {
        title: 'Short answers',
        body: 'This FAQ covers conversion steps, supported outputs, scanned statements, accuracy expectations, document handling, and export review.',
      },
    ],
    faq: [
      {
        question: 'How do I convert a bank statement to Excel?',
        answer:
          'Upload a PDF statement, confirm the conversion, review extracted rows, then export the result as an XLSX file.',
      },
      {
        question: 'Can I convert a PDF bank statement to CSV?',
        answer:
          'Yes. StatementStudio can export reviewed transaction rows as CSV, QuickBooks CSV, or Xero CSV.',
      },
      {
        question: 'Can scanned bank statements be converted?',
        answer:
          'Scanned statements require OCR-backed extraction. Clear scans work best, and users should review rows before export.',
      },
      {
        question: 'What file types are supported?',
        answer: 'The launch workflow focuses on PDF bank and credit-card statements.',
      },
      {
        question: 'How accurate is bank statement conversion?',
        answer:
          'Accuracy depends on statement quality and layout. StatementStudio keeps review and balance checks visible before export.',
      },
      {
        question: 'How are my financial documents handled?',
        answer:
          'The product uses authenticated upload paths, request evidence, and a 24-hour document retention window.',
      },
      {
        question: 'Can I review transactions before export?',
        answer: 'Yes. Extracted rows open in review before spreadsheet export.',
      },
      {
        question: 'Does StatementStudio support accountants and bookkeepers?',
        answer: 'Yes. The workflow is built for repetitive client statement conversion and review.',
      },
      {
        question: 'Can I use exports with QuickBooks, Xero, or Google Sheets?',
        answer:
          'Exports include XLSX, CSV, QuickBooks CSV, and Xero CSV. CSV and XLSX files can also be opened in Google Sheets.',
      },
      {
        question: 'What happens if a statement cannot be read?',
        answer:
          'The upload or extraction state shows the failure, request evidence, and the next action to retry or review the source PDF.',
      },
    ],
  },
}
