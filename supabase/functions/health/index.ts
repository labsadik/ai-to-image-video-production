import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (_req: Request) => {
  return Response.json({ ok: true, service: "solamentis", function: "health", timestamp: new Date().toISOString() });
});
