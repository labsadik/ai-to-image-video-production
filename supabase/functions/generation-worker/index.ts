import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

function getSecretKey() {
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<string, string>;
      if (parsed.default) return parsed.default;
    } catch {
      // Fall back to the legacy server key during the 2026 migration window.
    }
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}

async function getExpectedSecret() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const secretKey = getSecretKey();
  if (!supabaseUrl || !secretKey) return null;
  const admin = createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await admin.rpc("get_generation_worker_secret");
  return error || typeof data !== "string" ? null : data;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const expected = await getExpectedSecret();
  if (!expected || req.headers.get("x-solamentis-secret") !== expected) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appUrl = Deno.env.get("SOLAMENTIS_APP_URL");
  if (!appUrl) return Response.json({ error: "Generation worker bridge is not configured: SOLAMENTIS_APP_URL" }, { status: 503 });

  const response = await fetch(`${appUrl.replace(/\/$/, "")}/api/internal/generation-worker`, {
    method: "POST",
    headers: { "x-solamentis-secret": expected },
  });
  const text = await response.text();
  return new Response(text, {
    status: response.status,
    headers: { "content-type": response.headers.get("content-type") ?? "application/json" },
  });
});
