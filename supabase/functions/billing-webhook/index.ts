import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL")!;
const key = Deno.env.get("SUPABASE_SECRET_KEY");
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

async function digestHex(value: string) { const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)); return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join(""); }
async function verify(raw: string, signature: string, secret: string) { const parts = signature.split(","); const timestamp = parts.find((item) => item.startsWith("t="))?.slice(2); const signatures = parts.filter((item) => item.startsWith("v1=")).map((item) => item.slice(3)); if (!timestamp || signatures.length === 0) return false; const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp)); if (!Number.isFinite(age) || age > 300) return false; const cryptoKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]); const mac = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(`${timestamp}.${raw}`)); const expected = new Uint8Array(mac); return signatures.some((candidate) => { if (candidate.length !== expected.length * 2) return false; let diff = 0; for (let index = 0; index < expected.length; index++) diff |= parseInt(candidate.slice(index * 2, index * 2 + 2), 16) ^ expected[index]; return diff === 0; }); }
function epochToIso(value: unknown) { return typeof value === "number" && Number.isFinite(value) ? new Date(value * 1000).toISOString() : null; }
async function saveBillingTransaction(admin: ReturnType<typeof createClient>, values: Record<string, unknown>) { const externalEventId = typeof values.external_event_id === "string" ? values.external_event_id : null; const checkoutSessionId = typeof values.stripe_checkout_session_id === "string" ? values.stripe_checkout_session_id : null; if (!values.user_id || (!externalEventId && !checkoutSessionId)) return; const { error } = await admin.from("billing_transactions").upsert(values, { onConflict: externalEventId ? "provider,external_event_id" : "stripe_checkout_session_id" }); if (error) throw new Error(`Billing history save failed: ${error.message}`); }

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  if (!key || !webhookSecret) return Response.json({ error: "Billing webhook is not configured" }, { status: 503 });
  const raw = await req.text(); const signature = req.headers.get("stripe-signature");
  if (!signature || !(await verify(raw, signature, webhookSecret))) return Response.json({ error: "Invalid signature" }, { status: 400 });
  let event: Record<string, any>; try { event = JSON.parse(raw) as Record<string, any>; } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  const eventId = String(event.id ?? ""); const eventType = String(event.type ?? ""); if (!eventId || !eventType) return Response.json({ error: "Invalid Stripe event" }, { status: 400 });
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: existing } = await admin.from("billing_events").select("id,status").eq("provider", "stripe").eq("event_id", eventId).maybeSingle(); if (existing?.status === "processed") return Response.json({ ok: true, duplicate: true });
  const object = event.data?.object ?? {}; const payloadHash = await digestHex(raw);
  if (!existing) { const { error } = await admin.from("billing_events").insert({ provider: "stripe", event_id: eventId, event_type: eventType, payload_hash: payloadHash, payload: object, status: "processing", processed_at: null }); if (error && error.code !== "23505") return Response.json({ error: error.message }, { status: 500 }); }
  else await admin.from("billing_events").update({ payload_hash: payloadHash, payload: object, status: "processing", error_message: null }).eq("provider", "stripe").eq("event_id", eventId);
  try {
    let userId = object.metadata?.user_id ?? null; let planId = object.metadata?.plan_id ?? null;
    if (eventType === "checkout.session.completed" || eventType === "checkout.session.async_payment_succeeded") {
      if (object.mode === "payment" && object.payment_status === "paid" && object.metadata?.purchase_kind === "credit_pack") {
        const productId = String(object.metadata?.product_id ?? ""); const countryCode = String(object.metadata?.country_code ?? "").toUpperCase(); const currency = String(object.metadata?.currency ?? object.currency ?? "").toUpperCase(); const amountMinor = Number(object.amount_total ?? object.metadata?.amount_minor ?? 0); const purchaseAt = epochToIso(object.created) ?? epochToIso(event.created);
        if (userId && productId && countryCode && currency && Number.isSafeInteger(amountMinor) && amountMinor > 0) {
          const { error } = await admin.rpc("grant_credit_product_purchase", { p_user_id: userId, p_product_id: productId, p_country_code: countryCode, p_currency: currency, p_amount_minor: amountMinor, p_idempotency_key: `stripe:credit-pack:${String(object.id)}`, p_external_reference: String(object.id), p_metadata: { provider: "stripe", checkout_session_id: String(object.id), event_id: eventId, purchase_at: purchaseAt } });
          if (error) throw new Error(`Credit pack grant failed: ${error.message}`);
          await saveBillingTransaction(admin, { user_id: userId, provider: "stripe", kind: "credit_pack", status: "paid", product_id: productId, description: `${object.metadata?.credits ?? "Credit"} credits`, amount_minor: amountMinor, currency, country_code: countryCode, stripe_checkout_session_id: String(object.id), stripe_payment_intent_id: object.payment_intent ?? null, stripe_customer_id: object.customer ?? null, external_event_id: eventId, purchased_at: purchaseAt ?? new Date().toISOString(), metadata: { credits: Number(object.metadata?.credits ?? 0), provider_event: eventType } });
        }
      }
      if (object.mode === "subscription" && userId && planId) {
        const billingPeriod = String(object.metadata?.billing_period ?? object.subscription_data?.metadata?.billing_period ?? "1");
        const { error: subError } = await admin.from("subscriptions").upsert({ user_id: userId, plan_id: planId, status: "active", provider: "stripe", external_customer_id: object.customer ?? null, external_subscription_id: object.subscription ?? null, external_checkout_session_id: String(object.id), metadata: { country_code: object.metadata?.country_code ?? null, billing_period: billingPeriod } }, { onConflict: "user_id" });
        if (subError) throw new Error(`Subscription record failed: ${subError.message}`);
      }
    }
    if (eventType === "customer.subscription.created" || eventType === "customer.subscription.updated") {
      userId = object.metadata?.user_id ?? userId; planId = object.metadata?.plan_id ?? planId;
      if (userId && planId) {
        const status = ["canceled", "unpaid", "past_due", "incomplete_expired"].includes(String(object.status)) ? String(object.status) : "active";
        const periodStart = epochToIso(object.current_period_start); const periodEnd = epochToIso(object.current_period_end);
        const { error: subError } = await admin.from("subscriptions").upsert({ user_id: userId, plan_id: planId, status, provider: "stripe", external_customer_id: object.customer ?? null, external_subscription_id: object.id, current_period_start: periodStart, current_period_end: periodEnd, cancel_at_period_end: Boolean(object.cancel_at_period_end), country_code: String(object.metadata?.country_code ?? "").toUpperCase() || null, metadata: { country_code: object.metadata?.country_code ?? null, billing_period: object.metadata?.billing_period ?? null } }, { onConflict: "user_id" });
        if (subError) throw new Error(`Subscription sync failed: ${subError.message}`);
      }
    }
    if (eventType === "invoice.paid" && object.subscription) {
      const { data: subscription } = await admin.from("subscriptions").select("user_id,plan_id").eq("provider", "stripe").eq("external_subscription_id", String(object.subscription)).maybeSingle();
      if (subscription?.user_id && subscription.plan_id && subscription.plan_id !== "free") {
        const periodStart = epochToIso(object.period_start); const periodEnd = epochToIso(object.period_end);
        const { error } = await admin.rpc("activate_paid_plan", { p_user_id: subscription.user_id, p_plan_id: subscription.plan_id, p_period_start: periodStart, p_period_end: periodEnd, p_idempotency_key: `stripe:invoice:${String(object.id)}`, p_metadata: { provider: "stripe", invoice_id: String(object.id), event_id: eventId } });
        if (error) throw new Error(`Paid invoice activation failed: ${error.message}`);
        const { count } = await admin.from("billing_transactions").select("id", { count: "exact", head: true }).eq("user_id", subscription.user_id).eq("stripe_subscription_id", String(object.subscription)).eq("kind", "plan");
        const kind = Number(count ?? 0) > 0 ? "renewal" : "plan";
        await saveBillingTransaction(admin, { user_id: subscription.user_id, provider: "stripe", kind, status: "paid", plan_id: subscription.plan_id, description: `${subscription.plan_id === "business" ? "Growth" : "Starter"} ${kind === "plan" ? "subscription" : "renewal"}`, amount_minor: Number(object.amount_paid ?? 0), currency: String(object.currency ?? "USD").toUpperCase(), stripe_invoice_id: String(object.id), stripe_customer_id: object.customer ?? null, stripe_subscription_id: String(object.subscription), external_event_id: eventId, receipt_url: object.hosted_invoice_url ?? null, purchased_at: epochToIso(object.status_transitions?.paid_at) ?? new Date().toISOString(), period_start: periodStart, period_end: periodEnd, metadata: { provider_event: eventType, invoice_number: object.number ?? null } });
      }
    }
    if (eventType === "customer.subscription.deleted") {
      userId = object.metadata?.user_id ?? userId; if (!userId && object.id) { const { data: subscription } = await admin.from("subscriptions").select("user_id").eq("provider", "stripe").eq("external_subscription_id", String(object.id)).maybeSingle(); userId = subscription?.user_id ?? null; }
      if (userId) { await admin.from("subscriptions").update({ status: "canceled", cancel_at_period_end: false, updated_at: new Date().toISOString() }).eq("user_id", userId).eq("provider", "stripe"); const { data: freePlan } = await admin.from("plans").select("monthly_credits").eq("id", "free").single(); const freeCredits = Number(freePlan?.monthly_credits ?? 5); const { data: current } = await admin.from("profiles").select("monthly_credits,credits").eq("id", userId).single(); if (current) await admin.from("profiles").update({ plan: "free", plan_id: "free", monthly_credits: freeCredits, credits: Math.max(0, Number(current.credits) + freeCredits - Number(current.monthly_credits)), updated_at: new Date().toISOString() }).eq("id", userId); }
    }
    if (eventType === "invoice.payment_failed" && object.subscription) await admin.from("subscriptions").update({ status: "past_due", updated_at: new Date().toISOString() }).eq("provider", "stripe").eq("external_subscription_id", String(object.subscription));
    await admin.from("billing_events").update({ status: "processed", processed_at: new Date().toISOString(), error_message: null }).eq("provider", "stripe").eq("event_id", eventId);
    return Response.json({ received: true });
  } catch (error) { const message = error instanceof Error ? error.message : "Billing event processing failed"; await admin.from("billing_events").update({ status: "failed", error_message: message }).eq("provider", "stripe").eq("event_id", eventId); return Response.json({ error: message }, { status: 500 }); }
});
