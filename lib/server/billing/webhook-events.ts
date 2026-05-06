import 'server-only'

import type Stripe from 'stripe'
import { recordAuditEventOrThrow } from '@/lib/server/audit'
import type { RouteContext } from '@/lib/server/http'
import { getServiceRoleClient } from '@/lib/server/supabase'
import { getStripeClient } from '@/lib/server/stripe'
import { serverEnv } from '@/lib/shared/env'
import { getPlanAllowance, type BillingPlan, type SubscriptionStatus } from './plan'

type StripeWebhookClaim = {
  claimed: boolean
}

export type SyncedSubscription = {
  workspaceId: string
  plan: BillingPlan
  periodStart: string | null
  periodEnd: string | null
}

export type StripeWebhookDeps = {
  claimStripeWebhookEvent: (event: Stripe.Event) => Promise<StripeWebhookClaim>
  recordStripeAuditEvent: (event: Stripe.Event, context: RouteContext) => Promise<string>
  retrieveStripeSubscription: (subscriptionId: string) => Promise<Stripe.Subscription>
  syncStripeSubscription: (subscription: Stripe.Subscription) => Promise<SyncedSubscription>
  grantSubscriptionCredits: (subscription: SyncedSubscription) => Promise<void>
  markStripeWebhookEventProcessed: (stripeEventId: string) => Promise<void>
  markStripeWebhookEventFailed: (stripeEventId: string, errorCode: string) => Promise<void>
}

export async function processStripeWebhookEvent(
  event: Stripe.Event,
  context: RouteContext,
  deps: StripeWebhookDeps = defaultStripeWebhookDeps,
): Promise<{ processed: boolean; replayed: boolean }> {
  const claim = await deps.claimStripeWebhookEvent(event)
  if (!claim.claimed) return { processed: false, replayed: true }

  try {
    await deps.recordStripeAuditEvent(event, context)

    if (isSubscriptionEvent(event)) {
      const subscriptionId = getStripeObjectId(event)
      if (subscriptionId) {
        const subscription = await deps.retrieveStripeSubscription(subscriptionId)
        const synced = await deps.syncStripeSubscription(subscription)
        await deps.grantSubscriptionCredits(synced)
      }
    }

    await deps.markStripeWebhookEventProcessed(event.id)
    return { processed: true, replayed: false }
  } catch (err) {
    await deps.markStripeWebhookEventFailed(
      event.id,
      err instanceof Error ? err.message.slice(0, 120) : 'stripe_webhook_processing_failed',
    )
    throw err
  }
}

export const defaultStripeWebhookDeps: StripeWebhookDeps = {
  claimStripeWebhookEvent,
  recordStripeAuditEvent,
  retrieveStripeSubscription,
  syncStripeSubscription,
  grantSubscriptionCredits,
  markStripeWebhookEventProcessed,
  markStripeWebhookEventFailed,
}

export async function recordStripeAuditEvent(
  event: Stripe.Event,
  context: RouteContext,
): Promise<string> {
  return recordAuditEventOrThrow({
    eventType: `stripe.${event.type}`,
    targetType: 'stripe_event',
    metadata: {
      stripe_event_id: event.id,
      livemode: event.livemode,
      type: event.type,
      request_id: context.requestId,
      trace_id: context.traceId,
    },
  })
}

export async function retrieveStripeSubscription(
  subscriptionId: string,
): Promise<Stripe.Subscription> {
  return getStripeClient().subscriptions.retrieve(subscriptionId)
}

export async function claimStripeWebhookEvent(event: Stripe.Event): Promise<StripeWebhookClaim> {
  const client = getServiceRoleClient() as unknown as StripeWebhookLedgerClient
  const { error } = await client
    .from('stripe_webhook_event')
    .insert({
      stripe_event_id: event.id,
      event_type: event.type,
      livemode: event.livemode,
      status: 'processing',
    })
    .select('id')
    .single()

  if (!error) return { claimed: true }
  if (isUniqueViolation(error)) return { claimed: false }
  throw new Error(error.message)
}

export async function markStripeWebhookEventProcessed(stripeEventId: string): Promise<void> {
  const client = getServiceRoleClient() as unknown as StripeWebhookLedgerClient
  const { error } = await client
    .from('stripe_webhook_event')
    .update({
      status: 'processed',
      processed_at: new Date().toISOString(),
      error_code: null,
    })
    .eq('stripe_event_id', stripeEventId)

  if (error) throw new Error(error.message)
}

export async function markStripeWebhookEventFailed(
  stripeEventId: string,
  errorCode: string,
): Promise<void> {
  try {
    const client = getServiceRoleClient() as unknown as StripeWebhookLedgerClient
    await client
      .from('stripe_webhook_event')
      .update({
        status: 'failed',
        processed_at: new Date().toISOString(),
        error_code: errorCode,
      })
      .eq('stripe_event_id', stripeEventId)
  } catch {
    // The route still returns a sanitized failure even if failure marking is unavailable.
  }
}

export async function syncStripeSubscription(
  subscription: Stripe.Subscription,
): Promise<SyncedSubscription> {
  const customerId =
    typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id
  const item = subscription.items.data[0]
  const price = item?.price
  const plan = planFromPrice(price?.id)
  const periodStart = timestampToIso(item?.current_period_start)
  const periodEnd = timestampToIso(item?.current_period_end)
  const workspaceId = await resolveSubscriptionWorkspaceId(subscription, customerId)

  const client = getServiceRoleClient() as unknown as SubscriptionMirrorClient
  const { data, error } = await client
    .from('subscription')
    .upsert(
      {
        workspace_id: workspaceId,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription.id,
        plan,
        billing_cycle: price?.recurring?.interval === 'year' ? 'annual' : 'monthly',
        status: normalizeSubscriptionStatus(subscription.status),
        current_period_start: periodStart,
        current_period_end: periodEnd,
        cancel_at_period_end: subscription.cancel_at_period_end,
      },
      { onConflict: 'workspace_id' },
    )
    .select('workspace_id')
    .single()

  if (error) throw new Error(error.message)

  return {
    workspaceId: data.workspace_id,
    plan,
    periodStart,
    periodEnd,
  }
}

export async function grantSubscriptionCredits(subscription: SyncedSubscription): Promise<void> {
  if (!subscription.periodStart || !subscription.periodEnd) return

  const allowance = getPlanAllowance(subscription.plan)
  if (allowance.monthlyCredits <= 0) return

  const client = getServiceRoleClient() as unknown as CreditLedgerClient
  const latest = await client
    .from('credit_ledger')
    .select('balance_after')
    .eq('workspace_id', subscription.workspaceId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (latest.error) throw new Error(latest.error.message)

  const previousBalance = latest.data?.balance_after ?? 0
  const inserted = await client.from('credit_ledger').insert({
    workspace_id: subscription.workspaceId,
    delta: allowance.monthlyCredits,
    reason: 'subscription_grant',
    balance_after: previousBalance + allowance.monthlyCredits,
    billing_period_start: subscription.periodStart,
    billing_period_end: subscription.periodEnd,
  })

  if (inserted.error && !isUniqueViolation(inserted.error)) {
    throw new Error(inserted.error.message)
  }
}

async function resolveSubscriptionWorkspaceId(
  subscription: Stripe.Subscription,
  customerId: string,
): Promise<string> {
  const metadataWorkspaceId = subscription.metadata?.workspace_id
  if (metadataWorkspaceId) return metadataWorkspaceId

  const client = getServiceRoleClient() as unknown as SubscriptionMirrorClient
  const bySubscription = await client
    .from('subscription')
    .select('workspace_id')
    .eq('stripe_subscription_id', subscription.id)
    .maybeSingle()

  if (bySubscription.error) throw new Error(bySubscription.error.message)
  if (bySubscription.data?.workspace_id) return bySubscription.data.workspace_id

  const byCustomer = await client
    .from('subscription')
    .select('workspace_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()

  if (byCustomer.error) throw new Error(byCustomer.error.message)
  if (byCustomer.data?.workspace_id) return byCustomer.data.workspace_id

  throw new Error('stripe_subscription_workspace_missing')
}

function isSubscriptionEvent(event: Stripe.Event): boolean {
  return (
    event.type === 'customer.subscription.created' ||
    event.type === 'customer.subscription.updated' ||
    event.type === 'customer.subscription.deleted'
  )
}

function getStripeObjectId(event: Stripe.Event): string | null {
  const object = event.data.object as { id?: string }
  return object.id ?? null
}

function planFromPrice(priceId: string | undefined): BillingPlan {
  if (!priceId) return 'free'
  if (
    priceId === serverEnv.STRIPE_PRICE_STARTER_MONTHLY ||
    priceId === serverEnv.STRIPE_PRICE_STARTER_ANNUAL
  ) {
    return 'starter'
  }
  if (
    priceId === serverEnv.STRIPE_PRICE_PRO_MONTHLY ||
    priceId === serverEnv.STRIPE_PRICE_PRO_ANNUAL
  ) {
    return 'pro'
  }
  return 'free'
}

function normalizeSubscriptionStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  if (
    status === 'trialing' ||
    status === 'active' ||
    status === 'past_due' ||
    status === 'canceled' ||
    status === 'incomplete'
  ) {
    return status
  }
  if (status === 'unpaid') return 'past_due'
  return 'incomplete'
}

function timestampToIso(timestamp: number | null | undefined): string | null {
  return timestamp ? new Date(timestamp * 1000).toISOString() : null
}

function isUniqueViolation(error: { code?: string; message: string }): boolean {
  return error.code === '23505' || error.message.toLowerCase().includes('duplicate')
}

type StripeWebhookLedgerClient = {
  from: (table: 'stripe_webhook_event') => {
    insert: (payload: {
      stripe_event_id: string
      event_type: string
      livemode: boolean
      status: string
    }) => {
      select: (columns: 'id') => {
        single: () => Promise<{
          data: { id: string } | null
          error: { code?: string; message: string } | null
        }>
      }
    }
    update: (payload: { status: string; processed_at: string; error_code: string | null }) => {
      eq: (
        column: 'stripe_event_id',
        value: string,
      ) => Promise<{
        error: { code?: string; message: string } | null
      }>
    }
  }
}

type SubscriptionMirrorClient = {
  from: (table: 'subscription') => {
    select: (columns: 'workspace_id') => {
      eq: (
        column: 'stripe_subscription_id' | 'stripe_customer_id',
        value: string,
      ) => {
        maybeSingle: () => Promise<{
          data: { workspace_id: string } | null
          error: { code?: string; message: string } | null
        }>
      }
    }
    upsert: (
      payload: {
        workspace_id: string
        stripe_customer_id: string
        stripe_subscription_id: string
        plan: BillingPlan
        billing_cycle: 'monthly' | 'annual'
        status: SubscriptionStatus
        current_period_start: string | null
        current_period_end: string | null
        cancel_at_period_end: boolean
      },
      options: { onConflict: 'workspace_id' },
    ) => {
      select: (columns: 'workspace_id') => {
        single: () => Promise<{
          data: { workspace_id: string }
          error: { code?: string; message: string } | null
        }>
      }
    }
  }
}

type CreditLedgerClient = {
  from: (table: 'credit_ledger') => {
    select: (columns: 'balance_after') => {
      eq: (
        column: 'workspace_id',
        value: string,
      ) => {
        order: (
          column: 'created_at',
          options: { ascending: false },
        ) => {
          limit: (count: 1) => {
            maybeSingle: () => Promise<{
              data: { balance_after: number } | null
              error: { code?: string; message: string } | null
            }>
          }
        }
      }
    }
    insert: (payload: {
      workspace_id: string
      delta: number
      reason: 'subscription_grant'
      balance_after: number
      billing_period_start: string
      billing_period_end: string
    }) => Promise<{
      error: { code?: string; message: string } | null
    }>
  }
}
