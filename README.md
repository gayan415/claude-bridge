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

### 🚧 Outlook Bridge (Coming Soon)
- Read and compose emails
- Manage calendar appointments
- Search contacts
- Set reminders

### 🚧 Excel Bridge (Planned)
- Read and update spreadsheets
- Run formulas and analysis
- Create charts and pivot tables
- Export data in various formats


## Quick Start

Each bridge is installed separately. Start with the bridge you need:

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
      "args": ["/path/to/claude-bridge/bridges/webex/dist/index.js"]
    }
  }
}
```

See [WebEx Bridge README](./bridges/webex/README.md) for detailed setup.

## Project Structure

```
claude-bridge/
├── bridges/              # Individual MCP bridges
│   ├── webex/           # WebEx Teams integration
│   ├── outlook/         # Outlook integration (coming soon)
│   ├── excel/           # Excel integration (planned)
│   └── powerpoint/      # PowerPoint integration (planned)
├── shared/              # Shared utilities across bridges
└── docs/                # Additional documentation
```

## How It Works

Each bridge:
1. Runs as a local MCP server on your machine
2. Connects to Claude Desktop via the MCP protocol
3. Provides tools that Claude can use to interact with the target application
4. Maintains security by keeping all credentials local

```
Claude Desktop ←→ MCP Protocol ←→ Bridge Server ←→ Your Application (WebEx, Outlook, etc.)
```

## Contributing

Want to add a new bridge or improve existing ones? Contributions are welcome!

### Adding a New Bridge

1. Create a new directory under `bridges/`
2. Implement the MCP server following the WebEx bridge pattern
3. Add documentation
4. Submit a pull request

### Bridge Development Guidelines

- Each bridge should be self-contained
- Use TypeScript for consistency
- Follow the MCP protocol standards
- Keep security credentials local
- Document all available tools

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