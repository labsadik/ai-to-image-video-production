import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { GoogleGenAI } from "npm:@google/genai@2.21.0";

const url = Deno.env.get("SUPABASE_URL")!;
const key = Deno.env.get("SUPABASE_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  if (!key) return Response.json({ error: "Missing Supabase secret key" }, { status: 500 });
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const userClient = createClient(url, Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "", { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (typeof body.base64 !== "string" || typeof body.mimeType !== "string") return Response.json({ error: "base64 and mimeType are required" }, { status: 400 });
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: policy, error: policyError } = await admin.from("safety_policies").select("version,rules,moderation_provider_id,moderation_model_id").eq("status","active").order("version", { ascending: false }).limit(1).maybeSingle();
  if (policyError || !policy?.moderation_provider_id || !policy.moderation_model_id) return Response.json({ error: "Safety moderation is not configured" }, { status: 503 });
  if (policy.moderation_provider_id !== "google") return Response.json({ error: "This deployed Edge Function currently supports Google moderation" }, { status: 503 });
  const { data: model } = await admin.from("ai_models").select("model_key").eq("id", policy.moderation_model_id).eq("enabled", true).maybeSingle();
  const apiKey = Deno.env.get("GOOGLE_AI_API_KEY");
  if (!model?.model_key || !apiKey) return Response.json({ error: "Moderation provider credentials are not configured" }, { status: 503 });
  const rules = (policy.rules ?? {}) as Record<string, unknown>;
  const prompt = ["Classify this image for Solamentis safety.", "Return JSON only: {decision: allow|review|block, reasons: string[], score: number}.", `Block categories: ${JSON.stringify(rules.blockPatterns ?? [])}`, `Review categories: ${JSON.stringify(rules.reviewPatterns ?? [])}`].join("\n");
  const response = await new GoogleGenAI({ apiKey }).models.generateContent({ model: model.model_key, contents: [{ role: "user", parts: [{ text: prompt }, { inlineData: { mimeType: body.mimeType, data: body.base64 } }] }], config: { responseMimeType: "application/json" } });
  let result: any;
  try { result = JSON.parse(response.text ?? "{}"); } catch { result = { decision: "review", reasons: ["Invalid moderation response"] }; }
  const decision = ["allow", "review", "block"].includes(result.decision) ? result.decision : "review";
  const reasons = Array.isArray(result.reasons) ? result.reasons.filter((x: unknown) => typeof x === "string").slice(0, 12) : [];
  const score = typeof result.score === "number" && Number.isFinite(result.score) ? Math.max(0, Math.min(1, result.score)) : null;
  const { error } = await admin.from("safety_events").insert({ user_id: user.id, policy_version: Number(policy.version), stage: String(body.stage ?? "edge_image_moderation"), decision, reasons, score, provider_id: "google", model_key: model.model_key });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true, decision, reasons, score });
});
