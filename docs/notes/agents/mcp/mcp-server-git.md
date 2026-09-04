# mcp-server-git

https://github.com/modelcontextprotocol/servers/tree/main/src/git

## Installation

VS Code (`.vscode/mcp.json`) uses the `servers` key:

```json
{
  "servers": {
    "git": {
      "command": "uvx",
      "args": ["mcp-server-git"]
    }
  }
}
```

Claude Desktop / Claude Code use `mcpServers` instead:

```json
{
  "mcpServers": {
    "git": {
      "command": "uvx",
      "args": ["mcp-server-git"]
    }
  }
}
```
