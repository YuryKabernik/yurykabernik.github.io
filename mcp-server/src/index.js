#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { loadRules } from "./rules-loader.js";
import { loadPrompts } from "./prompts-loader.js";
import { loadInstructions } from "./instructions-loader.js";

class EnterpriseMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: "enterprise-mcp-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    this.rules = [];
    this.prompts = [];
    this.instructions = [];

    this.setupHandlers();
  }

  async initialize() {
    // Load all resources
    this.rules = await loadRules();
    this.prompts = await loadPrompts();
    this.instructions = await loadInstructions();

    console.error("MCP Server initialized with:");
    console.error(`- ${this.rules.length} rules`);
    console.error(`- ${this.prompts.length} prompts`);
    console.error(`- ${this.instructions.length} instructions`);
  }

  setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "get-microservice-rules",
          description: "Get all rules for microservice development",
          inputSchema: {
            type: "object",
            properties: {
              category: {
                type: "string",
                description: "Optional category filter (architecture, security, deployment, testing)",
              },
            },
          },
        },
        {
          name: "get-microfrontend-rules",
          description: "Get all rules for microfrontend development",
          inputSchema: {
            type: "object",
            properties: {
              category: {
                type: "string",
                description: "Optional category filter (architecture, security, deployment, testing)",
              },
            },
          },
        },
        {
          name: "get-prompts",
          description: "Get development prompts and best practices",
          inputSchema: {
            type: "object",
            properties: {
              type: {
                type: "string",
                description: "Type of prompts (microservice, microfrontend, general)",
              },
            },
          },
        },
        {
          name: "get-instructions",
          description: "Get step-by-step instructions for common tasks",
          inputSchema: {
            type: "object",
            properties: {
              task: {
                type: "string",
                description: "Task type (setup, deployment, testing, debugging)",
              },
            },
          },
        },
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case "get-microservice-rules":
          return this.getMicroserviceRules(args?.category);
        case "get-microfrontend-rules":
          return this.getMicrofrontendRules(args?.category);
        case "get-prompts":
          return this.getPrompts(args?.type);
        case "get-instructions":
          return this.getInstructions(args?.task);
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });

    // List available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [
        {
          uri: "enterprise://rules/microservices",
          name: "Microservice Rules",
          description: "All rules for microservice development",
          mimeType: "application/json",
        },
        {
          uri: "enterprise://rules/microfrontends",
          name: "Microfrontend Rules",
          description: "All rules for microfrontend development",
          mimeType: "application/json",
        },
        {
          uri: "enterprise://prompts/all",
          name: "Development Prompts",
          description: "All development prompts and best practices",
          mimeType: "application/json",
        },
        {
          uri: "enterprise://instructions/all",
          name: "Task Instructions",
          description: "Step-by-step instructions for common tasks",
          mimeType: "application/json",
        },
      ],
    }));

    // Read resource content
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;

      switch (uri) {
        case "enterprise://rules/microservices":
          return {
            contents: [
              {
                uri,
                mimeType: "application/json",
                text: JSON.stringify(
                  this.rules.filter((r) => r.type === "microservice"),
                  null,
                  2
                ),
              },
            ],
          };
        case "enterprise://rules/microfrontends":
          return {
            contents: [
              {
                uri,
                mimeType: "application/json",
                text: JSON.stringify(
                  this.rules.filter((r) => r.type === "microfrontend"),
                  null,
                  2
                ),
              },
            ],
          };
        case "enterprise://prompts/all":
          return {
            contents: [
              {
                uri,
                mimeType: "application/json",
                text: JSON.stringify(this.prompts, null, 2),
              },
            ],
          };
        case "enterprise://instructions/all":
          return {
            contents: [
              {
                uri,
                mimeType: "application/json",
                text: JSON.stringify(this.instructions, null, 2),
              },
            ],
          };
        default:
          throw new Error(`Unknown resource: ${uri}`);
      }
    });
  }

  getMicroserviceRules(category) {
    let rules = this.rules.filter((r) => r.type === "microservice");
    if (category) {
      rules = rules.filter((r) => r.category === category);
    }
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(rules, null, 2),
        },
      ],
    };
  }

  getMicrofrontendRules(category) {
    let rules = this.rules.filter((r) => r.type === "microfrontend");
    if (category) {
      rules = rules.filter((r) => r.category === category);
    }
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(rules, null, 2),
        },
      ],
    };
  }

  getPrompts(type) {
    let prompts = this.prompts;
    if (type) {
      prompts = prompts.filter((p) => p.type === type);
    }
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(prompts, null, 2),
        },
      ],
    };
  }

  getInstructions(task) {
    let instructions = this.instructions;
    if (task) {
      instructions = instructions.filter((i) => i.task === task);
    }
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(instructions, null, 2),
        },
      ],
    };
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Enterprise MCP Server running on stdio");
  }
}

// Start the server
const server = new EnterpriseMCPServer();
await server.initialize();
await server.start();
