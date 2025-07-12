import { MCPClient, ServerConfig } from "./src/core/MCPClient.js";
import dotenv from "dotenv";
import { readFileSync } from 'fs';
import { join } from 'path';

dotenv.config();

/*
    server structure:
    {
        "name": string                    // Unique identifier for the server
        "description": string             // Human-readable description of server capabilities
        "transport": {
            "type": "stdio" | "tcp" | "websocket" | "http"
            
            - For stdio transport:
            "command": string             // Command to execute (e.g., "npx", "node", "python")
            "args": string[]              // Array of command arguments
            
            - For tcp transport:
            "host": string                // Hostname or IP address
            "port": number                // Port number
            
            - For websocket transport:
            "url": string                 // WebSocket URL (e.g., "ws://localhost:3000")

            - For http transport:
            "baseUrl": string
        }
        "timeout": number                // Optional: Connection timeout in milliseconds
    }
*/
const configPath = join(process.cwd(), 'config', 'server-data.json');
const configData = readFileSync(configPath, 'utf8');
const serverData = JSON.parse(configData);
const servers: ServerConfig[] = serverData["mcp-servers"];

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const OPEN_AI_API_KEY = process.env.OPEN_AI_API_KEY;

if (!ANTHROPIC_API_KEY) {
  throw new Error("ANTHROPIC_API_KEY is not set");
}

if (!OPEN_AI_API_KEY) {
  throw new Error("OPEN_AI_API_KEY is not set");
}

async function main() {
  const mcpClient = new MCPClient(OPEN_AI_API_KEY || "");

  try {
    await mcpClient.connectToServers(servers);
    await mcpClient.chatLoop();
  } finally {
    await mcpClient.cleanup();
    process.exit(0);
  }
}





main();
