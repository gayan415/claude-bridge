import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const mcpTools: Tool[] = [
  {
    name: 'webex_get_message_summaries',
    description: 'Get summaries of all recent messages from all WebEx rooms and spaces',
    inputSchema: {
      type: 'object',
      properties: {
        since_hours: {
          type: 'number',
          description: 'Look for messages from the last N hours (default: 24)',
          default: 24,
        },
        max_per_room: {
          type: 'number',
          description: 'Maximum messages to retrieve per room for summary (default: 10)',
          default: 10,
        },
      },
    },
  },
  {
    name: 'webex_get_urgent_messages',
    description: 'Fetch only urgent/priority messages from WebEx Teams that require immediate attention',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of urgent messages to retrieve (default: 10)',
          default: 10,
        },
        since_hours: {
          type: 'number',
          description: 'Look for messages from the last N hours (default: 1)',
          default: 1,
        },
      },
    },
  },
  {
    name: 'webex_send_reply',
    description: 'Send a reply to a WebEx Teams message or room',
    inputSchema: {
      type: 'object',
      properties: {
        room_id: {
          type: 'string',
          description: 'The room ID to send the message to',
        },
        message: {
          type: 'string',
          description: 'The message content to send',
        },
        reply_to_message_id: {
          type: 'string',
          description: 'Optional: Message ID to reply to (creates a thread)',
        },
      },
      required: ['room_id', 'message'],
    },
  },
  {
    name: 'webex_get_room_context',
    description: 'Get recent conversation context from a WebEx Teams room/space',
    inputSchema: {
      type: 'object',
      properties: {
        room_id: {
          type: 'string',
          description: 'The room ID to get context from',
        },
        message_count: {
          type: 'number',
          description: 'Number of recent messages to retrieve for context (default: 10)',
          default: 10,
        },
      },
      required: ['room_id'],
    },
  },
  {
    name: 'webex_mark_handled',
    description: 'Mark a message as handled to prevent duplicate responses',
    inputSchema: {
      type: 'object',
      properties: {
        message_id: {
          type: 'string',
          description: 'The message ID to mark as handled',
        },
      },
      required: ['message_id'],
    },
  },
  {
    name: 'webex_get_rooms_info',
    description: 'Get comprehensive information about all WebEx rooms - accessibility, metadata, and statistics',
    inputSchema: {
      type: 'object',
      properties: {
        include_details: {
          type: 'boolean',
          description: 'Include detailed room metadata like member counts and recent activity (default: true)',
          default: true,
        },
      },
    },
  },
  {
    name: 'webex_diagnose_personal_token',
    description: 'Diagnose WebEx personal token configuration, permissions, and access issues - essential for troubleshooting',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'webex_detect_best_mode',
    description: '🚀 AUTO-FIX: Detect best WebEx access mode to bypass organization restrictions (Bot/Integration/Webhook/Hybrid)',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'webex_setup_integration',
    description: '🔧 ORGANIZATION FIX: Setup WebEx Integration (OAuth) to bypass bot message reading restrictions',
    inputSchema: {
      type: 'object',
      properties: {
        client_id: {
          type: 'string',
          description: 'WebEx Integration Client ID from developer.webex.com',
        },
        client_secret: {
          type: 'string', 
          description: 'WebEx Integration Client Secret from developer.webex.com',
        },
        redirect_uri: {
          type: 'string',
          description: 'OAuth redirect URI (default: http://localhost:3000/callback)',
          default: 'http://localhost:3000/callback',
        },
      },
      required: ['client_id', 'client_secret'],
    },
  },
  {
    name: 'webex_complete_oauth',
    description: 'Complete WebEx Integration OAuth flow with authorization code',
    inputSchema: {
      type: 'object',
      properties: {
        authorization_code: {
          type: 'string',
          description: 'Authorization code from WebEx OAuth callback',
        },
      },
      required: ['authorization_code'],
    },
  },
  {
    name: 'webex_setup_webhooks',
    description: '🔧 REAL-TIME FIX: Setup WebEx webhooks for real-time message notifications (bypasses polling restrictions)',
    inputSchema: {
      type: 'object',
      properties: {
        webhook_url: {
          type: 'string',
          description: 'Public URL where webhooks will be delivered (e.g., https://yourserver.com/webhook)',
        },
        webhook_secret: {
          type: 'string',
          description: 'Secret for webhook verification (optional)',
          default: 'webex-webhook-secret',
        },
      },
      required: ['webhook_url'],
    },
  },
  {
    name: 'webex_get_messages_hybrid',
    description: '🚀 PRIMARY TOOL: Get WebEx messages using best available method (bypasses organization restrictions)',
    inputSchema: {
      type: 'object',
      properties: {
        since_hours: {
          type: 'number',
          description: 'Look for messages from the last N hours (default: 24)',
          default: 24,
        },
        mode: {
          type: 'string',
          enum: ['AUTO', 'BOT', 'INTEGRATION', 'WEBHOOK', 'HYBRID'],
          description: 'Force specific access mode (default: AUTO - auto-detect best)',
          default: 'AUTO',
        },
      },
    },
  },
  {
    name: 'webex_get_room_monitoring_stats',
    description: 'Get comprehensive room monitoring configuration, statistics, and insights',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'webex_refresh_room_filter',
    description: 'Force refresh the room filtering cache to pick up new rooms or configuration changes',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];