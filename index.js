#!/usr/bin/env node
/**
 * Bitrix24 MCP Server (نسخه‌ی لوکال - Stdio)
 * برای Claude Desktop. برای دیپلوی آنلاین از server-http.js استفاده کنید.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { makeBitrixTools } from "./bitrix-tools.js";

const WEBHOOK_URL = process.env.BITRIX24_WEBHOOK_URL;
if (!WEBHOOK_URL) {
  console.error("خطا: متغیر محیطی BITRIX24_WEBHOOK_URL تنظیم نشده است.");
  process.exit(1);
}

const { TOOLS, callTool } = makeBitrixTools(WEBHOOK_URL);

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

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Bitrix24 MCP server (stdio) در حال اجراست...");
