# MCP Server Usage Examples

## Quick Start

### 1. Install Dependencies
```bash
cd mcp-server
npm install
```

### 2. Start the Server
```bash
npm start
```

### 3. Run Tests
```bash
npm test
```

## Integration Examples

### Claude Desktop Configuration

Add this to your Claude Desktop MCP configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "enterprise": {
      "command": "node",
      "args": [
        "/absolute/path/to/yurykabernik.github.io/mcp-server/src/index.js"
      ]
    }
  }
}
```

### Example Queries

Once integrated with an MCP client, you can use commands like:

#### Get Microservice Rules
```
Get microservice architecture rules
```

#### Get Microfrontend Security Rules
```
Get microfrontend security rules
```

#### Get Deployment Instructions
```
Get instructions for deployment tasks
```

#### Get Development Prompts
```
Get prompts for microservice development
```

## Available Tools

### 1. get-microservice-rules
Retrieves rules for microservice development.

**Parameters:**
- `category` (optional): Filter by category
  - `architecture`
  - `security`
  - `deployment`
  - `testing`

**Example Request:**
```json
{
  "name": "get-microservice-rules",
  "arguments": {
    "category": "security"
  }
}
```

### 2. get-microfrontend-rules
Retrieves rules for microfrontend development.

**Parameters:**
- `category` (optional): Filter by category
  - `architecture`
  - `security`
  - `deployment`
  - `testing`

**Example Request:**
```json
{
  "name": "get-microfrontend-rules",
  "arguments": {
    "category": "architecture"
  }
}
```

### 3. get-prompts
Retrieves development prompts and best practices.

**Parameters:**
- `type` (optional): Filter by type
  - `microservice`
  - `microfrontend`
  - `general`

**Example Request:**
```json
{
  "name": "get-prompts",
  "arguments": {
    "type": "microservice"
  }
}
```

### 4. get-instructions
Retrieves step-by-step instructions for common tasks.

**Parameters:**
- `task` (optional): Filter by task type
  - `setup`
  - `deployment`
  - `testing`
  - `debugging`

**Example Request:**
```json
{
  "name": "get-instructions",
  "arguments": {
    "task": "deployment"
  }
}
```

## Resource URIs

The server exposes resources that can be accessed directly:

### enterprise://rules/microservices
All microservice rules in JSON format.

### enterprise://rules/microfrontends
All microfrontend rules in JSON format.

### enterprise://prompts/all
All development prompts in JSON format.

### enterprise://instructions/all
All task instructions in JSON format.

## Extending the Server

### Adding New Rules

1. Open `rules/rules.json`
2. Add a new rule object:

```json
{
  "id": "ms-perf-001",
  "type": "microservice",
  "category": "performance",
  "title": "Implement Caching",
  "description": "Use caching to improve performance",
  "priority": "medium",
  "details": "Implement Redis or similar caching for frequently accessed data."
}
```

3. Restart the server

### Adding New Prompts

1. Open `prompts/prompts.json`
2. Add a new prompt object:

```json
{
  "id": "prompt-ms-004",
  "type": "microservice",
  "title": "API Design Considerations",
  "prompt": "When designing APIs, consider...",
  "tags": ["api", "design"]
}
```

3. Restart the server

### Adding New Instructions

1. Open `instructions/instructions.json`
2. Add a new instruction object:

```json
{
  "id": "inst-monitor-001",
  "task": "monitoring",
  "title": "Setting Up Monitoring",
  "steps": [
    {
      "step": 1,
      "action": "Choose monitoring tool",
      "description": "Select Prometheus, Datadog, or New Relic"
    }
  ]
}
```

3. Restart the server

## Troubleshooting

### Server Won't Start
- Ensure Node.js >= 18.0.0 is installed
- Run `npm install` to install dependencies
- Check that all JSON files are valid

### No Data Returned
- Verify JSON files exist in rules/, prompts/, and instructions/ directories
- Check server logs for loading errors
- Ensure JSON files are properly formatted

### Integration Issues
- Verify the absolute path in MCP client configuration
- Restart the MCP client after configuration changes
- Check MCP client logs for connection errors

## Best Practices

1. **Regular Updates**: Keep rules, prompts, and instructions up to date
2. **Version Control**: Track changes to knowledge base with Git
3. **Team Collaboration**: Have team review and approve new rules
4. **Documentation**: Document rationale behind rules and decisions
5. **Testing**: Test server after adding new content

## Support

For issues or questions:
1. Check the README.md for detailed documentation
2. Review the source code in `src/` directory
3. Examine example data in JSON files
4. Create an issue in the repository
