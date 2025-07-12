import OpenAI from "openai";
import { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import readline from "readline/promises";
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
  const mcpClient = new MCPClient();

  try {
    await mcpClient.connectToServers(servers);
    await mcpClient.chatLoop();
  } finally {
    await mcpClient.cleanup();
    process.exit(0);
  }
}

interface ServerConfig {
  name: string;
  description: string;
  transport: {
    type: "stdio" | "http" | "tcp" | "websocket";
    command?: string;
    args?: string[];
    baseUrl?: string;
    headers?: Record<string, string>;
  };
  timeout?: number;
}

class MCPClient {
  private mcp: Client;
  private openai: OpenAI;
  private allTools: ChatCompletionTool[] = [];

  constructor() {
    this.openai = new OpenAI({
      apiKey: OPEN_AI_API_KEY,
    });
    this.mcp = new Client({ name: "mcp-client-cli", version: "1.0.0"});
  }

  async connectToServers(servers: ServerConfig[]) {
    for (const server of servers) {
      await this.connectToServer(server)
    }

    try {
      const toolsResult = await this.mcp.listTools();
      this.allTools = toolsResult.tools.map(tool => ({
          type: "function",
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema,
          }
      }));
        
      console.log(
        "Connected to servers with tools:",
        this.allTools.map(name => name),
      );
    } catch (e) {
      console.log("Failed to list tools of MCP servers: ", e);
      throw e;
    }
    
  }
  
  async connectToServer(server: ServerConfig) {
    try {
      let transport: Transport;

      if (server.transport.type === "http") {
        transport = new StreamableHTTPClientTransport(
          new URL(server.transport.baseUrl || "")
        );

        console.log("Created transport with base url: " + new URL(server.transport.baseUrl || ""));
      }
      else if (server.transport.type === "stdio") {

        transport = new StdioClientTransport({
          command: server.transport.command || "",
          args: server.transport.args,
        });

        console.log("Created transport with command: " + server.transport.command + " and args: " + server.transport.args?.join(" "));
      }
      else {
        throw new Error(`Transport for type ${server.transport.type} is not implemented.`)
      }
      
      await this.mcp.connect(transport, { timeout: server.timeout || 60000 });
    } catch (e) {
      console.log("Failed to connect to MCP server: ", e);
      throw e;
    }
  }

  async processQuery(query: string) {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "user",
        content: query,
      }
    ];

    OpenAI.Chat.Completions.Messages
    const response = await this.openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages,
      tools: this.allTools,
      tool_choice: "auto",
    });

    const finalText: string[] = [];
    
    const toolCalls = response.choices[0].message.tool_calls;

    if (toolCalls && toolCalls.length > 0){
      for (const toolCall of toolCalls) {
        const toolName = toolCall.function.name;
        const args = JSON.parse(toolCall.function.arguments || "{}");

        console.log("Calling tool: " + JSON.stringify(toolCall));

        const result = await this.mcp.callTool({
          name: toolName,
          arguments: args,
        });

        console.log("Tool result: " + JSON.stringify(result.content));

        messages.push({
          role: "system",
          content: "Use the provided tool response to generate a final answer for the user. Do not ignore it.",
        });

        // Add assistant's tool call
        messages.push({
          role: "assistant",
          content: null,
          tool_calls: [toolCall]
        });

        // Add tool result
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result.content)
        });

        // Call again with tool result
        const secondResponse = await this.openai.chat.completions.create({
          model: "gpt-4.1-mini",
          messages
        });

        const reply = secondResponse.choices[0].message.content || "";
        finalText.push(reply);
      }
    } else {
      finalText.push(response.choices[0].message.content || "");
    }

    return finalText.join("\n");
  }

  async chatLoop() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    try {
      console.log("\nMCP Client Started!");
      console.log("Type your queries or 'quit' to exit.");

      while (true) {
        const message = await rl.question("\nQuery: ");
        if (message.toLowerCase() === "quit") {
          break;
        }
        const response = await this.processQuery(message);
        console.log("\n" + response);
      }
    } catch (e) {
      console.log("Failed to processQuery on AI agent: ", e);
      throw e;
    } finally {
      rl.close();
    }
  }

  async cleanup() {
    await this.mcp.close();
  }
};

main();
