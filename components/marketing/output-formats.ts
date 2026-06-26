import { EXPORT_FORMAT_ORDER, FORMAT_META, type FormatMeta } from '@/components/shared/format-meta'

export type OutputFormat = FormatMeta

export const OUTPUTS: ReadonlyArray<OutputFormat> = EXPORT_FORMAT_ORDER.map(
  (format) => FORMAT_META[format],
)
