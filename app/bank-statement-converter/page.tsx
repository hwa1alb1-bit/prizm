import { ConversionPage } from '@/components/marketing/conversion-page'
import { conversionPages } from '@/lib/seo/conversion-pages'
import { buildPageMetadata } from '@/lib/seo/site'

const page = conversionPages.converter

export const metadata = buildPageMetadata({
  title: page.title,
  description: page.description,
  path: page.path,
})

export default function BankStatementConverterPage() {
  return <ConversionPage page={page} />
}
