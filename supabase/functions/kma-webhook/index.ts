import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-API-Key",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

async function readBody(req: Request): Promise<any> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

const serviceClient = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// =========================================================
// Auth resolution: API key or JWT
// =========================================================
async function resolveUserId(req: Request): Promise<string | null> {
  // Check for API key header first
  const apiKey = req.headers.get("X-API-Key") ?? "";
  if (apiKey) {
    const ip = req.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ?? null;
    const { data, error } = await serviceClient.rpc("lookup_api_key", {
      p_key: apiKey,
      p_ip: ip,
    });
    if (error || !data || data.length === 0) return null;
    const row = (data as Array<{ user_id: string; is_valid: boolean }>)[0];
    return row.is_valid ? row.user_id : null;
  }

  // Fall back to JWT auth
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token || token === Deno.env.get("SUPABASE_ANON_KEY")) return null;

  const { data: userData, error } = await serviceClient.auth.getUser(token);
  if (error || !userData?.user) return null;
  return userData.user.id;
}

function userClient(req: Request) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token || token === Deno.env.get("SUPABASE_ANON_KEY")) return null;
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );
}

// =========================================================
// Webhook resolution
// =========================================================
async function resolveWebhookUrl(webhookId?: string, rawUrl?: string): Promise<string> {
  if (rawUrl && /^https:\/\/discord(app)?\.com\/api\/webhooks\/[0-9]+\/.+/.test(rawUrl)) {
    return rawUrl;
  }
  if (!webhookId) throw new Error("webhook_id is required");
  const { data, error } = await serviceClient
    .from("webhooks")
    .select("url")
    .eq("id", webhookId)
    .maybeSingle();
  if (error || !data) throw new Error("Webhook not found");
  return data.url;
}

async function resolveMultipleWebhookUrls(ids: string[]): Promise<{ id: string; url: string; name: string }[]> {
  const { data, error } = await serviceClient
    .from("webhooks")
    .select("id, url, name")
    .in("id", ids);
  if (error || !data) throw new Error("Failed to resolve webhooks");
  return data.map((w: any) => ({ id: w.id, url: w.url, name: w.name }));
}

// =========================================================
// Discord send
// =========================================================
async function sendToDiscord(
  url: string,
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; body: string }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await res.text();
  return { ok: res.ok, status: res.status, body };
}

async function testWebhook(url: string): Promise<{
  reachable: boolean;
  status: number;
  latencyMs: number;
}> {
  const start = performance.now();
  const res = await fetch(url, { method: "GET" });
  const latencyMs = Math.round(performance.now() - start);
  return { reachable: res.ok, status: res.status, latencyMs };
}

// =========================================================
// Embed building
// =========================================================
function hexToInt(hex: string): number {
  let h = (hex || "").replace("#", "").trim();
  if (h.length === 3) {
    h = h.split("").map((c) => c + c).join("");
  }
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return 0x5865f2;
  return parseInt(h, 16);
}

function buildEmbed(p: any) {
  const fields = Array.isArray(p.fields)
    ? p.fields
        .filter((f: any) => f && (f.name || f.value))
        .map((f: any) => ({
          name: f.name || "\u200b",
          value: f.value || "\u200b",
          inline: !!f.inline,
        }))
    : [];

  const embed: Record<string, unknown> = {
    title: p.title || undefined,
    description: p.description || undefined,
    color: hexToInt(p.color),
  };
  if (p.author) embed.author = { name: p.author };
  if (p.footer) embed.footer = { text: p.footer };
  if (p.image) embed.image = { url: p.image };
  if (p.thumbnail) embed.thumbnail = { url: p.thumbnail };
  if (fields.length) embed.fields = fields;

  Object.keys(embed).forEach((k) => embed[k] === undefined && delete embed[k]);
  return embed;
}

// =========================================================
// Variable substitution
// =========================================================
function substituteVariables(text: string, vars: Record<string, string>): string {
  if (!text) return text;
  return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    return vars[key] !== undefined ? vars[key] : `{{${key}}}`;
  });
}

function substituteEmbedVariables(embed: any, vars: Record<string, string>): any {
  if (!embed) return embed;
  const result = { ...embed };
  if (result.title) result.title = substituteVariables(result.title, vars);
  if (result.description) result.description = substituteVariables(result.description, vars);
  if (result.author) result.author = substituteVariables(result.author, vars);
  if (result.footer) result.footer = substituteVariables(result.footer, vars);
  if (Array.isArray(result.fields)) {
    result.fields = result.fields.map((f: any) => ({
      ...f,
      name: substituteVariables(f.name, vars),
      value: substituteVariables(f.value, vars),
    }));
  }
  return result;
}

function buildDefaultVars(): Record<string, string> {
  const now = new Date();
  return {
    date: now.toLocaleDateString(),
    time: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    datetime: now.toLocaleString(),
    timestamp: Math.floor(now.getTime() / 1000).toString(),
    year: now.getFullYear().toString(),
    month: (now.getMonth() + 1).toString().padStart(2, "0"),
    day: now.getDate().toString().padStart(2, "0"),
    hour: now.getHours().toString().padStart(2, "0"),
    minute: now.getMinutes().toString().padStart(2, "0"),
    weekday: now.toLocaleDateString([], { weekday: "long" }),
    month_name: now.toLocaleDateString([], { month: "long" }),
    iso_date: now.toISOString().slice(0, 10),
    iso_time: now.toISOString().slice(11, 19),
    week_number: Math.ceil(((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 86400000 + 1) / 7).toString(),
    greeting: now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening",
    random_number: Math.floor(Math.random() * 10000).toString(),
    random_uuid: crypto.randomUUID(),
  };
}

// =========================================================
// History recording (supports both JWT and API key auth)
// =========================================================
async function recordHistory(
  req: Request,
  userId: string | null,
  action: string,
  content: string,
  status: "success" | "error",
  detail: string,
) {
  if (!userId) return;
  // Use API-key-aware function via service client (works for both auth methods)
  await serviceClient.rpc("record_history_api", {
    p_user_id: userId,
    p_action: action,
    p_content: content,
    p_status: status,
    p_detail: detail,
  });
}

async function recordTest(
  req: Request,
  userId: string | null,
  webhookId: string,
  reachable: boolean,
  httpStatus: number,
  latencyMs: number,
) {
  if (!userId) return;
  const status = reachable ? "operational" : httpStatus >= 500 ? "error" : "warning";
  await serviceClient.rpc("record_webhook_test_api", {
    p_user_id: userId,
    p_id: webhookId,
    p_status: status,
    p_http: httpStatus,
    p_latency: latencyMs,
  });
}

// =========================================================
// Main handler
// =========================================================
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: CORS_HEADERS });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/kma-webhook\/?/, "");

    // Resolve user ID once for all routes (API key or JWT)
    const userId = await resolveUserId(req);

    // POST /send-message
    if (path === "send-message" && req.method === "POST") {
      const b = await readBody(req);
      const webhookUrl = await resolveWebhookUrl(b.webhook_id, b.webhook_url);
      const vars = { ...buildDefaultVars(), ...(b.variables || {}) };
      const content = substituteVariables(String(b.content || ""), vars);
      const payload: Record<string, unknown> = { content };
      if (b.username) payload.username = substituteVariables(String(b.username), vars);
      if (b.avatar_url) payload.avatar_url = b.avatar_url;

      const result = await sendToDiscord(webhookUrl, payload);
      const ok = result.ok;
      await recordHistory(req, userId, "MESSAGE", String(b.content || "").slice(0, 200), ok ? "success" : "error", ok ? "" : `HTTP ${result.status}: ${result.body.slice(0, 200)}`);
      return json({ ok, status: result.status, message: ok ? "Message sent" : result.body });
    }

    // POST /send-embed
    if (path === "send-embed" && req.method === "POST") {
      const b = await readBody(req);
      const webhookUrl = await resolveWebhookUrl(b.webhook_id, b.webhook_url);
      const vars = { ...buildDefaultVars(), ...(b.variables || {}) };
      const embedRaw = b.embed || b;
      const embedSub = substituteEmbedVariables(embedRaw, vars);
      const payload: Record<string, unknown> = { embeds: [buildEmbed(embedSub)] };
      if (b.username) payload.username = substituteVariables(String(b.username), vars);
      if (b.avatar_url) payload.avatar_url = b.avatar_url;

      const result = await sendToDiscord(webhookUrl, payload);
      const ok = result.ok;
      await recordHistory(req, userId, "EMBED", String(b.embed?.title || "Embed"), ok ? "success" : "error", ok ? "" : `HTTP ${result.status}: ${result.body.slice(0, 200)}`);
      return json({ ok, status: result.status, message: ok ? "Embed sent" : result.body });
    }

    // POST /send-template
    if (path === "send-template" && req.method === "POST") {
      const b = await readBody(req);
      const webhookUrl = await resolveWebhookUrl(b.webhook_id, b.webhook_url);
      const t = b.template;
      if (!t || !t.payload) throw new Error("Template payload required");
      const vars = { ...buildDefaultVars(), ...(b.variables || {}) };

      const payload: Record<string, unknown> = {};
      if (t.kind === "embed") {
        const embedSub = substituteEmbedVariables(t.payload, vars);
        payload.embeds = [buildEmbed(embedSub)];
      } else {
        payload.content = substituteVariables(String(t.payload.content || t.payload.message || ""), vars);
      }
      if (b.username) payload.username = substituteVariables(String(b.username), vars);
      if (b.avatar_url) payload.avatar_url = b.avatar_url;

      const result = await sendToDiscord(webhookUrl, payload);
      const ok = result.ok;
      await recordHistory(req, userId, "TEMPLATE", String(t.name || "Template"), ok ? "success" : "error", ok ? "" : `HTTP ${result.status}: ${result.body.slice(0, 200)}`);
      return json({ ok, status: result.status, message: ok ? "Template sent" : result.body });
    }

    // POST /broadcast
    if (path === "broadcast" && req.method === "POST") {
      const b = await readBody(req);
      const webhookIds: string[] = b.webhook_ids || [];
      if (!webhookIds.length) throw new Error("At least one webhook is required");

      const hooks = await resolveMultipleWebhookUrls(webhookIds);
      const vars = { ...buildDefaultVars(), ...(b.variables || {}) };
      const kind: string = b.kind || "message";

      let succeeded = 0;
      let failed = 0;
      const results: Record<string, { ok: boolean; status: number }> = {};

      for (const hook of hooks) {
        const payload: Record<string, unknown> = {};
        if (kind === "embed") {
          const embedSub = substituteEmbedVariables(b.embed || b.payload, vars);
          payload.embeds = [buildEmbed(embedSub)];
        } else {
          payload.content = substituteVariables(String(b.content || ""), vars);
        }
        if (b.username) payload.username = substituteVariables(String(b.username), vars);
        if (b.avatar_url) payload.avatar_url = b.avatar_url;

        const result = await sendToDiscord(hook.url, payload);
        if (result.ok) succeeded++; else failed++;
        results[hook.name] = { ok: result.ok, status: result.status };
      }

      if (userId) {
        const contentSummary = kind === "embed" ? String(b.embed?.title || "Embed") : String(b.content || "").slice(0, 100);
        await serviceClient.rpc("log_broadcast_api", {
          p_user_id: userId,
          p_content: contentSummary,
          p_kind: kind,
          p_total: hooks.length,
          p_succeeded: succeeded,
          p_failed: failed,
          p_detail: results as any,
        });
        await recordHistory(req, userId, kind === "embed" ? "EMBED" : "MESSAGE", `Broadcast to ${hooks.length} webhook(s)`, failed === 0 ? "success" : "error", `${succeeded}/${hooks.length} succeeded`);
      }

      return json({
        ok: failed === 0, total: hooks.length, succeeded, failed,
        results, message: `Broadcast sent: ${succeeded} succeeded, ${failed} failed`,
      });
    }

    // POST /process-scheduled
    if (path === "process-scheduled" && req.method === "POST") {
      const { data: due, error } = await serviceClient.rpc("get_due_scheduled_messages");
      if (error) throw new Error("Failed to fetch scheduled messages");
      const dueMessages = (due as any[]) || [];

      let processed = 0;
      let succeeded = 0;
      let failed = 0;

      for (const msg of dueMessages) {
        const payload: Record<string, unknown> = {};
        const p = msg.payload || {};
        if (msg.kind === "embed") {
          payload.embeds = [buildEmbed(p)];
        } else {
          payload.content = p.content || "";
        }

        const result = await sendToDiscord(msg.webhook_url, payload);
        const status = result.ok ? "sent" : "failed";
        await serviceClient.rpc("mark_scheduled_sent", { p_id: msg.id, p_status: status });
        processed++;
        if (result.ok) succeeded++; else failed++;
      }

      return json({ ok: true, processed, succeeded, failed });
    }

    // POST /test-webhook
    if (path === "test-webhook" && req.method === "POST") {
      const b = await readBody(req);
      const webhookUrl = await resolveWebhookUrl(b.webhook_id, b.webhook_url);
      const result = await testWebhook(webhookUrl);
      if (b.webhook_id) await recordTest(req, userId, b.webhook_id, result.reachable, result.status, result.latencyMs);
      return json({
        ok: result.reachable,
        reachable: result.reachable,
        status: result.status,
        latency_ms: result.latencyMs,
        message: result.reachable ? "Webhook is reachable" : `Webhook returned HTTP ${result.status}`,
      });
    }

    // GET /discord-server
    if (path === "discord-server" && req.method === "GET") {
      const inviteCode = url.searchParams.get("code") ?? "fANjVMzAS";
      if (!/^[a-zA-Z0-9]+$/.test(inviteCode)) {
        return json({ error: "Invalid invite code" }, 400);
      }
      const res = await fetch(
        `https://discord.com/api/v9/invites/${inviteCode}?with_counts=true&with_expiration=true`,
        { headers: { "User-Agent": "KMA-Tools/1.0" } },
      );
      if (!res.ok) {
        return json({ error: "Failed to fetch server info" }, res.status);
      }
      const data = await res.json();
      return json({
        ok: true,
        server_name: data.guild?.name ?? "Unknown",
        server_id: data.guild?.id,
        icon_hash: data.guild?.icon,
        icon_url: data.guild?.icon
          ? `https://cdn.discordapp.com/icons/${data.guild.id}/${data.guild.icon}.png?size=128`
          : null,
        banner_hash: data.guild?.banner,
        banner_url: data.guild?.banner
          ? `https://cdn.discordapp.com/banners/${data.guild.id}/${data.guild.banner}.png?size=512`
          : null,
        member_count: data.approximate_member_count ?? 0,
        online_count: data.approximate_presence_count ?? 0,
        invite_url: `https://discord.gg/${inviteCode}`,
        channel_name: data.channel?.name ?? null,
      });
    }

    return json({ error: "Not found", path }, 404);
  } catch (err) {
    return json({ error: err?.message ?? "Internal error" }, 500);
  }
});
