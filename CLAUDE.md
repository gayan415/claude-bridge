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
- **Room Filter Service**: `src/services/RoomFilterService.ts` - **NEW** Hybrid room monitoring with 95% API reduction
- **Urgency Detection**: `src/services/UrgencyDetector.ts` - Message prioritization logic
- **Types**: `src/types/webex.ts` - TypeScript definitions
- **MCP Tools**: `src/utils/mcpTools.ts` - All 9 core tool definitions for Claude


## Configuration

### Required Configuration
- `WEBEX_PERSONAL_TOKEN` - Your WebEx personal access token

### Hybrid Room Monitoring Configuration (NEW) 🚀
Transform productivity with intelligent room filtering - monitor only what matters:

#### Tier 1: Priority Rooms (Always Monitored)
- `WEBEX_PRIORITY_ROOMS` - Comma-separated room names that bypass all filters
  - Example: `"SRE Alerts,Platform Team,Critical Issues"`

#### Tier 2: Pattern-Based Discovery
- `WEBEX_INCLUDE_PATTERNS` - Wildcard patterns for room inclusion
  - Example: `"*Alert*,*Critical*,*Incident*,*Emergency*,*P1*,*Sev1*"`
- `WEBEX_EXCLUDE_PATTERNS` - Wildcard patterns for room exclusion
  - Example: `"*Social*,*Random*,*Fun*,*Coffee*,*Lunch*,*Birthday*"`

#### Tier 3: Activity-Based Intelligence
- `WEBEX_MIN_ACTIVITY_MESSAGES` - Minimum messages required in look-back period (default: 5)
- `WEBEX_MIN_ACTIVITY_DAYS` - Activity look-back period in days (default: 7)
- `WEBEX_SKIP_DIRECT_MESSAGES` - Skip direct message monitoring (default: true)

#### Tier 4: Performance Limits & Caching
- `WEBEX_MAX_MONITORED_ROOMS` - Maximum rooms to monitor (default: 25)
- `WEBEX_CACHE_ROOM_LIST_MINUTES` - Room filtering cache duration (default: 30)

### Urgency Detection Configuration
- `URGENCY_KEYWORDS` - Keywords that immediately flag messages as urgent
  - Default: `urgent,asap,critical,production,down,incident,emergency,help,broken,failed,error,outage,sev1,p1`
- `HIGH_PRIORITY_SENDERS` - Email addresses of priority senders

## MCP Tools Available

### **📊 Core Tools**
1. `webex_get_message_summaries` - Priority-first tool: Shows urgent messages first, then summaries
2. `webex_get_urgent_messages` - Fetch only urgent messages (legacy)
3. `webex_send_reply` - Send message replies
4. `webex_get_room_context` - Get conversation context
5. `webex_mark_handled` - Mark messages as handled
6. `webex_get_rooms_info` - Room visibility: Shows accessible/inaccessible rooms and metadata
7. `webex_diagnose_personal_token` - Diagnostics: Essential for troubleshooting access issues

### **🎯 Hybrid Room Monitoring Tools (NEW)**
8. `webex_get_room_monitoring_stats` - Room filtering insights and configuration
9. `webex_refresh_room_filter` - Force refresh room filtering cache

## Key Features
- **🚀 Hybrid Room Monitoring** - 95% API reduction by monitoring only relevant rooms (25 of 100+)
- **🎯 Intelligent Filtering** - 5-tier pipeline: Priority → Patterns → Activity → Scoring → Limits
- **⚡ Performance Caching** - 30-minute room filtering cache for optimal speed
- **Priority-first urgency detection** - `URGENCY_KEYWORDS` get absolute priority (hard filter, no scoring)
- **Pattern matching** - Wildcard include/exclude patterns (*Alert*, *Social*)
- **Activity intelligence** - Auto-exclude inactive rooms based on message frequency
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

### Room Monitoring & Statistics (NEW)
- **"Show WebEx room monitoring stats"** - Uses `webex_get_room_monitoring_stats` (filtering insights)
- **"Refresh WebEx room filter"** - Uses `webex_refresh_room_filter` (manual cache refresh)

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

## 🎯 Hybrid Room Monitoring System

### **How It Works**
The system uses a 5-tier intelligent filtering pipeline to monitor only your most relevant rooms:

1. **Priority Rooms** - Always monitored regardless of other filters
2. **Pattern Matching** - Include/exclude rooms based on name patterns
3. **Activity Filtering** - Filter by recent message activity and member count
4. **Smart Scoring** - Score rooms by urgency, activity, and relevance
5. **Performance Limits** - Apply room count limits with caching for optimal speed

### **Benefits**
- **95% API Reduction**: Monitor 25 instead of 100+ rooms
- **Faster Response**: 5-second message checks vs 60+ seconds
- **Better Relevance**: Focus on rooms that actually matter
- **Automatic Discovery**: New alert rooms auto-included by patterns

## 🔧 Personal Token Setup & Troubleshooting

### Getting Your Personal Token
1. Visit [WebEx Developer Portal](https://developer.webex.com/docs/getting-started)
2. Click "Get My Personal Access Token"
3. Copy the token to your `.env` file
4. **Note**: Tokens expire after 12 hours

### Common Issues
- **Token Expired**: Generate new token (12-hour lifespan)
- **Access Denied**: Verify you have room access in WebEx Teams app
- **Invalid Token**: Check token was copied correctly

### Diagnostics
Use **"Diagnose my WebEx personal token"** command to troubleshoot issues automatically.

## Default Behavior
When user asks to "check messages" without specifying "urgent", use `webex_get_message_summaries` to show urgent messages first, then summaries of all other rooms.