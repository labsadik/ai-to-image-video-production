import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/server/supabase';
import { getSupabaseAdmin } from '@/server/supabase-admin';
import { consumeRateLimit } from '@/server/rate-limit';
import { logServerError } from '@/server/production-log';
import type { BillingPeriod, PlanId } from '@/config/plan-display';

export const runtime = 'nodejs';
const PLAN_IDS: PlanId[] = ['free', 'pro', 'business'];
const BILLING_PERIODS: BillingPeriod[] = [1, 6, 12];
function isPlanId(value: unknown): value is PlanId { return typeof value === 'string' && PLAN_IDS.includes(value as PlanId); }
function isBillingPeriod(value: unknown): value is BillingPeriod { return typeof value === 'number' && BILLING_PERIODS.includes(value as BillingPeriod); }
function appUrl(request: Request) { const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, ''); if (configured) return configured; const origin = new URL(request.url).origin; if (process.env.NODE_ENV === 'production' && origin.includes('localhost')) throw new Error('NEXT_PUBLIC_APP_URL must be configured in production'); return origin; }
async function createStripeCheckout(params: Record<string, string>, idempotencyKey: string) { const secret = process.env.STRIPE_SECRET_KEY; if (!secret) throw new Error('Stripe checkout is not configured'); const response = await fetch('https://api.stripe.com/v1/checkout/sessions', { method: 'POST', headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Idempotency-Key': idempotencyKey }, body: new URLSearchParams(params), cache: 'no-store' }); const data = await response.json() as { url?: string; error?: { message?: string } }; if (!response.ok || !data.url) throw new Error(data.error?.message || 'Stripe checkout session could not be created'); return data.url; }

export async function POST(request: Request) {
  let userId = '';
  try {
    const client = await getSupabaseServerClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    userId = user.id;
    const rate = await consumeRateLimit(`user:${user.id}:billing-checkout`, 10, 60);
    if (!rate.allowed) return NextResponse.json({ error: 'Too many checkout attempts', retryAfterSeconds: rate.retryAfterSeconds }, { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } });
    const body = await request.json() as { kind?: 'plan' | 'credit_pack'; planId?: unknown; period?: unknown; productId?: unknown; requestId?: unknown };
    const kind = body.kind ?? 'credit_pack';
    const admin = getSupabaseAdmin();
    const { data: profile, error: profileError } = await admin.from('profiles').select('plan_id,billing_country_code,country_code,email').eq('id', user.id).single();
    if (profileError || !profile) return NextResponse.json({ error: 'Account configuration unavailable' }, { status: 409 });
    const base = appUrl(request); const email = profile.email || user.email; const requestId = typeof body.requestId === 'string' && body.requestId.length >= 8 ? body.requestId : crypto.randomUUID(); const country = String(profile.billing_country_code || profile.country_code || 'IN').toUpperCase();

    if (kind === 'credit_pack') {
      const productId = typeof body.productId === 'string' ? body.productId.trim() : '';
      if (!productId) return NextResponse.json({ error: 'Select a credit pack first' }, { status: 400 });
      const { data: product, error: productError } = await admin.from('credit_products').select('id,display_name,credits,active').eq('id', productId).single();
      if (productError || !product || !product.active) return NextResponse.json({ error: 'Credit pack is unavailable' }, { status: 503 });
      const { data: price, error: priceError } = await admin.from('credit_product_prices').select('country_code,currency,unit_amount_minor,active').eq('product_id', product.id).eq('country_code', country).eq('active', true).maybeSingle();
      if (priceError || !price || Number(price.unit_amount_minor) <= 0) return NextResponse.json({ error: 'Credit pricing is not configured for your billing country' }, { status: 503 });
      const params: Record<string, string> = { mode: 'payment', 'line_items[0][price_data][currency]': String(price.currency).toLowerCase(), 'line_items[0][price_data][product_data][name]': product.display_name, 'line_items[0][price_data][product_data][description]': `${product.credits} Solamentis credits. Purchased credits expire 1 year after purchase.`, 'line_items[0][price_data][unit_amount]': String(price.unit_amount_minor), 'line_items[0][quantity]': '1', success_url: `${base}/dashboard/billing?checkout=success&kind=credit_pack`, cancel_url: `${base}/dashboard/billing?checkout=cancelled`, client_reference_id: user.id, customer_creation: 'always', billing_address_collection: 'auto', 'metadata[user_id]': user.id, 'metadata[purchase_kind]': 'credit_pack', 'metadata[product_id]': product.id, 'metadata[country_code]': country, 'metadata[currency]': String(price.currency).toUpperCase(), 'metadata[amount_minor]': String(price.unit_amount_minor), 'metadata[credits]': String(product.credits) };
      if (email) params.customer_email = email;
      const url = await createStripeCheckout(params, `solamentis:credit-pack:${user.id}:${product.id}:${country}:${requestId}`);
      return NextResponse.json({ url });
    }

    if (kind !== 'plan' || !isPlanId(body.planId)) return NextResponse.json({ error: 'Invalid checkout request' }, { status: 400 });
    if (body.planId === 'free') return NextResponse.json({ error: 'The Free plan does not require checkout' }, { status: 400 });
    if (!isBillingPeriod(body.period)) return NextResponse.json({ error: 'Invalid billing period' }, { status: 400 });
    const { data: price, error: priceError } = await admin.from('plan_prices').select('plan_id,country_code,currency,unit_amount_minor,interval,stripe_price_id,active').eq('plan_id', body.planId).eq('country_code', country).eq('interval', 'month').eq('active', true).maybeSingle();
    if (priceError || !price || Number(price.unit_amount_minor) <= 0) return NextResponse.json({ error: 'Regional plan pricing is not configured' }, { status: 503 });
    const params: Record<string, string> = { mode: 'subscription', 'line_items[0][quantity]': '1', success_url: `${base}/dashboard/billing?checkout=success&kind=plan`, cancel_url: `${base}/dashboard/billing?checkout=cancelled`, client_reference_id: user.id, customer_creation: 'always', billing_address_collection: 'required', 'metadata[user_id]': user.id, 'metadata[purchase_kind]': 'plan', 'metadata[plan_id]': body.planId, 'metadata[country_code]': country, 'metadata[billing_period]': String(body.period), 'subscription_data[metadata][user_id]': user.id, 'subscription_data[metadata][plan_id]': body.planId, 'subscription_data[metadata][country_code]': country, 'subscription_data[metadata][billing_period]': String(body.period) };
    if (email) params.customer_email = email;
    if (body.period === 1 && price.stripe_price_id) params['line_items[0][price]'] = price.stripe_price_id;
    else { params['line_items[0][price_data][currency]'] = String(price.currency).toLowerCase(); params['line_items[0][price_data][product_data][name]'] = body.planId === 'pro' ? 'Solamentis Starter' : 'Solamentis Growth'; params['line_items[0][price_data][product_data][description]'] = `${body.planId === 'pro' ? 50 : 100} monthly Solamentis credits and plan workspace limits.`; params['line_items[0][price_data][unit_amount]'] = String(Number(price.unit_amount_minor) * body.period); params['line_items[0][price_data][recurring][interval]'] = 'month'; params['line_items[0][price_data][recurring][interval_count]'] = String(body.period); }
    const url = await createStripeCheckout(params, `solamentis:plan:${user.id}:${body.planId}:${body.period}:${requestId}`);
    return NextResponse.json({ url });
  } catch (error) { logServerError('billing.checkout_failed', error, { userId }); const message = error instanceof Error ? error.message : 'Checkout could not be started'; return NextResponse.json({ error: message }, { status: 400 }); }
}
