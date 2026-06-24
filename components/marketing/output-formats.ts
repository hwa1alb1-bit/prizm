export type OutputFormat = {
  label: string
  icon: string
  alt: string
}

export const OUTPUTS: ReadonlyArray<OutputFormat> = [
  { label: 'CSV', icon: '/marketing/logos/excel.png', alt: 'Microsoft Excel CSV' },
  { label: 'Excel (XLSX)', icon: '/marketing/logos/excel.png', alt: 'Microsoft Excel XLSX' },
  { label: 'QuickBooks CSV', icon: '/marketing/logos/quickbooks.png', alt: 'QuickBooks' },
  { label: 'Xero CSV', icon: '/marketing/logos/xero.png', alt: 'Xero' },
]
