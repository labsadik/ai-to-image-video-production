import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { GoogleGenAI } from "npm:@google/genai@2.21.0";

const url = Deno.env.get("SUPABASE_URL")!;
const key = Deno.env.get("SUPABASE_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  const internal = Deno.env.get("SOLAMENTIS_INTERNAL_SECRET");
  if (!internal || req.headers.get("x-solamentis-secret") !== internal) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!key) return Response.json({ error: "Missing Supabase secret key" }, { status: 500 });
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: providers, error } = await admin.from("ai_providers").select("id,protocol,base_url,secret_env,timeout_ms").eq("enabled", true);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const results = [];
  for (const p of providers ?? []) {
    const started = Date.now();
    let result: any = { provider: p.id, ok: false, latencyMs: 0 };
    try {
      const secret = Deno.env.get(p.secret_env);
      if (!secret) throw new Error(`Missing ${p.secret_env}`);
      if (p.protocol === "google_gemini") {
        const { data: model } = await admin.from("ai_models").select("model_key").eq("provider_id", p.id).eq("enabled", true).limit(1).maybeSingle();
        if (!model?.model_key) throw new Error("No enabled model configured");
        await new GoogleGenAI({ apiKey: secret }).models.get({ model: model.model_key });
      } else {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), Math.min(Number(p.timeout_ms ?? 15000), 15000));
        try { const r = await fetch(p.base_url ?? "", { method: "HEAD", signal: controller.signal }); if (!r.ok) throw new Error(`HTTP ${r.status}`); }
        finally { clearTimeout(timer); }
      }
      result.ok = true;
    } catch (e) { result.message = e instanceof Error ? e.message : "Provider health check failed"; }
    result.latencyMs = Date.now() - started;
    results.push(result);
    await admin.from("provider_health_events").insert({ provider_id: p.id, ok: result.ok, latency_ms: result.latencyMs, message: result.message ?? null, capabilities: {} });
    await admin.from("ai_providers").update({ health_status: result.ok ? "healthy" : "unhealthy", health_checked_at: new Date().toISOString(), health_latency_ms: result.latencyMs, health_message: result.message ?? null }).eq("id", p.id);
  }
  return Response.json({ ok: results.every((r) => r.ok), providers: results });
});
