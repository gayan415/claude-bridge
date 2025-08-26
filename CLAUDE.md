# Claude Instructions for WebEx MCP Server

> 📖 **[Why This Tool Matters - Productivity Impact Analysis](bridges/webex/WHY_THIS_TOOL.md)** - Understand the 200+ hours/year productivity gain and ROI.

## Project Overview
This is a WebEx MCP (Model Context Protocol) server that enables Claude Desktop to interact with WebEx Teams for managing messages directly through Claude.

## Quick Setup
1. Copy `.env.example` to `.env` and add your `WEBEX_PERSONAL_TOKEN`
2. Run `npm install && npm run build`
3. Configure Claude Desktop with the MCP server path
4. Restart Claude Desktop

## Development Commands

### Build & Run
- `npm run build` - Compile TypeScript to JavaScript
- `npm run dev` - Run in development mode with hot reload
- `npm start` - Run the compiled MCP server
- `npm run lint` - Run ESLint code quality checks

## Architecture (Enhanced)
### Core Components
- **Main Entry**: `src/index.ts` - MCP server implementation with hybrid mode support
- **WebEx Service**: `src/services/WebexService.ts` - Main WebEx API integration with diagnostics
- **Urgency Detection**: `src/services/UrgencyDetector.ts` - Message prioritization logic
- **Types**: `src/types/webex.ts` - TypeScript definitions
- **MCP Tools**: `src/utils/mcpTools.ts` - All 12 tool definitions for Claude

### Organization Bypass Components (NEW)
- **Hybrid Service**: `src/services/WebexHybridService.ts` - Multi-mode access coordinator
- **Integration Service**: `src/services/WebexIntegration.ts` - OAuth Integration for bypassing bot restrictions
- **Webhook Service**: `src/services/WebexWebhooks.ts` - Real-time webhook notifications

## Configuration

### Required Configuration
- `WEBEX_PERSONAL_TOKEN` - Your WebEx personal access token

### Basic Optional Configuration  
- `URGENCY_KEYWORDS` - **Hard filter keywords** that immediately flag messages as urgent
  - Default: `urgent,asap,critical,production,down,incident,emergency,help,broken,failed,error,outage,sev1,p1`
- `HIGH_PRIORITY_SENDERS` - Email addresses of priority senders

### Organization Bypass Configuration (Advanced)
- `WEBEX_CLIENT_ID` - WebEx Integration Client ID (for OAuth bypass)
- `WEBEX_CLIENT_SECRET` - WebEx Integration Client Secret (for OAuth bypass)
- `WEBEX_REDIRECT_URI` - OAuth redirect URI (default: http://localhost:3000/callback)
- `WEBEX_ACCESS_TOKEN` - OAuth access token (auto-generated after authorization)
- `WEBEX_REFRESH_TOKEN` - OAuth refresh token (auto-generated after authorization)
- `WEBEX_WEBHOOK_SECRET` - Secret for webhook verification (for real-time notifications)
- `WEBEX_WEBHOOK_URL` - Public URL for webhook delivery (for real-time notifications)

## MCP Tools Available

### **🚀 Organization Policy Bypass Tools (NEW)**
8. `webex_detect_best_mode` - **AUTO-FIX**: Auto-detect best access method to bypass organization restrictions
9. `webex_setup_integration` - **ORGANIZATION FIX**: Setup OAuth Integration to bypass bot restrictions  
10. `webex_complete_oauth` - Complete WebEx Integration OAuth authorization flow
11. `webex_setup_webhooks` - **REAL-TIME FIX**: Setup webhooks for real-time notifications (bypasses polling)
12. `webex_get_messages_hybrid` - **PRIMARY TOOL**: Get messages using best available method (bypasses restrictions)

### **📊 Core Tools**
1. `webex_get_message_summaries` - Priority-first tool: Shows urgent messages first, then summaries
2. `webex_get_urgent_messages` - Fetch only urgent messages (legacy)
3. `webex_send_reply` - Send message replies
4. `webex_get_room_context` - Get conversation context
5. `webex_mark_handled` - Mark messages as handled
6. `webex_get_rooms_info` - Room visibility: Shows accessible/inaccessible rooms and metadata
7. `webex_diagnose_personal_token` - Diagnostics: Essential for troubleshooting access issues

## Key Features
- Local MCP server - no external endpoints or webhooks
- **Priority-first urgency detection** - `URGENCY_KEYWORDS` get absolute priority (hard filter, no scoring)
- Direct WebEx API integration using personal access token
- Secure local operation with no data persistence
- Message summarization with topic extraction
- Unified response format: urgent messages first, then room summaries

## Development Notes
- TypeScript with strict mode enabled
- ESLint configured for code quality
- No external dependencies beyond WebEx API and MCP SDK
- Simplified architecture focused on MCP tool execution

## Usage Examples in Claude Desktop

### Core Message Management
- "Check my WebEx messages" - Uses `webex_get_message_summaries` (priority-first: urgent messages → room summaries)
- "Check only urgent WebEx messages" - Uses `webex_get_urgent_messages` (legacy urgent-only tool)
- "Reply to John saying I'll review this shortly" - Uses `webex_send_reply`
- "Show me the last 10 messages in the SRE room" - Uses `webex_get_room_context`
- "Mark that message as handled" - Uses `webex_mark_handled`

### Diagnostics & Room Management
- "Show me my WebEx rooms info" or "What rooms can I access?" - Uses `webex_get_rooms_info`
- **"Diagnose my WebEx personal token"** or **"Check WebEx access"** - Uses `webex_diagnose_personal_token`

### Organization Policy Bypass (NEW)
- **"Detect best WebEx access mode"** - Uses `webex_detect_best_mode` (auto-identifies bypass method)
- **"Setup WebEx Integration with client_id abc123"** - Uses `webex_setup_integration` (OAuth bypass setup)
- **"Complete OAuth with authorization code xyz789"** - Uses `webex_complete_oauth` (finish OAuth flow)
- **"Setup WebEx webhooks at https://myserver.com/webhook"** - Uses `webex_setup_webhooks` (real-time setup)
- **"Get WebEx messages hybrid"** - Uses `webex_get_messages_hybrid` (PRIMARY bypass tool)

## Priority-First Workflow
The new `webex_get_message_summaries` tool implements a priority-first architecture:

1. **URGENT MESSAGES FIRST** - Any message with `URGENCY_KEYWORDS` is immediately shown at the top
2. **ROOM SUMMARIES SECOND** - Non-urgent messages organized by room with topics
3. **CLEAR GUIDANCE** - User gets explicit next steps on what needs attention first

Messages with keywords like `production`, `down`, `outage`, `sev1`, `p1`, `critical`, `emergency` are flagged as `requiresImmediate: true` for maximum visibility.

## Room Visibility Tool
The `webex_get_rooms_info` tool provides comprehensive insights:

- **Access Overview**: Shows exactly which rooms are accessible vs blocked (403 errors)
- **Room Statistics**: Breaks down by type (group/direct), activity levels, and urgent content detection
- **Detailed Metadata**: Member counts, last activity timestamps, recent message counts
- **Urgent Content Detection**: Identifies rooms containing `URGENCY_KEYWORDS` in recent messages
- **Top Active Rooms**: Shows the most active rooms for prioritizing attention

This tool is essential for understanding your WebEx monitoring scope and troubleshooting access issues.

## 🚀 ORGANIZATION POLICY BYPASS SYSTEM

### **The Problem**
Personal tokens provide full user access but may occasionally face restrictions or expiration issues.

### **The Solution - Multiple Bypass Methods**

#### **Method 1: WebEx Integration (OAuth) - RECOMMENDED**
```
1. "Detect best WebEx access mode" - Auto-identifies if Integration can bypass restrictions
2. "Setup WebEx Integration" - Configures OAuth flow with client_id/client_secret  
3. "Complete OAuth authorization" - Finishes user authorization flow
4. "Get WebEx messages hybrid" - Retrieves messages via OAuth (bypasses bot restrictions)
```

**Why This Works**: Integration uses USER permissions via OAuth, providing an alternative to personal tokens with longer expiration.

#### **Method 2: WebEx Webhooks - Real-Time Alternative**
```
1. "Setup WebEx webhooks" - Configures real-time message notifications
2. "Get WebEx messages hybrid" in WEBHOOK mode - Receives pushed notifications
```

**Why This Works**: Instead of polling for messages, WebEx pushes notifications when events occur (real-time updates).

#### **Method 3: Hybrid Multi-Mode System**
```
1. "Detect best WebEx access mode" - Tests all available methods
2. "Get WebEx messages hybrid" - Automatically uses best working approach
```

**Auto-Detection Logic**:
- If Integration works → Use OAuth (bypasses restrictions)  
- If Webhooks work → Use real-time notifications
- If Bot works → Use normal API
- If nothing works → Provide admin contact guidance

## 🔧 Personal Token Diagnostics & Troubleshooting
The `webex_diagnose_personal_token` tool is **essential for troubleshooting access issues**:

### Common Issues & Solutions:
1. **Invalid Personal Token**
   - **Root Cause**: Expired or malformed personal access token
   - **Fix**: Generate new token from [WebEx Developer Portal](https://developer.webex.com/docs/getting-started)
   - **Token Lifespan**: Personal tokens expire after 12 hours

2. **Access Issues**
   - **Root Cause**: Personal tokens inherit your user permissions
   - **Fix**: Verify you have access to rooms in WebEx Teams app
   - **Required**: Must be logged into WebEx account that generated the token

3. **Organization Restrictions (Rare)**
   - **Root Cause**: Some organizations may restrict personal token usage
   - **Fix**: Contact WebEx administrator or try different account
   - **Alternative**: Use Integration OAuth flow for bypass

### When to Use:
- Rooms showing access errors
- Personal token not working as expected
- Setting up personal token for the first time
- Troubleshooting WebEx API access issues

## Default Behavior
When user asks to "check messages" without specifying "urgent", use `webex_get_message_summaries` to show urgent messages first, then summaries of all other rooms.