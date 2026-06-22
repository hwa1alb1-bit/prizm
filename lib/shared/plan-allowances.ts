// Client + server safe. The full PlanAllowance record lives in
// lib/server/billing/plan.ts and re-exports these numbers.
import type { BillingPlan } from './billing'

export const PLAN_MONTHLY_CREDITS: Record<BillingPlan, number> = {
  free: 5,
  starter: 200,
  pro: 1000,
}
