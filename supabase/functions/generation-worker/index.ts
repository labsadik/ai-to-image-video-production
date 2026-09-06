import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  const secret = Deno.env.get("SOLAMENTIS_INTERNAL_SECRET");
  if (!secret || req.headers.get("x-solamentis-secret") !== secret) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const appUrl = Deno.env.get("SOLAMENTIS_APP_URL");
  const cronSecret = Deno.env.get("SOLAMENTIS_CRON_SECRET");
  if (!appUrl || !cronSecret) return Response.json({ error: "Generation worker bridge is not configured" }, { status: 503 });
  const response = await fetch(`${appUrl.replace(/\/$/, "")}/api/internal/generation-worker`, { method: "POST", headers: { Authorization: `Bearer ${cronSecret}` } });
  const text = await response.text();
  return new Response(text, { status: response.status, headers: { "content-type": response.headers.get("content-type") ?? "application/json" } });
});
