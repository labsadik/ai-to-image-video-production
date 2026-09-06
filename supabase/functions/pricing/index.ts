import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL")!;
const key = Deno.env.get("SUPABASE_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

Deno.serve(async (req: Request) => {
  if (req.method !== "GET") return new Response("Method Not Allowed", { status: 405 });
  if (!key) return Response.json({ error: "Missing Supabase secret key" }, { status: 500 });
  const u = new URL(req.url);
  const country = (u.searchParams.get("country") ?? req.headers.get("x-vercel-ip-country") ?? req.headers.get("cf-ipcountry") ?? "US").toUpperCase();
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: region } = await admin.from("pricing_regions").select("country_code,currency,locale").eq("country_code", country).eq("active", true).maybeSingle();
  const effective = region?.country_code ?? "US";
  const [{ data: prices, error: pricesError }, { data: creditPacks, error: creditPacksError }] = await Promise.all([
    admin.from("plan_prices").select("plan_id,country_code,currency,unit_amount_minor,active").eq("country_code", effective).eq("active", true).order("plan_id"),
    admin.from("credit_product_prices").select("product_id,country_code,currency,unit_amount_minor,active,credit_products!inner(id,display_name,credits,sort_order,active)").eq("country_code", effective).eq("active", true).order("product_id"),
  ]);
  if (pricesError) return Response.json({ error: pricesError.message }, { status: 500 });
  if (creditPacksError) return Response.json({ error: creditPacksError.message }, { status: 500 });
  return Response.json({ country: effective, currency: region?.currency ?? "USD", locale: region?.locale ?? "en-US", prices: prices ?? [], creditPacks: creditPacks ?? [] });
});
