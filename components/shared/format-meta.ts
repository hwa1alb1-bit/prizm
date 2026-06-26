export type ExportFormat = 'csv' | 'xlsx' | 'quickbooks_csv' | 'xero_csv'

export type FormatMeta = {
  label: string
  icon: string
  alt: string
}

export const FORMAT_META: Record<ExportFormat, FormatMeta> = {
  csv: { label: 'CSV', icon: '/marketing/logos/excel.png', alt: 'Microsoft Excel CSV' },
  xlsx: { label: 'Excel (XLSX)', icon: '/marketing/logos/excel.png', alt: 'Microsoft Excel XLSX' },
  quickbooks_csv: {
    label: 'QuickBooks CSV',
    icon: '/marketing/logos/quickbooks.png',
    alt: 'QuickBooks',
  },
  xero_csv: { label: 'Xero CSV', icon: '/marketing/logos/xero.png', alt: 'Xero' },
}

export const EXPORT_FORMAT_ORDER: ReadonlyArray<ExportFormat> = [
  'csv',
  'xlsx',
  'quickbooks_csv',
  'xero_csv',
]
