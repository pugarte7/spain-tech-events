#!/usr/bin/env node
// The MCP server over stdio, for a local agent: the same `respond` as /mcp.
//     node scripts/mcp-stdio.mjs [events.json or URL]
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { respond } from "../api/mcp.js";

const from = process.argv[2] ?? new URL("../data/events.json", import.meta.url).pathname;
const index = /^https?:/.test(from) ? await (await fetch(from)).json() : JSON.parse(readFileSync(from, "utf8"));
for await (const line of createInterface({ input: process.stdin })) {
  if (!line.trim()) continue;
  let answer;
  try { answer = await respond(index, JSON.parse(line)); }
  catch { answer = { jsonrpc: "2.0", id: null, error: { code: -32700, message: "parse error" } }; }
  if (answer) process.stdout.write(`${JSON.stringify(answer)}\n`);
}
