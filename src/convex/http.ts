import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { auth } from "./auth";

/**
 * Client .exe lisans API'leri — FastAPI'deki /api/verify ve /api/version
 * sözleşmeleri aynen korunur:
 *   POST /api/verify  { licenseKey, hwid } -> { status, tier? }
 *   GET  /api/version                  -> { version, downloadUrl, ... }
 */

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const preflight = httpAction(async () => new Response(null, { status: 204, headers: corsHeaders }));

const verify = httpAction(async (ctx, request) => {
  try {
    const body = (await request.json()) as { licenseKey?: string; hwid?: string };
    if (!body.licenseKey || !body.hwid) {
      return Response.json({ status: "invalid", error: "licenseKey ve hwid zorunlu." }, { status: 400, headers: corsHeaders });
    }
    const result = await ctx.runMutation(internal.licenses.verifyInternal, {
      licenseKey: body.licenseKey.trim().toUpperCase(),
      hwid: body.hwid,
    });
    return Response.json(result, { headers: corsHeaders });
  } catch {
    return Response.json({ status: "error" }, { status: 500, headers: corsHeaders });
  }
});

const version = httpAction(async (ctx) => {
  const latest = await ctx.runQuery(api.versions.latest, {});
  if (!latest) {
    return Response.json({ version: null, downloadUrl: null }, { headers: corsHeaders });
  }
  return Response.json(latest, { headers: corsHeaders });
});

const http = httpRouter();

auth.addHttpRoutes(http);

http.route({ path: "/api/verify", method: "OPTIONS", handler: preflight });
http.route({ path: "/api/verify", method: "POST", handler: verify });
http.route({ path: "/api/version", method: "OPTIONS", handler: preflight });
http.route({ path: "/api/version", method: "GET", handler: version });

export default http;
