# WebEx Bridge for Claude Desktop

Part of the [Claude Bridge](../../README.md) project - bringing all your tools into Claude.

> 📖 **[Why You Need This Tool - Read This First!](WHY_THIS_TOOL.md)** - See how this tool can save you 200+ hours per year and transform your productivity.

## What is this?

This is an **MCP (Model Context Protocol) server** that bridges Claude Desktop with your WebEx Teams messages. It enables you to manage WebEx communications directly from Claude without switching applications.

### The Problem
You're working in Claude, but you need to constantly switch to WebEx to:
- Check messages across 100+ spaces
- Find urgent messages
- Reply to important communications
- Then switch back to Claude

### The Solution
With this MCP server, you stay in Claude and simply say things like:
- "Check my WebEx messages"
- "Show me urgent messages only"
- "Reply to John saying I'll review this shortly"
- "Show me recent messages in the SRE room"

Claude uses this MCP server to connect to WebEx, analyze messages, and send replies - all without leaving Claude Desktop.

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

### New Priority-First Response Format

When you say "Check my WebEx messages", you now get:

1. **🚨 URGENT MESSAGES** (if any) - Messages with `URGENCY_KEYWORDS` that need immediate attention
2. **📋 ROOM SUMMARIES** - Non-urgent messages organized by room with topics
3. **📊 GUIDANCE** - Clear next steps on what to handle first

## MCP Tools Available

The server provides these tools to Claude:

1. **`webex_get_message_summaries`** - Get summaries of all messages from all rooms
   - Shows sender names, message counts, and detected topics
   - Returns room IDs for easy replies
   
2. **`webex_get_urgent_messages`** - Fetch only urgent/priority messages
   - Filters based on keywords and sender priority
   
3. **`webex_send_reply`** - Send a message to any room
   - Supports direct messages and group spaces
   
4. **`webex_get_room_context`** - Get recent conversation history
   - Retrieves specified number of messages from a room
   
5. **`webex_mark_handled`** - Mark messages as handled
   - Prevents duplicate responses

6. **`webex_get_rooms_info`** - Get comprehensive room visibility and statistics
   - Shows which rooms are accessible vs inaccessible
   - Displays room metadata (member counts, activity, types)
   - Identifies rooms with urgent content using `URGENCY_KEYWORDS`
   - Provides insights on most active rooms

7. **`webex_diagnose_personal_token`** - **🔧 Essential for troubleshooting access issues**
   - Diagnoses personal token configuration and permissions
   - Provides step-by-step fix instructions for access issues
   - Tests personal token validity and expiration
   - Guides through access troubleshooting

## 🚀 **ORGANIZATION POLICY BYPASS TOOLS**

**NEW**: Advanced tools to bypass enterprise WebEx restrictions

8. **`webex_detect_best_mode`** - **🔍 AUTO-FIX: Bypass Detection**
   - Auto-detects best method to bypass organization restrictions
   - Tests Bot, Integration, and Webhook access modes
   - Provides confidence ratings and next-step recommendations

9. **`webex_setup_integration`** - **🔧 ORGANIZATION FIX: OAuth Integration**
   - Setup WebEx Integration (OAuth) to bypass bot message reading restrictions
   - Uses USER permissions instead of bot permissions
   - Generates OAuth authorization URLs for user consent

10. **`webex_complete_oauth`** - **✅ Complete OAuth Authorization**
    - Completes WebEx Integration OAuth flow with authorization code
    - Exchanges code for access/refresh tokens
    - Enables message reading via user authorization

11. **`webex_setup_webhooks`** - **⚡ REAL-TIME FIX: Webhook Notifications**
    - Setup real-time WebEx webhooks for message notifications
    - Bypasses polling restrictions with push notifications
    - Configures webhook endpoints for immediate message delivery

12. **`webex_get_messages_hybrid`** - **🎯 PRIMARY BYPASS TOOL**
    - Get WebEx messages using best available method (AUTO mode)
    - Automatically detects and uses: Integration → Webhook → Bot
    - **Bypasses organization restrictions automatically**
    - Supports manual mode selection (BOT/INTEGRATION/WEBHOOK/HYBRID)

## Configuration Options

### Required
- `WEBEX_PERSONAL_TOKEN` - Your WebEx personal access token

### Optional (in .env file or Claude config)
- `URGENCY_KEYWORDS` - Comma-separated keywords that indicate urgency
  - Default: `urgent,asap,critical,production,down,incident,emergency`
- `HIGH_PRIORITY_SENDERS` - Email addresses of important people
  - Example: `manager@company.com,oncall@company.com`

## How Urgency Detection Works

The system uses a **priority-first architecture** where `URGENCY_KEYWORDS` get absolute priority:

### Priority Levels:
1. **🚨 URGENT (Hard Filter)**: Messages containing any `URGENCY_KEYWORDS` are **immediately flagged as urgent**
   - Keywords: `urgent`, `asap`, `critical`, `production`, `down`, `incident`, `emergency`, `help`, `broken`, `failed`, `error`, `outage`, `sev1`, `p1`
   - **No scoring** - if keywords are found, message is urgent, period
2. **⚡ HIGH PRIORITY**: Messages from `HIGH_PRIORITY_SENDERS` 
3. **📢 OFF-HOURS MENTIONS**: Direct mentions during nights/weekends

### Critical Emergency Detection:
Messages with `production`, `down`, `outage`, `sev1`, `p1`, `critical`, `emergency` are flagged as `requiresImmediate: true`

## Architecture Overview

```
Claude Desktop → MCP Protocol → WebEx MCP Server → WebEx API
                                       ↓
                            Services & Message Analysis
```

### Components

- **MCP Server** (`src/index.ts`): Handles communication with Claude Desktop
- **WebEx Service** (`src/services/WebexService.ts`): Manages WebEx API calls
- **Urgency Detector** (`src/services/UrgencyDetector.ts`): Analyzes message priority
- **MCP Tools** (`src/utils/mcpTools.ts`): Defines tools available to Claude

### Communication
- **Claude ↔ MCP Server**: JSON-RPC over STDIO (local only)
- **MCP Server ↔ WebEx**: HTTPS REST API with Bearer token auth

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
│   ├── index.ts              # MCP server entry point
│   ├── services/            
│   │   ├── WebexService.ts   # WebEx API client
│   │   └── UrgencyDetector.ts # Message prioritization
│   ├── types/
│   │   └── webex.ts          # TypeScript definitions
│   └── utils/
│       └── mcpTools.ts       # Tool definitions for Claude
├── dist/                     # Compiled JavaScript
├── .env                      # Your configuration
└── package.json              # Dependencies
```

## Key Design Decisions

1. **MCP Protocol**: Native integration with Claude Desktop
2. **No Webhooks**: Simplified local-only operation
3. **No Auto-Response**: Claude handles all responses
4. **STDIO Transport**: Secure local communication
5. **Stateless Operation**: No message persistence
6. **Pull-based Model**: Claude requests data when needed

## See Also

- [Main Claude Bridge Documentation](../../README.md)
- [MCP Protocol Documentation](https://modelcontextprotocol.io)

## License

MIT - Part of the Claude Bridge project