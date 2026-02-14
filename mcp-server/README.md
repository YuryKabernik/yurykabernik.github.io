# Enterprise MCP Server

A test MCP (Model Context Protocol) server designed to aggregate and serve rules, prompts, and instructions for microservice and microfrontend enterprise applications.

## Overview

This MCP server provides a centralized way to access:
- **Rules**: Best practices and guidelines for microservices and microfrontends
- **Prompts**: Development prompts and architectural guidance
- **Instructions**: Step-by-step instructions for common tasks

## Features

- ✅ Aggregate microservice architecture rules
- ✅ Aggregate microfrontend architecture rules
- ✅ Provide development prompts and best practices
- ✅ Serve step-by-step instructions for common tasks
- ✅ Category-based filtering (architecture, security, deployment, testing)
- ✅ MCP protocol compliant with tools and resources
- ✅ Easy to extend with new rules, prompts, and instructions

## Installation

```bash
cd mcp-server
npm install
```

## Usage

### Running the Server

```bash
npm start
```

For development with auto-reload:

```bash
npm run dev
```

### Available Tools

The MCP server exposes the following tools:

1. **get-microservice-rules** - Get all rules for microservice development
   - Optional parameter: `category` (architecture, security, deployment, testing)

2. **get-microfrontend-rules** - Get all rules for microfrontend development
   - Optional parameter: `category` (architecture, security, deployment, testing)

3. **get-prompts** - Get development prompts and best practices
   - Optional parameter: `type` (microservice, microfrontend, general)

4. **get-instructions** - Get step-by-step instructions for common tasks
   - Optional parameter: `task` (setup, deployment, testing, debugging)

### Available Resources

The server provides access to resources via URIs:

- `enterprise://rules/microservices` - All microservice rules
- `enterprise://rules/microfrontends` - All microfrontend rules
- `enterprise://prompts/all` - All development prompts
- `enterprise://instructions/all` - All task instructions

## Configuration

Edit `config/server-config.json` to customize:
- Resource paths
- Categories
- Feature flags (caching, validation, auto-reload)

## Adding New Content

### Adding Rules

Edit `rules/rules.json` and add new rule objects:

```json
{
  "id": "ms-arch-003",
  "type": "microservice",
  "category": "architecture",
  "title": "Rule Title",
  "description": "Brief description",
  "priority": "high",
  "details": "Detailed explanation"
}
```

### Adding Prompts

Edit `prompts/prompts.json` and add new prompt objects:

```json
{
  "id": "prompt-ms-003",
  "type": "microservice",
  "title": "Prompt Title",
  "prompt": "Prompt content with guidance",
  "tags": ["tag1", "tag2"]
}
```

### Adding Instructions

Edit `instructions/instructions.json` and add new instruction objects:

```json
{
  "id": "inst-task-001",
  "task": "task-type",
  "title": "Instruction Title",
  "steps": [
    {
      "step": 1,
      "action": "Action name",
      "description": "Detailed description"
    }
  ]
}
```

## Project Structure

```
mcp-server/
├── src/
│   ├── index.js              # Main MCP server implementation
│   ├── rules-loader.js       # Rules loading module
│   ├── prompts-loader.js     # Prompts loading module
│   └── instructions-loader.js # Instructions loading module
├── rules/
│   └── rules.json            # Rules database
├── prompts/
│   └── prompts.json          # Prompts database
├── instructions/
│   └── instructions.json     # Instructions database
├── config/
│   └── server-config.json    # Server configuration
├── package.json
└── README.md
```

## Integration with MCP Clients

This server can be integrated with any MCP-compatible client (like Claude Desktop, IDEs with MCP support, etc.).

### Example MCP Client Configuration

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "enterprise": {
      "command": "node",
      "args": ["/path/to/mcp-server/src/index.js"]
    }
  }
}
```

## Use Cases

- **Development Guidance**: Get real-time access to enterprise architecture rules while coding
- **Code Reviews**: Reference standardized rules and best practices
- **Onboarding**: Provide new team members with structured instructions
- **Architecture Decisions**: Access prompts for making architectural decisions
- **Troubleshooting**: Follow step-by-step debugging instructions

## Extending the Server

The server is designed to be easily extensible:

1. Add new tool handlers in `src/index.js`
2. Create new resource loaders following the pattern in `src/*-loader.js`
3. Add new resource URIs and schemas
4. Extend the JSON data files with new content

## Requirements

- Node.js >= 18.0.0
- npm or yarn

## License

MIT

## Contributing

Feel free to extend this server with additional rules, prompts, and instructions for your enterprise needs.
