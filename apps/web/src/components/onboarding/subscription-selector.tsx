'use client';

import { useActionState, useState } from 'react';
import {
  findPlan,
  priceForPlan,
  type BillingCycle,
  type PlanCatalogResponse,
  type SubscriptionPlan,
  type SubscriptionSummary,
} from '@zion8/contracts';
import { selectSubscriptionAction } from '@/app/onboarding/actions';
import { initialOnboardingState } from '@/app/onboarding/state';
import { FormFeedback, hintClass, inputClass, labelClass } from './ui';
import { SubmitButton } from './submit-button';

function formatPrice(cents: number, currency: string, cycle: BillingCycle): string {
  if (cents === 0) return 'Free';
  const amount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
  return `${amount} / ${cycle === 'ANNUAL' ? 'year' : 'month'}`;
}

export function SubscriptionSelector({
  catalog,
  subscription,
  disabled,
}: {
  catalog: PlanCatalogResponse;
  subscription: SubscriptionSummary | null;
  disabled: boolean;
}) {
  const [state, formAction] = useActionState(selectSubscriptionAction, initialOnboardingState);
  const [plan, setPlan] = useState<SubscriptionPlan>(subscription?.plan ?? 'FREE');
  const [cycle, setCycle] = useState<BillingCycle>(subscription?.billingCycle ?? 'MONTHLY');

  const selected = findPlan(plan);
  const price = priceForPlan(plan, cycle);

  return (
    <form action={formAction} className="space-y-6">
      <FormFeedback state={state} />

      <fieldset disabled={disabled}>
        <legend className={labelClass}>Billing cycle</legend>
        <div className="mt-2 inline-flex rounded-lg border border-white/15 bg-white/5 p-1">
          {(['MONTHLY', 'ANNUAL'] as BillingCycle[]).map((option) => (
            <label
              key={option}
              className={`cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition ${
                cycle === option ? 'bg-zion-600 text-white' : 'text-slate-300 hover:text-white'
              }`}
            >
              <input
                type="radio"
                name="billingCycle"
                value={option}
                checked={cycle === option}
                onChange={() => setCycle(option)}
                className="sr-only"
              />
              {option === 'ANNUAL' ? 'Annual' : 'Monthly'}
            </label>
          ))}
        </div>
        <p className={`mt-2 ${hintClass}`}>Annual billing gives you two months free.</p>
      </fieldset>

      <fieldset className="grid gap-4 md:grid-cols-2" disabled={disabled}>
        <legend className="sr-only">Plans</legend>
        {catalog.plans.map((definition) => {
          const isSelected = plan === definition.plan;
          return (
            <label
              key={definition.plan}
              className={`relative cursor-pointer rounded-2xl border p-5 transition ${
                isSelected
                  ? 'border-zion-400 bg-zion-500/10'
                  : 'border-white/10 bg-white/[0.03] hover:border-white/20'
              }`}
            >
              <input
                type="radio"
                name="plan"
                value={definition.plan}
                checked={isSelected}
                onChange={() => setPlan(definition.plan)}
                className="sr-only"
              />
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-base font-semibold">{definition.name}</span>
                {definition.recommended ? (
                  <span className="border-zion-400/50 bg-zion-500/20 text-zion-200 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                    Recommended
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-slate-400">{definition.description}</p>
              <p className="mt-3 text-lg font-semibold">
                {formatPrice(
                  cycle === 'ANNUAL' ? definition.annualPriceCents : definition.monthlyPriceCents,
                  definition.currency,
                  cycle,
                )}
              </p>
              <p className={hintClass}>
                {definition.seats === null
                  ? 'Unlimited members'
                  : `Up to ${definition.seats.toLocaleString('en-US')} members`}
                {definition.trialDays > 0 ? ` · ${definition.trialDays}-day trial` : ''}
              </p>
              <ul className="mt-3 space-y-1 text-sm text-slate-300">
                {definition.features.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <span className="text-zion-300">·</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </label>
          );
        })}
      </fieldset>

      {selected && selected.seats !== null ? (
        <fieldset disabled={disabled}>
          <div className="max-w-xs space-y-1.5">
            <label htmlFor="seats" className={labelClass}>
              Seats
            </label>
            <input
              key={selected.plan}
              id="seats"
              name="seats"
              type="number"
              min={1}
              max={selected.seats}
              defaultValue={subscription?.seats ?? selected.seats}
              className={inputClass}
            />
            <p className={hintClass}>How many people will use this workspace.</p>
          </div>
        </fieldset>
      ) : null}

      <div className="flex items-center gap-4">
        <SubmitButton pendingLabel="Saving...">
          {subscription ? 'Update plan' : `Select ${selected?.name ?? 'plan'}`}
        </SubmitButton>
        <p className={hintClass}>
          {price.priceCents === 0
            ? 'No card required.'
            : 'You will confirm payment details after onboarding.'}
        </p>
      </div>
    </form>
  );
}
