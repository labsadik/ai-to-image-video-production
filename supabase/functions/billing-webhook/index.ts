import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL")!;
const key = Deno.env.get("SUPABASE_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

async function verify(raw: string, signature: string, secret: string) {
  const values = Object.fromEntries(signature.split(",").map((item) => item.split("=", 2)));
  if (!values.t || !values.v1) return false;
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(values.t));
  if (!Number.isFinite(age) || age > 300) return false;
  const cryptoKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(`${values.t}.${raw}`));
  const expected = Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return expected === values.v1;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  if (!key || !webhookSecret) return Response.json({ error: "Billing webhook is not configured" }, { status: 503 });
  const raw = await req.text();
  const signature = req.headers.get("stripe-signature");
  if (!signature || !(await verify(raw, signature, webhookSecret))) return Response.json({ error: "Invalid signature" }, { status: 400 });
  let event: any;
  try { event = JSON.parse(raw); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: existing } = await admin.from("billing_events").select("id").eq("provider", "stripe").eq("external_event_id", String(event.id)).maybeSingle();
  if (existing) return Response.json({ ok: true, duplicate: true });
  const object = event.data?.object ?? {};
  const userId = object.metadata?.user_id ?? null;
  const planId = object.metadata?.plan_id ?? null;
  const { error: eventError } = await admin.from("billing_events").insert({ provider: "stripe", external_event_id: String(event.id), event_type: String(event.type), user_id: userId, payload: object, processed_at: new Date().toISOString() });
  if (eventError) return Response.json({ error: eventError.message }, { status: 500 });
  if (userId && planId && ["checkout.session.completed", "customer.subscription.created", "customer.subscription.updated"].includes(event.type)) {
    const status = object.status === "canceled" ? "canceled" : "active";
    await admin.from("subscriptions").upsert({ user_id: userId, plan_id: planId, status, provider: "stripe", external_customer_id: object.customer ?? null, external_subscription_id: object.subscription ?? object.id ?? null, current_period_start: object.current_period_start ? new Date(object.current_period_start * 1000).toISOString() : null, current_period_end: object.current_period_end ? new Date(object.current_period_end * 1000).toISOString() : null }, { onConflict: "user_id,provider" });
    await admin.from("profiles").update({ plan: planId, plan_id: planId }).eq("id", userId);
  }
  if (userId && event.type === "customer.subscription.deleted") {
    await admin.from("subscriptions").update({ status: "canceled" }).eq("user_id", userId).eq("provider", "stripe");
    await admin.from("profiles").update({ plan: "free", plan_id: "free" }).eq("id", userId);
  }
  if (userId && event.type === "invoice.payment_failed") await admin.from("subscriptions").update({ status: "past_due" }).eq("user_id", userId).eq("provider", "stripe");
  return Response.json({ received: true });
});
