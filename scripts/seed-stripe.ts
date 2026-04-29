// Seed Stripe products and prices for PRIZM. Idempotent: looks up by metadata
// key prizm_sku and skips creation when a matching product already exists.
//
// Run with: pnpm seed:stripe
// Requires STRIPE_SECRET_KEY in .env.local (sandbox or live, your choice).
//
// Outputs an env block to stdout that you paste into Vercel env or .env.local
// for the price IDs (STRIPE_PRICE_*).

import Stripe from 'stripe'

const key = process.env.STRIPE_SECRET_KEY
if (!key) {
  console.error('Missing STRIPE_SECRET_KEY in .env.local')
  process.exit(1)
}

const stripe = new Stripe(key, { apiVersion: '2026-04-22.dahlia', typescript: true })

type ProductSpec = {
  sku: string
  name: string
  description: string
  prices: Array<{
    id_env: string
    nickname: string
    unit_amount: number // smallest unit (cents)
    interval: 'month' | 'year' | null // null for metered/one-time
    usage_type?: 'licensed' | 'metered'
  }>
}

const PRODUCTS: ProductSpec[] = [
  {
    sku: 'prizm_free',
    name: 'PRIZM Free',
    description: 'Free tier, 5 pages per calendar month, no card required',
    prices: [],
  },
  {
    sku: 'prizm_starter',
    name: 'PRIZM Starter',
    description: '200 pages per month, $0.04 per page overage',
    prices: [
      { id_env: 'STRIPE_PRICE_STARTER_MONTHLY', nickname: 'Starter Monthly', unit_amount: 1900, interval: 'month' },
      { id_env: 'STRIPE_PRICE_STARTER_ANNUAL', nickname: 'Starter Annual', unit_amount: 19_000, interval: 'year' },
    ],
  },
  {
    sku: 'prizm_pro',
    name: 'PRIZM Pro',
    description: '1,000 pages per month, $0.04 per page overage',
    prices: [
      { id_env: 'STRIPE_PRICE_PRO_MONTHLY', nickname: 'Pro Monthly', unit_amount: 4900, interval: 'month' },
      { id_env: 'STRIPE_PRICE_PRO_ANNUAL', nickname: 'Pro Annual', unit_amount: 49_000, interval: 'year' },
    ],
  },
  {
    sku: 'prizm_overage',
    name: 'PRIZM Overage Pages',
    description: 'Per-page metered usage on top of monthly inclusion',
    prices: [
      {
        id_env: 'STRIPE_PRICE_OVERAGE_PAGE',
        nickname: 'Overage per page',
        unit_amount: 4,
        interval: 'month',
        usage_type: 'metered',
      },
    ],
  },
]

async function findOrCreateProduct(spec: ProductSpec): Promise<Stripe.Product> {
  const existing = await stripe.products.search({
    query: `metadata['prizm_sku']:'${spec.sku}'`,
    limit: 1,
  })
  if (existing.data.length > 0) {
    const product = existing.data[0]
    console.log(`  product exists: ${product.id} (${spec.name})`)
    if (!product.active) {
      await stripe.products.update(product.id, { active: true })
      console.log(`  reactivated ${product.id}`)
    }
    return product
  }
  const created = await stripe.products.create({
    name: spec.name,
    description: spec.description,
    metadata: { prizm_sku: spec.sku },
  })
  console.log(`  created product: ${created.id} (${spec.name})`)
  return created
}

async function findOrCreatePrice(
  product: Stripe.Product,
  spec: ProductSpec['prices'][number],
): Promise<Stripe.Price> {
  const lookupKey = `${product.metadata.prizm_sku}_${spec.id_env.toLowerCase()}`
  const existing = await stripe.prices.list({
    product: product.id,
    lookup_keys: [lookupKey],
    limit: 1,
  })
  if (existing.data.length > 0) {
    console.log(`    price exists: ${existing.data[0].id} (${spec.nickname})`)
    return existing.data[0]
  }
  const params: Stripe.PriceCreateParams = {
    product: product.id,
    nickname: spec.nickname,
    unit_amount: spec.unit_amount,
    currency: 'usd',
    lookup_key: lookupKey,
    metadata: { prizm_sku: product.metadata.prizm_sku },
  }
  if (spec.interval) {
    params.recurring = {
      interval: spec.interval,
      ...(spec.usage_type ? { usage_type: spec.usage_type } : {}),
    }
  }
  const created = await stripe.prices.create(params)
  console.log(`    created price:  ${created.id} (${spec.nickname})`)
  return created
}

async function main() {
  const balance = await stripe.balance.retrieve()
  const mode = balance.livemode ? 'LIVE' : 'TEST/SANDBOX'
  console.log(`Stripe mode: ${mode}`)
  if (balance.livemode) {
    console.warn('WARNING: running against LIVE mode. Press Ctrl+C within 5s to abort.')
    await new Promise((r) => setTimeout(r, 5000))
  }

  const envOut: string[] = []
  for (const spec of PRODUCTS) {
    console.log(`\n${spec.sku}:`)
    const product = await findOrCreateProduct(spec)
    for (const priceSpec of spec.prices) {
      const price = await findOrCreatePrice(product, priceSpec)
      envOut.push(`${priceSpec.id_env}=${price.id}`)
    }
  }

  console.log('\n=== paste into .env.local and Vercel env ===')
  for (const line of envOut) console.log(line)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
