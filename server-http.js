#!/usr/bin/env node
/**
 * Bitrix24 MCP Server (نسخه‌ی آنلاین - HTTP)
 * این نسخه برای دیپلوی روی سرویس‌هایی مثل Render ساخته شده تا از
 * claude.ai (مرورگر) به‌عنوان Custom Connector قابل استفاده باشه.
 *
 * متغیرهای محیطی لازم:
 *   BITRIX24_WEBHOOK_URL  - لینک وبهوک ورودی بیتریکس۲۴
 *   MCP_API_KEY           - یک رمز دلخواه برای محافظت از سرور (اختیاری ولی توصیه‌شده)
 */
import express from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { makeBitrixTools } from "./bitrix-tools.js";

const WEBHOOK_URL = process.env.BITRIX24_WEBHOOK_URL;
const API_KEY = process.env.MCP_API_KEY; // اختیاری
const PORT = process.env.PORT || 3000;

if (!WEBHOOK_URL) {
  console.error("خطا: متغیر محیطی BITRIX24_WEBHOOK_URL تنظیم نشده است.");
  process.exit(1);
}

const { TOOLS, callTool } = makeBitrixTools(WEBHOOK_URL);

function buildServer() {
  const server = new Server(
    { name: "bitrix24-mcp-server", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      return await callTool(request.params.name, request.params.arguments || {});
    } catch (err) {
      return { content: [{ type: "text", text: `خطا: ${err.message}` }], isError: true };
    }
  });
  return server;
}

const app = express();
app.use(express.json());

// اجازه‌ی دسترسی از هر مبدا (لازم برای اینکه claude.ai بتونه به این سرور وصل بشه)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, mcp-session-id");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// یه اندپوینت ساده برای چک‌کردن اینکه سرور بالاست (Render هم از همین برای Health Check استفاده می‌کنه)
app.get("/", (req, res) => res.send("Bitrix24 MCP server is running."));

// بعضی کلاینت‌ها قبل از POST، یه GET یا DELETE روی /mcp می‌فرستن؛
// چون سرور ما Stateless و بدون استریم SSE هست، این‌ها رو با 405 (نه 404) جواب می‌دیم
app.get("/mcp", (req, res) => res.sendStatus(405));
app.delete("/mcp", (req, res) => res.sendStatus(405));

app.post("/mcp", async (req, res) => {
  // اگه API_KEY تنظیم شده باشه، درخواست باید هدر Authorization: Bearer <کلید> رو داشته باشه
  if (API_KEY) {
    const auth = req.headers["authorization"];
    if (auth !== `Bearer ${API_KEY}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  const server = buildServer();
  res.on("close", () => {
    transport.close();
    server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.listen(PORT, () => {
  console.log(`Bitrix24 MCP HTTP server روی پورت ${PORT} در حال اجراست...`);
});
