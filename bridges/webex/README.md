# WebEx Bridge for Claude Desktop

Part of the [Claude Bridge](../../README.md) project - bringing all your tools into Claude.

> 📖 **[Why You Need This Tool - Read This First!](WHY_THIS_TOOL.md)** - See how this tool can save you 200+ hours per year and transform your productivity.

## What is this?

This is an **MCP (Model Context Protocol) server** that bridges Claude Desktop with your WebEx Teams messages. It enables you to manage WebEx communications directly from Claude without switching applications.

**🚀 NEW: Hybrid Room Monitoring System** - Intelligently monitors only your most relevant rooms instead of scanning 100+ rooms, delivering 95% API reduction and massive productivity gains.

### Why Use This?
Manage WebEx Teams directly from Claude Desktop without switching applications. Simply ask Claude to check messages, send replies, or analyze urgent communications - all while staying in your Claude workflow.

## Quick Start

### Prerequisites

- Node.js 18 or higher
- Claude Desktop app
- WebEx Personal Access Token (get it from [WebEx Developer Portal](https://developer.webex.com/docs/getting-started))

### Setup in 5 Minutes

1. **Navigate to the WebEx bridge:**
```bash
cd claude-bridge/bridges/webex
npm install
```

2. **Configure your personal token:**
```bash
cp .env.example .env
# Edit .env and add your WEBEX_PERSONAL_TOKEN
```

3. **Build the project:**
```bash
npm run build
```

4. **Configure Claude Desktop:**

Edit Claude Desktop configuration file:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "webex": {
      "command": "node",
      "args": ["/path/to/claude-bridge/bridges/webex/dist/index.js"],
      "env": {
        "WEBEX_PERSONAL_TOKEN": "YOUR_ACTUAL_TOKEN_HERE",
        "URGENCY_KEYWORDS": "urgent,asap,critical,production,down,incident,emergency",
        "HIGH_PRIORITY_SENDERS": "boss@company.com,manager@company.com"
      }
    }
  }
}
```

**Note**: You can either use `.env` file OR specify the token in Claude's config. If using Claude's config, replace `YOUR_ACTUAL_TOKEN_HERE` with your actual token.

5. **Restart Claude Desktop** completely (Cmd+Q on Mac, then reopen)

That's it! Now you can manage WebEx from Claude Desktop.

## Usage Examples

Once configured in Claude Desktop, chat naturally with Claude:

- **📊 Priority view**: "Check my WebEx messages" → Shows urgent messages first, then summaries of everything else
- **🚨 Urgent only**: "Show me only urgent WebEx messages" → Just the critical stuff
- **💬 Send replies**: "Reply to Sarah saying I'll handle this after my meeting"
- **📜 Get context**: "Show me the last 10 messages in the Platform team room"
- **✅ Mark handled**: "Mark that message as handled"
- **🏠 Room visibility**: "Show me my WebEx rooms info" → Complete room access overview and statistics
- **🔧 Check access**: "Diagnose my WebEx personal token" → Essential for troubleshooting access issues

### Priority-First Messages
Urgent messages (containing keywords like `urgent`, `critical`, `production down`) are shown first, followed by room summaries organized by topic.

## Available Tools

### Core Message Management
1. **`webex_get_message_summaries`** - Priority-first message overview
2. **`webex_get_urgent_messages`** - Urgent messages only
3. **`webex_send_reply`** - Send messages to any room
4. **`webex_get_room_context`** - Get conversation history
5. **`webex_mark_handled`** - Mark messages as handled

### Room & Diagnostics
6. **`webex_get_rooms_info`** - Room access and statistics
7. **`webex_diagnose_personal_token`** - Token troubleshooting

### Hybrid Room Monitoring
8. **`webex_get_room_monitoring_stats`** - Room filtering insights
9. **`webex_refresh_room_filter`** - Refresh room cache


## Configuration Options

### Required
- `WEBEX_PERSONAL_TOKEN` - Your WebEx personal access token

### Hybrid Room Monitoring
Intelligently monitors only relevant rooms (95% API reduction):

- `WEBEX_PRIORITY_ROOMS` - Always monitor these rooms: `"SRE Alerts,Platform Team"`
- `WEBEX_INCLUDE_PATTERNS` - Include patterns: `"*Alert*,*Critical*,*Incident*"`
- `WEBEX_EXCLUDE_PATTERNS` - Exclude patterns: `"*Social*,*Random*,*Fun*"`
- `WEBEX_MAX_MONITORED_ROOMS` - Room limit (default: 25)
- `WEBEX_CACHE_ROOM_LIST_MINUTES` - Cache duration (default: 30)

### Urgency Detection
- `URGENCY_KEYWORDS` - Comma-separated keywords that indicate urgency
  - Default: `urgent,asap,critical,production,down,incident,emergency`
- `HIGH_PRIORITY_SENDERS` - Email addresses of important people
  - Example: `manager@company.com,oncall@company.com`

## Urgency Detection
Messages containing `URGENCY_KEYWORDS` (`urgent`, `critical`, `production down`, `incident`, `emergency`) are immediately flagged as urgent. Messages from `HIGH_PRIORITY_SENDERS` also get priority treatment.

## Architecture Overview

```
Claude Desktop → MCP Protocol → WebEx MCP Server → WebEx API
                                       ↓
                            Services & Message Analysis
```

### Components
- **MCP Server**: Handles Claude Desktop communication
- **WebEx Service**: WebEx API integration with hybrid room filtering
- **Urgency Detector**: Message priority analysis
- **Room Filter Service**: Intelligent room monitoring

## Troubleshooting

### "Personal token invalid"
- Make sure your personal token in `.env` or Claude config is correct
- Check that your token hasn't expired (12-hour lifespan)
- Generate a new token from developer.webex.com if needed

### "No messages appearing"
- Verify you have access to the WebEx spaces in your account
- Check if messages match your configured timeframe
- For non-urgent messages, use "Check my WebEx messages" (not "urgent")
- Ensure personal token hasn't expired

### "403 Forbidden errors (Rare with Personal Token)" 
- **Common Issue**: Personal token expired or invalid
- **Quick Fix**: Use `webex_diagnose_personal_token` tool for step-by-step solutions
- **Manual Fix**: Generate new personal token from developer.webex.com
- **Verification**: Personal tokens inherit your user permissions
- **Note**: Personal tokens should have access to all rooms you can access

### "Claude doesn't recognize WebEx commands"
- Restart Claude Desktop completely after configuration
- Make sure the path in `claude_desktop_config.json` is absolute
- Check that `npm run build` completed successfully

### Testing the server
```bash
node test-server.js  # Verify the server can start and connect to WebEx
```

## Security

- ✅ Runs entirely on your local machine
- ✅ No external servers or webhooks
- ✅ Personal token stays in local `.env` file or Claude config
- ✅ All communication with WebEx is over HTTPS
- ✅ No message persistence or logging

## Development

```bash
npm run dev    # Development mode with hot reload
npm run build  # Build for production
npm run lint   # Check code quality
npm test       # Run tests
```

### Project Structure

```
webex-bridge/
├── src/
│   ├── index.ts                    # MCP server entry point
│   ├── services/            
│   │   ├── WebexService.ts         # WebEx API client with hybrid filtering
│   │   ├── UrgencyDetector.ts      # Message prioritization
│   │   └── RoomFilterService.ts    # Intelligent room monitoring
│   └── utils/
│       └── mcpTools.ts             # Tool definitions for Claude
├── dist/                           # Compiled JavaScript
└── .env                            # Configuration
```

## Design Principles
- **Local-only operation**: No external servers or webhooks
- **Personal token authentication**: Uses your WebEx access
- **Hybrid room monitoring**: 95% API reduction through intelligent filtering
- **Priority-first messaging**: Urgent messages shown first

## See Also

- [Main Claude Bridge Documentation](../../README.md)
- [MCP Protocol Documentation](https://modelcontextprotocol.io)

## License

MIT - Part of the Claude Bridge project