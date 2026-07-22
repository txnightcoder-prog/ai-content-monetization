#!/usr/bin/env node
/**
 * AI Content Monetization — MCP Troubleshooting Server
 *
 * Tools exposed to any AI assistant (Bob or otherwise):
 *
 *  get_backend_health      — ping the backend /health endpoint
 *  get_live_logs           — tail Azure Container App logs (last N lines)
 *  test_ai                 — fire a real Gemini/OpenAI prompt and return result
 *  get_video_provider      — show which video provider is active (Veo/Pexels/etc.)
 *  get_dashboard_metrics   — pull script/video/post counts from the backend
 *  check_env_vars          — verify all critical env vars are set in Azure (no values exposed)
 *  restart_backend         — trigger a backend container revision restart
 *  run_azure_cli           — run a safe read-only az CLI command
 *
 * Required env vars (set in mcp.json):
 *   BACKEND_URL            — https://ai-content-backend.victoriousmeadow-edd1d4e3.eastus.azurecontainerapps.io
 *   DASHBOARD_USERNAME     — txnightcoder@gmail.com
 *   DASHBOARD_PASSWORD     — Copycopy2026ki!
 *   AZURE_RESOURCE_GROUP   — ai-video-pipeline
 *   AZURE_CONTAINER_APP    — ai-content-backend
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { execSync } from "child_process";

// ── Config from env ──────────────────────────────────────────────────────────
const BACKEND_URL     = process.env.BACKEND_URL     || "https://ai-content-backend.victoriousmeadow-edd1d4e3.eastus.azurecontainerapps.io";
const USERNAME        = process.env.DASHBOARD_USERNAME || "";
const PASSWORD        = process.env.DASHBOARD_PASSWORD || "";
const RESOURCE_GROUP  = process.env.AZURE_RESOURCE_GROUP || "ai-video-pipeline";
const CONTAINER_APP   = process.env.AZURE_CONTAINER_APP  || "ai-content-backend";

// ── Auth token cache ─────────────────────────────────────────────────────────
let _cachedToken: string | null = null;
let _tokenExpiry = 0;

async function getAuthToken(): Promise<string> {
  if (_cachedToken && Date.now() < _tokenExpiry) return _cachedToken;
  const res = await fetch(`${BACKEND_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD, totp_code: "" }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status}`);
  const data = await res.json() as { access_token: string };
  _cachedToken = data.access_token;
  _tokenExpiry = Date.now() + 28 * 24 * 60 * 60 * 1000; // 28 days
  return _cachedToken;
}

async function apiFetch(path: string, init?: RequestInit) {
  const token = await getAuthToken();
  return fetch(`${BACKEND_URL}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
}

// ── MCP Server ───────────────────────────────────────────────────────────────
const server = new McpServer({
  name: "ai-content-monetization",
  version: "1.0.0",
});

// ── TOOL: get_backend_health ─────────────────────────────────────────────────
server.tool(
  "get_backend_health",
  "Ping the backend /health endpoint and confirm it is running",
  {},
  async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/health`);
      const data = await res.json();
      return { content: [{ type: "text" as const, text: `✅ Backend healthy: ${JSON.stringify(data)}` }] };
    } catch (err) {
      return { content: [{ type: "text" as const, text: `❌ Backend unreachable: ${err}` }], isError: true };
    }
  }
);

// ── TOOL: get_live_logs ──────────────────────────────────────────────────────
server.tool(
  "get_live_logs",
  "Tail the last N lines of the Azure Container App backend logs to diagnose errors",
  { lines: z.number().min(10).max(200).default(50).describe("Number of log lines to return") },
  async ({ lines }) => {
    try {
      const output = execSync(
        `az containerapp logs show --name ${CONTAINER_APP} --resource-group ${RESOURCE_GROUP} --tail ${lines} 2>&1`,
        { encoding: "utf8", timeout: 30000 }
      );
      // Parse JSON log entries and extract just the Log field
      const parsed = output
        .split("\n")
        .filter(l => l.trim().startsWith("{"))
        .map(l => {
          try { return (JSON.parse(l) as { Log?: string }).Log ?? l; } catch { return l; }
        })
        .filter(l => l.trim())
        .join("\n");
      return { content: [{ type: "text" as const, text: parsed || output }] };
    } catch (err) {
      return { content: [{ type: "text" as const, text: `❌ Failed to get logs: ${err}` }], isError: true };
    }
  }
);

// ── TOOL: test_ai ────────────────────────────────────────────────────────────
server.tool(
  "test_ai",
  "Send a real prompt to the backend AI (Gemini/OpenAI) and return the answer — confirms AI is working",
  { question: z.string().default("What is one tip for growing a YouTube channel?").describe("Question to ask the AI") },
  async ({ question }) => {
    try {
      const res = await apiFetch("/api/v1/scripts/ask", {
        method: "POST",
        body: JSON.stringify({ question }),
      });
      if (!res.ok) {
        const err = await res.json() as { detail?: string };
        return { content: [{ type: "text" as const, text: `❌ AI error ${res.status}: ${err.detail ?? res.statusText}` }], isError: true };
      }
      const data = await res.json() as { answer: string };
      return { content: [{ type: "text" as const, text: `✅ AI responded:\n\n${data.answer}` }] };
    } catch (err) {
      return { content: [{ type: "text" as const, text: `❌ AI request failed: ${err}` }], isError: true };
    }
  }
);

// ── TOOL: get_video_provider ─────────────────────────────────────────────────
server.tool(
  "get_video_provider",
  "Show which video provider is currently active (Veo3 / ElevenLabs+Pexels / Creatify / none)",
  {},
  async () => {
    try {
      const res = await apiFetch("/api/v1/health/video-provider");
      const data = await res.json() as { provider: string; label: string; detail: string };
      return { content: [{ type: "text" as const, text: `✅ Video provider: ${data.label}\nProvider ID: ${data.provider}\nDetail: ${data.detail}` }] };
    } catch (err) {
      return { content: [{ type: "text" as const, text: `❌ Failed: ${err}` }], isError: true };
    }
  }
);

// ── TOOL: get_dashboard_metrics ──────────────────────────────────────────────
server.tool(
  "get_dashboard_metrics",
  "Pull script/video/post counts and recent activity from the backend dashboard",
  {},
  async () => {
    try {
      const res = await apiFetch("/api/v1/dashboard/metrics");
      if (!res.ok) return { content: [{ type: "text" as const, text: `❌ Metrics error: ${res.status}` }], isError: true };
      const data = await res.json() as {
        overview: { total_scripts: number; total_videos: number; total_posts: number; revenue_30d: number };
        videos_by_status: Record<string, number>;
        scripts_by_status: Record<string, number>;
      };
      const lines = [
        `📊 Dashboard Metrics`,
        `  Scripts: ${data.overview.total_scripts}`,
        `  Videos:  ${data.overview.total_videos}`,
        `  Posts:   ${data.overview.total_posts}`,
        `  Revenue (30d): $${data.overview.revenue_30d}`,
        `  Videos by status: ${JSON.stringify(data.videos_by_status)}`,
        `  Scripts by status: ${JSON.stringify(data.scripts_by_status)}`,
      ];
      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    } catch (err) {
      return { content: [{ type: "text" as const, text: `❌ Failed: ${err}` }], isError: true };
    }
  }
);

// ── TOOL: check_env_vars ─────────────────────────────────────────────────────
server.tool(
  "check_env_vars",
  "Check which critical environment variables are set or missing in the Azure backend — values are never shown, just present/missing status",
  {},
  async () => {
    try {
      const output = execSync(
        `az containerapp show --name ${CONTAINER_APP} --resource-group ${RESOURCE_GROUP} --query "properties.template.containers[0].env[].name" -o json 2>&1`,
        { encoding: "utf8", timeout: 30000 }
      );
      const setVars: string[] = JSON.parse(output);

      const CRITICAL = [
        "GOOGLE_API_KEY", "GEMINI_MODEL", "OPENAI_API_KEY",
        "ELEVENLABS_API_KEY", "PEXELS_API_KEY", "BUFFER_ACCESS_TOKEN",
        "DASHBOARD_USERNAME", "DASHBOARD_PASSWORD", "DASHBOARD_SECRET",
        "DATABASE_URL", "AZURE_STORAGE_CONNECTION_STRING",
        "YOUTUBE_DATA_API_KEY", "FAL_API_KEY", "STRIPE_SECRET_KEY",
      ];

      const lines = CRITICAL.map(v => {
        const present = setVars.includes(v);
        return `${present ? "✅" : "❌"} ${v}`;
      });

      return { content: [{ type: "text" as const, text: `Environment variable status:\n\n${lines.join("\n")}` }] };
    } catch (err) {
      return { content: [{ type: "text" as const, text: `❌ Failed to check env vars: ${err}` }], isError: true };
    }
  }
);

// ── TOOL: generate_script ────────────────────────────────────────────────────
server.tool(
  "generate_script",
  "Generate a short-form video script via the backend AI",
  {
    topic: z.string().describe("Video topic to write a script about"),
    niche: z.string().default("AI tools").describe("Content niche"),
  },
  async ({ topic, niche }) => {
    try {
      const res = await apiFetch(`/api/v1/scripts/generate?topic=${encodeURIComponent(topic)}&niche=${encodeURIComponent(niche)}`);
      if (!res.ok) {
        const err = await res.json() as { detail?: string };
        return { content: [{ type: "text" as const, text: `❌ Script generation error ${res.status}: ${err.detail}` }], isError: true };
      }
      const data = await res.json() as { hook: string; body: string; cta: string; topic: string };
      return {
        content: [{
          type: "text" as const,
          text: `✅ Script generated for: "${data.topic}"\n\n🎣 HOOK:\n${data.hook}\n\n📝 BODY:\n${data.body}\n\n📣 CTA:\n${data.cta}`,
        }],
      };
    } catch (err) {
      return { content: [{ type: "text" as const, text: `❌ Failed: ${err}` }], isError: true };
    }
  }
);

// ── TOOL: restart_backend ────────────────────────────────────────────────────
server.tool(
  "restart_backend",
  "Restart the Azure backend container app to pick up new env vars or clear a stuck state",
  {},
  async () => {
    try {
      // Get current revision name
      const revOutput = execSync(
        `az containerapp show --name ${CONTAINER_APP} --resource-group ${RESOURCE_GROUP} --query "properties.latestReadyRevisionName" -o tsv 2>&1`,
        { encoding: "utf8", timeout: 30000 }
      ).trim();

      const result = execSync(
        `az containerapp revision restart --name ${CONTAINER_APP} --resource-group ${RESOURCE_GROUP} --revision ${revOutput} 2>&1`,
        { encoding: "utf8", timeout: 60000 }
      );
      return { content: [{ type: "text" as const, text: `✅ Restarted revision: ${revOutput}\n${result}` }] };
    } catch (err) {
      return { content: [{ type: "text" as const, text: `❌ Restart failed: ${err}` }], isError: true };
    }
  }
);

// ── TOOL: set_env_var ────────────────────────────────────────────────────────
server.tool(
  "set_env_var",
  "Set or update a single environment variable in the Azure backend container app",
  {
    name: z.string().describe("Environment variable name, e.g. GEMINI_MODEL"),
    value: z.string().describe("Value to set"),
  },
  async ({ name, value }) => {
    try {
      const result = execSync(
        `az containerapp update --name ${CONTAINER_APP} --resource-group ${RESOURCE_GROUP} --set-env-vars "${name}=${value}" 2>&1`,
        { encoding: "utf8", timeout: 60000 }
      );
      // Just return a summary, not the full JSON
      const success = result.includes("Succeeded") || result.includes("Running");
      return { content: [{ type: "text" as const, text: success ? `✅ ${name} updated successfully` : `⚠️ Update ran but status unclear. Check get_live_logs.` }] };
    } catch (err) {
      return { content: [{ type: "text" as const, text: `❌ Failed to set env var: ${err}` }], isError: true };
    }
  }
);

// ── TOOL: get_topic_ideas ─────────────────────────────────────────────────────
server.tool(
  "get_topic_ideas",
  "Generate AI video topic ideas for a given niche",
  { niche: z.string().default("AI tools").describe("Content niche to generate ideas for") },
  async ({ niche }) => {
    try {
      const res = await apiFetch("/api/v1/scripts/topic-ideas", {
        method: "POST",
        body: JSON.stringify({ niche, count: 5 }),
      });
      if (!res.ok) {
        const err = await res.json() as { detail?: string };
        return { content: [{ type: "text" as const, text: `❌ Topic ideas error ${res.status}: ${err.detail}` }], isError: true };
      }
      const data = await res.json() as { ideas: string[] };
      return { content: [{ type: "text" as const, text: `✅ Topic ideas for "${niche}":\n\n${data.ideas.map((t, i) => `${i + 1}. ${t}`).join("\n")}` }] };
    } catch (err) {
      return { content: [{ type: "text" as const, text: `❌ Failed: ${err}` }], isError: true };
    }
  }
);

// ── TOOL: full_diagnostic ────────────────────────────────────────────────────
server.tool(
  "full_diagnostic",
  "Run a complete diagnostic of the app — health, AI, video provider, env vars, and metrics all at once",
  {},
  async () => {
    const results: string[] = ["🔍 Full Diagnostic Report\n" + "=".repeat(40)];

    // 1. Health
    try {
      const res = await fetch(`${BACKEND_URL}/health`);
      const data = await res.json() as { status: string };
      results.push(`✅ Backend: ${data.status}`);
    } catch (err) { results.push(`❌ Backend: unreachable — ${err}`); }

    // 2. Auth
    try {
      await getAuthToken();
      results.push("✅ Auth: login successful");
    } catch (err) { results.push(`❌ Auth: login failed — ${err}`); }

    // 3. AI
    try {
      const res = await apiFetch("/api/v1/scripts/topic-ideas", {
        method: "POST",
        body: JSON.stringify({ niche: "AI tools", count: 1 }),
      });
      if (res.ok) {
        const d = await res.json() as { ideas: string[] };
        results.push(`✅ Gemini AI: working — "${d.ideas[0]}"`);
      } else {
        const e = await res.json() as { detail?: string };
        results.push(`❌ Gemini AI: ${res.status} — ${e.detail}`);
      }
    } catch (err) { results.push(`❌ Gemini AI: ${err}`); }

    // 4. Video provider
    try {
      const res = await apiFetch("/api/v1/health/video-provider");
      const d = await res.json() as { label: string; provider: string };
      results.push(`✅ Video: ${d.label} (${d.provider})`);
    } catch (err) { results.push(`❌ Video provider: ${err}`); }

    // 5. Metrics
    try {
      const res = await apiFetch("/api/v1/dashboard/metrics");
      const d = await res.json() as { overview: { total_scripts: number; total_videos: number } };
      results.push(`✅ Metrics: scripts=${d.overview.total_scripts}, videos=${d.overview.total_videos}`);
    } catch (err) { results.push(`❌ Metrics: ${err}`); }

    // 6. Env vars via Azure CLI
    try {
      const output = execSync(
        `az containerapp show --name ${CONTAINER_APP} --resource-group ${RESOURCE_GROUP} --query "properties.template.containers[0].env[].name" -o json 2>&1`,
        { encoding: "utf8", timeout: 30000 }
      );
      const setVars: string[] = JSON.parse(output);
      const missing = ["GOOGLE_API_KEY", "ELEVENLABS_API_KEY", "PEXELS_API_KEY", "DASHBOARD_SECRET", "DATABASE_URL"]
        .filter(v => !setVars.includes(v));
      if (missing.length === 0) {
        results.push("✅ Critical env vars: all present");
      } else {
        results.push(`❌ Missing env vars: ${missing.join(", ")}`);
      }
    } catch { results.push("⚠️ Env vars: az CLI not available"); }

    return { content: [{ type: "text" as const, text: results.join("\n") }] };
  }
);

// ── Start ────────────────────────────────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("ai-content-monetization MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
