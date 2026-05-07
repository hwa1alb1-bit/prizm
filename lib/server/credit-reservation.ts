import 'server-only'

import { getServiceRoleClient } from './supabase'

export type CreditReservationChargeStatus = 'reserved' | 'consumed' | 'released'

export type CreditReservationRpcRow = {
  charge_status: CreditReservationChargeStatus
}

export type CreditReservationRpcClient = {
  rpc: (
    fn:
      | 'reserve_document_conversion_credit'
      | 'consume_document_conversion_credit'
      | 'release_document_conversion_credit',
    args: Record<string, unknown>,
  ) => Promise<{
    data: CreditReservationRpcRow[] | null
    error: { message: string } | null
  }>
}

export type ReserveDocumentConversionCreditInput = {
  documentId: string
  actorUserId: string
  costCredits: number
  actorIp: string | null
  actorUserAgent: string | null
  requestId: string
  traceId: string
}

export type ConsumeDocumentConversionCreditInput = {
  documentId: string
  consumedAt: string
}

export type ReleaseDocumentConversionCreditInput = {
  documentId: string
  releasedAt: string
}

export type ReserveDocumentConversionCreditResult =
  | { ok: true; chargeStatus: 'reserved' }
  | { ok: false; reason: 'insufficient_balance' | 'reservation_failed' }

export type CreditReservationTransitionResult =
  | { ok: true; chargeStatus: CreditReservationChargeStatus }
  | { ok: false; reason: 'reservation_failed' }

export async function reserveDocumentConversionCredit(
  input: ReserveDocumentConversionCreditInput,
  client: CreditReservationRpcClient = creditReservationClient(),
): Promise<ReserveDocumentConversionCreditResult> {
  const { data, error } = await client.rpc('reserve_document_conversion_credit', {
    p_document_id: input.documentId,
    p_actor_user_id: input.actorUserId,
    p_cost_credits: input.costCredits,
    p_request_id: input.requestId,
    p_trace_id: input.traceId,
    p_actor_ip: input.actorIp,
    p_actor_user_agent: input.actorUserAgent,
  })

  if (error) {
    if (error.message.includes('insufficient_balance')) {
      return { ok: false, reason: 'insufficient_balance' }
    }
    return { ok: false, reason: 'reservation_failed' }
  }

  return data?.[0]?.charge_status === 'reserved'
    ? { ok: true, chargeStatus: 'reserved' }
    : { ok: false, reason: 'reservation_failed' }
}

export async function consumeDocumentConversionCredit(
  input: ConsumeDocumentConversionCreditInput,
  client: CreditReservationRpcClient = creditReservationClient(),
): Promise<CreditReservationTransitionResult> {
  return transitionCreditReservation(
    'consume_document_conversion_credit',
    {
      p_document_id: input.documentId,
      p_consumed_at: input.consumedAt,
    },
    client,
  )
}

export async function releaseDocumentConversionCredit(
  input: ReleaseDocumentConversionCreditInput,
  client: CreditReservationRpcClient = creditReservationClient(),
): Promise<CreditReservationTransitionResult> {
  return transitionCreditReservation(
    'release_document_conversion_credit',
    {
      p_document_id: input.documentId,
      p_released_at: input.releasedAt,
    },
    client,
  )
}

async function transitionCreditReservation(
  fn: 'consume_document_conversion_credit' | 'release_document_conversion_credit',
  args: Record<string, unknown>,
  client: CreditReservationRpcClient,
): Promise<CreditReservationTransitionResult> {
  const { data, error } = await client.rpc(fn, args)
  if (error) return { ok: false, reason: 'reservation_failed' }

  const chargeStatus = data?.[0]?.charge_status
  return chargeStatus ? { ok: true, chargeStatus } : { ok: false, reason: 'reservation_failed' }
}

function creditReservationClient(): CreditReservationRpcClient {
  return getServiceRoleClient() as unknown as CreditReservationRpcClient
}
