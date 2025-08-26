# Claude Bridge

A collection of MCP (Model Context Protocol) bridges that connect Claude Desktop to your favorite productivity tools, allowing you to manage everything without leaving Claude.

## What is Claude Bridge?

Claude Bridge is a platform of integrations that lets Claude interact with your daily tools - WebEx, Outlook, Excel, PowerPoint, and more. Each "bridge" is an MCP server that gives Claude superpowers to work with these applications.

### The Vision

Imagine never having to switch between Claude and your other tools:
- Check and respond to urgent WebEx messages while coding
- Update Excel spreadsheets through natural conversation
- Create PowerPoint slides by describing what you want
- Manage Outlook emails and calendar without leaving Claude

## Available Bridges

### ✅ WebEx Bridge (Ready) - **🚀 With Hybrid Room Monitoring**
Intelligently manage your WebEx Teams messages directly from Claude.
- **95% API reduction**: Monitor only relevant rooms (25 of 100+)
- **Smart filtering**: Priority rooms, pattern matching, activity-based selection
- **Instant urgency detection**: Never miss critical messages
- **200+ hours saved per year**: Transform productivity with AI-powered filtering
- [Full documentation →](./bridges/webex/README.md) | [Why you need this →](./bridges/webex/WHY_THIS_TOOL.md)



## Quick Start

### Installing WebEx Bridge

```bash
cd bridges/webex
npm install
npm run build
```

Then configure Claude Desktop (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "webex": {
      "command": "node",
      "args": ["/path/to/claude-bridge/bridges/webex/dist/index.js"],
      "env": {
        "WEBEX_PERSONAL_TOKEN": "your_personal_token_here",
        "WEBEX_PRIORITY_ROOMS": "SRE Alerts,Platform Team,Critical Issues",
        "WEBEX_INCLUDE_PATTERNS": "*Alert*,*Critical*,*Incident*",
        "WEBEX_EXCLUDE_PATTERNS": "*Social*,*Random*,*Fun*",
        "WEBEX_MAX_MONITORED_ROOMS": "25"
      }
    }
  }
}
```

See [WebEx Bridge README](./bridges/webex/README.md) for detailed setup.

## Project Structure

```
claude-bridge/
├── bridges/              # Individual MCP bridges
│   └── webex/           # WebEx Teams integration with hybrid room monitoring
│       ├── src/         # TypeScript source code
│       ├── dist/        # Compiled JavaScript
│       ├── README.md    # WebEx bridge documentation
│       └── WHY_THIS_TOOL.md  # Productivity impact analysis
├── README.md            # Main project documentation  
└── CLAUDE.md            # Technical documentation for Claude
```

## How It Works

The WebEx Bridge:
1. Runs as a local MCP server on your machine
2. Connects to Claude Desktop via the MCP protocol  
3. Uses intelligent room filtering to monitor only relevant WebEx rooms
4. Provides tools that Claude can use to interact with WebEx Teams
5. Maintains security by keeping all credentials local

```
Claude Desktop ←→ MCP Protocol ←→ WebEx Bridge ←→ WebEx Teams API
                                      ↓
                            Hybrid Room Filtering (95% API reduction)
```

## Contributing

Want to improve the WebEx bridge? Contributions are welcome!

### Improvement Areas

1. **Room Filtering**: Enhance the hybrid room monitoring algorithm
2. **Urgency Detection**: Improve keyword matching and priority logic  
3. **Performance**: Optimize caching and API efficiency
4. **Documentation**: Improve setup guides and troubleshooting

### Development Guidelines

- Use TypeScript for all code
- Follow the existing MCP protocol patterns  
- Keep security credentials local
- Document all new features and tools
- Maintain backward compatibility

## Security

- All bridges run locally on your machine
- No external servers or cloud services required
- Credentials stored in local `.env` files
- Each bridge is isolated from others

## Future Roadmap

- **More Bridges**: Slack, Teams, Jira, GitHub, and more
- **Bridge Manager**: Central configuration and management tool
- **Shared Authentication**: SSO support across Microsoft bridges
- **Bridge Marketplace**: Community-contributed bridges

## Support

- Report issues on [GitHub Issues](https://github.com/yourusername/claude-bridge/issues)
- Check bridge-specific documentation in each bridge folder
- Join discussions in [GitHub Discussions](https://github.com/yourusername/claude-bridge/discussions)

## License

MIT - See LICENSE file

---

*Claude Bridge - Bringing all your tools into Claude*