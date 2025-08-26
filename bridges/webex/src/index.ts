#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebexService } from './services/WebexService.js';
import { UrgencyDetector } from './services/UrgencyDetector.js';
import { WebexHybridService, HybridConfig } from './services/WebexHybridService.js';
import { mcpTools } from './utils/mcpTools.js';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from the correct location
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

class WebexMCPServer {
  private server: Server;
  private webexService: WebexService;
  private urgencyDetector: UrgencyDetector;
  private hybridService?: WebexHybridService;
  private hybridConfig?: HybridConfig;

  constructor() {
    this.server = new Server(
      {
        name: 'webex-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.webexService = new WebexService();
    this.urgencyDetector = new UrgencyDetector();
    
    // Initialize hybrid configuration
    this.initializeHybridService();

    this.setupHandlers();
  }

  private initializeHybridService(): void {
    this.hybridConfig = {
      botToken: process.env.WEBEX_BOT_TOKEN,
      integration: process.env.WEBEX_CLIENT_ID ? {
        clientId: process.env.WEBEX_CLIENT_ID,
        clientSecret: process.env.WEBEX_CLIENT_SECRET || '',
        redirectUri: process.env.WEBEX_REDIRECT_URI || 'http://localhost:3000/callback',
        accessToken: process.env.WEBEX_ACCESS_TOKEN,
        refreshToken: process.env.WEBEX_REFRESH_TOKEN,
      } : undefined,
      webhookSecret: process.env.WEBEX_WEBHOOK_SECRET,
      webhookUrl: process.env.WEBEX_WEBHOOK_URL,
    };

    if (this.hybridConfig.botToken) {
      this.hybridService = new WebexHybridService(this.hybridConfig);
    }
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: mcpTools,
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'webex_get_message_summaries':
            return await this.handleGetMessageSummaries(args);
          
          case 'webex_get_urgent_messages':
            return await this.handleGetUrgentMessages(args);
          
          case 'webex_send_reply':
            return await this.handleSendReply(args);
          
          case 'webex_get_room_context':
            return await this.handleGetRoomContext(args);
          
          case 'webex_mark_handled':
            return await this.handleMarkHandled(args);
          
          case 'webex_get_rooms_info':
            return await this.handleGetRoomsInfo(args);

          case 'webex_diagnose_personal_token':
            return await this.handleDiagnosePersonalToken(args);

          case 'webex_detect_best_mode':
            return await this.handleDetectBestMode(args);

          case 'webex_setup_integration':
            return await this.handleSetupIntegration(args);

          case 'webex_complete_oauth':
            return await this.handleCompleteOAuth(args);

          case 'webex_setup_webhooks':
            return await this.handleSetupWebhooks(args);

          case 'webex_get_messages_hybrid':
            return await this.handleGetMessagesHybrid(args);

          case 'webex_get_room_monitoring_stats':
            return await this.handleGetRoomMonitoringStats(args);

          case 'webex_refresh_room_filter':
            return await this.handleRefreshRoomFilter(args);

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
        };
      }
    });
  }

  private async handleGetMessageSummaries(args: any) {
    const { since_hours = 24, max_per_room = 10 } = args;
    const result = await this.webexService.getAllMessageSummaries(since_hours, max_per_room);
    
    // Format prioritized response: Urgent messages first, then summaries
    const formattedResponse = {
      // PRIORITY SECTION - Urgent messages that need immediate attention
      urgentMessages: result.urgentMessages.length > 0 ? {
        count: result.urgentMessages.length,
        messages: result.urgentMessages.map(msg => ({
          id: msg.id,
          roomTitle: msg.roomTitle,
          sender: msg.sender,
          text: msg.text.length > 200 ? msg.text.substring(0, 200) + '...' : msg.text,
          created: msg.created,
          urgencyReasons: msg.urgencyReasons,
          requiresImmediate: msg.requiresImmediate,
          roomId: msg.roomId, // For replying
        }))
      } : null,
      
      // SUMMARY SECTION - Everything else organized by room
      roomSummaries: result.roomSummaries.length > 0 ? {
        count: result.roomSummaries.length,
        rooms: result.roomSummaries.map(room => ({
          id: room.id,
          title: room.title,
          type: room.type,
          summary: room.summary,
          unreadCount: room.unreadCount,
          sampleMessages: room.latestMessages.slice(-2).map(msg => ({
            sender: msg.personDisplayName || msg.personEmail,
            text: (msg.text || '').substring(0, 80) + ((msg.text && msg.text.length > 80) ? '...' : ''),
            time: msg.created,
          })),
        }))
      } : null,
      
      // STATS SECTION
      stats: {
        totalUrgent: result.stats.totalUrgent,
        totalNonUrgentRooms: result.stats.totalRoomsSummary,
        totalMessages: result.stats.totalMessages,
        accessibleRooms: result.stats.accessibleRooms,
        inaccessibleRooms: result.stats.inaccessibleRooms,
      },
      
      // USER GUIDANCE
      guidance: {
        urgentAction: result.urgentMessages.length > 0 ? 
          `🚨 You have ${result.urgentMessages.length} URGENT message${result.urgentMessages.length > 1 ? 's' : ''} that need immediate attention!` :
          '✅ No urgent messages requiring immediate attention.',
        summaryAction: result.roomSummaries.length > 0 ?
          `📋 ${result.roomSummaries.length} room${result.roomSummaries.length > 1 ? 's have' : ' has'} non-urgent updates you can review when convenient.` :
          '✅ All caught up on non-urgent messages.',
        nextSteps: result.urgentMessages.length > 0 ?
          'Reply to urgent messages first using their roomId, then review room summaries.' :
          'Review room summaries to stay updated on conversations.',
      }
    };
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(formattedResponse, null, 2),
        },
      ],
    };
  }

  private async handleGetUrgentMessages(args: any) {
    const { limit = 10, since_hours = 1 } = args;
    const urgentMessages = await this.webexService.getUrgentMessages(limit, since_hours);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(urgentMessages, null, 2),
        },
      ],
    };
  }

  private async handleSendReply(args: any) {
    const { room_id, message, reply_to_message_id } = args;
    
    if (!room_id || !message) {
      throw new Error('room_id and message are required');
    }

    const result = await this.webexService.sendMessage(room_id, message, reply_to_message_id);
    
    return {
      content: [
        {
          type: 'text',
          text: `Message sent successfully: ${result.id}`,
        },
      ],
    };
  }

  private async handleGetRoomContext(args: any) {
    const { room_id, message_count = 10 } = args;
    
    if (!room_id) {
      throw new Error('room_id is required');
    }

    const context = await this.webexService.getRoomContext(room_id, message_count);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(context, null, 2),
        },
      ],
    };
  }

  private async handleMarkHandled(args: any) {
    const { message_id } = args;
    
    if (!message_id) {
      throw new Error('message_id is required');
    }

    await this.webexService.markAsHandled(message_id);
    
    return {
      content: [
        {
          type: 'text',
          text: `Message ${message_id} marked as handled`,
        },
      ],
    };
  }

  private async handleGetRoomsInfo(args: any) {
    const { include_details = true } = args;
    const roomsInfo = await this.webexService.getRoomsInfo();
    
    // Format the response for better readability
    const formattedResponse = {
      overview: {
        totalRooms: roomsInfo.totalRooms,
        accessibleRooms: roomsInfo.stats.accessibleCount,
        inaccessibleRooms: roomsInfo.stats.inaccessibleCount,
        accessRate: `${Math.round((roomsInfo.stats.accessibleCount / roomsInfo.totalRooms) * 100)}%`,
      },
      
      roomBreakdown: {
        byType: {
          groupRooms: roomsInfo.stats.groupRooms,
          directMessages: roomsInfo.stats.directRooms,
        },
        byActivity: {
          roomsWithRecentActivity: roomsInfo.stats.roomsWithRecentActivity,
          roomsWithUrgentContent: roomsInfo.stats.roomsWithUrgentContent,
        },
      },
      
      accessibleRooms: include_details ? roomsInfo.accessibleRooms.map(room => ({
        title: room.title,
        type: room.type,
        memberCount: room.memberCount || 'Unknown',
        lastActivity: room.lastActivity,
        recentMessages: room.recentMessageCount,
        hasUrgentContent: room.hasUrgentKeywords ? '🚨 Yes' : 'No',
        roomId: room.id, // For further actions
      })) : `${roomsInfo.stats.accessibleCount} rooms accessible (use include_details: true for full list)`,
      
      inaccessibleRooms: roomsInfo.inaccessibleRooms.length > 0 ? roomsInfo.inaccessibleRooms.map(room => ({
        title: room.title,
        type: room.type,
        error: room.error,
      })) : 'All rooms are accessible ✅',
      
      insights: {
        topActiveRooms: roomsInfo.accessibleRooms
          .filter(r => r.recentMessageCount > 0)
          .slice(0, 5)
          .map(r => `${r.title} (${r.recentMessageCount} recent messages)`),
        
        urgentRooms: roomsInfo.accessibleRooms
          .filter(r => r.hasUrgentKeywords)
          .map(r => `🚨 ${r.title} - contains URGENCY_KEYWORDS`),
      },
    };
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(formattedResponse, null, 2),
        },
      ],
    };
  }

  private async handleDiagnosePersonalToken(args: any) {
    const diagnostics = await this.webexService.getPersonalTokenDiagnostics();
    
    // Format comprehensive diagnostic response
    const formattedResponse = {
      summary: {
        rootCause: diagnostics.organizationAnalysis.likely403Cause,
        userHasAccessButCantRead: diagnostics.organizationAnalysis.botInRoomsButCantRead,
        organizationRestrictionsDetected: diagnostics.organizationAnalysis.orgRestrictionsDetected,
        overallStatus: diagnostics.permissions.canReadMessages ? '✅ Working' : '❌ Needs Fix',
      },

      userInfo: {
        name: diagnostics.userInfo.displayName,
        email: diagnostics.userInfo.emails[0],
        id: diagnostics.userInfo.id,
        type: diagnostics.userInfo.type,
        status: diagnostics.userInfo.status,
        created: diagnostics.userInfo.created,
      },
      
      detailedTestResults: {
        tokenValidityTest: {
          status: diagnostics.detailedTests.tokenValidityTest.passed ? '✅ PASSED' : '❌ FAILED',
          details: diagnostics.detailedTests.tokenValidityTest.details,
        },
        roomMembershipTest: {
          status: diagnostics.detailedTests.roomMembershipTest.passed ? '✅ PASSED' : '❌ FAILED', 
          details: diagnostics.detailedTests.roomMembershipTest.details,
          roomsTested: diagnostics.detailedTests.roomMembershipTest.testedRooms,
        },
        messageReadingTest: {
          status: diagnostics.detailedTests.messageReadTest.passed ? '✅ PASSED' : '❌ FAILED',
          details: diagnostics.detailedTests.messageReadTest.details,
          errorCode: diagnostics.detailedTests.messageReadTest.errorCode,
        },
        scopeInferenceTest: {
          inferredScopes: diagnostics.detailedTests.scopeInferenceTest.inferredScopes,
          details: diagnostics.detailedTests.scopeInferenceTest.details,
        },
      },

      permissions: {
        canListRooms: diagnostics.permissions.canListRooms ? '✅ Yes' : '❌ No',
        canReadMessages: diagnostics.permissions.canReadMessages ? '✅ Yes' : '❌ No - CRITICAL ISSUE',
        canSendMessages: diagnostics.permissions.canSendMessages ? '✅ Yes' : '❌ No',
        canManageMemberships: diagnostics.permissions.canManageMemberships ? '✅ Yes' : '⚠️ Limited',
      },

      diagnosticEvidence: diagnostics.organizationAnalysis.evidence,

      rootCauseAnalysis: {
        primaryIssue: diagnostics.organizationAnalysis.likely403Cause,
        description: this.getRootCauseDescription(diagnostics.organizationAnalysis.likely403Cause),
        confidence: diagnostics.organizationAnalysis.botInRoomsButCantRead ? 'HIGH - Organization Policy' : 
                   diagnostics.detailedTests.roomMembershipTest.passed ? 'MEDIUM' : 'LOW',
      },

      actionableRecommendations: diagnostics.recommendations,

      nextStepsBasedOnIssue: this.getNextStepsForIssue(diagnostics.organizationAnalysis.likely403Cause, diagnostics.userInfo.emails[0]),
    };
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(formattedResponse, null, 2),
        },
      ],
    };
  }

  private getRootCauseDescription(cause: string): string {
    switch (cause) {
      case 'ORG_POLICY':
        return 'Your WebEx organization has policies that prevent bots from reading messages, even when they are room members.';
      case 'NOT_ROOM_MEMBER':
        return 'The bot is not added as a member to the WebEx rooms it needs to monitor.';
      case 'MISSING_SCOPE':
        return 'The bot token lacks the spark:messages_read scope required to read messages.';
      case 'TOKEN_INVALID':
        return 'The bot token is invalid, expired, or has insufficient basic permissions.';
      default:
        return 'Unable to determine the root cause. Additional investigation needed.';
    }
  }

  private getNextStepsForIssue(cause: string, botEmail: string): string[] {
    switch (cause) {
      case 'ORG_POLICY':
        return [
          '🚨 PRIMARY ACTION: Contact your WebEx organization administrator',
          '📋 SPECIFIC REQUEST: Ask to enable bot message reading permissions for your organization',
          '🏢 ALTERNATIVE 1: Use personal WebEx account (not corporate) for bot development',
          '⚙️ ALTERNATIVE 2: Create WebEx Integration (OAuth) instead of Bot - may bypass restrictions',
          '📞 FALLBACK: Contact WebEx support to understand organization policies',
        ];
      case 'NOT_ROOM_MEMBER':
        return [
          `🔧 Add bot ${botEmail} to each WebEx room as a member`,
          '👥 METHOD: Room → People → Add People → Enter bot email',
          '✅ VERIFY: Confirm bot appears in room member lists',
          '📱 TIP: Use WebEx mobile app for easier bulk room additions',
        ];
      case 'MISSING_SCOPE':
        return [
          '🔄 Create new bot at developer.webex.com with spark:messages_read scope',
          '🏢 VERIFY: Check if your organization allows message-reading bots',
          '📧 UPDATE: Replace old bot email with new bot email in rooms',
        ];
      case 'TOKEN_INVALID':
        return [
          '🔄 Generate new bot token at developer.webex.com',
          '⚙️ UPDATE: Replace WEBEX_BOT_TOKEN in .env file',
          '🔄 RESTART: Restart Claude Desktop after token update',
        ];
      default:
        return [
          '🔍 Gather additional information about the WebEx setup',
          '📞 Contact WebEx support with diagnostic results',
          '🏢 Check with organization admin about bot policies',
        ];
    }
  }

  // NEW HYBRID HANDLERS - Organization Policy Bypass Solutions

  private async handleDetectBestMode(args: any) {
    if (!this.hybridService) {
      return {
        content: [{
          type: 'text',
          text: 'Error: Hybrid service not initialized. Check WEBEX_BOT_TOKEN configuration.',
        }],
      };
    }

    try {
      const detection = await this.hybridService.detectBestMode();
      
      const response = {
        autoDetectionResults: {
          recommendedMode: detection.recommendedMode,
          confidence: detection.modeAnalysis.bot.canReadMessages ? 'HIGH - Bot works' :
                     detection.modeAnalysis.integration.canReadMessages ? 'HIGH - Integration bypasses restrictions' :
                     detection.modeAnalysis.webhook.canCreateWebhooks ? 'MEDIUM - Webhooks available' : 'LOW - Limited options',
        },
        
        modeAnalysis: {
          botMode: {
            status: detection.modeAnalysis.bot.available ? '✅ Available' : '❌ Not Available',
            canReadMessages: detection.modeAnalysis.bot.canReadMessages ? '✅ Yes' : '❌ No',
            issues: detection.modeAnalysis.bot.errors,
          },
          integrationMode: {
            status: detection.modeAnalysis.integration.available ? '✅ Available' : '❌ Not Available', 
            canReadMessages: detection.modeAnalysis.integration.canReadMessages ? '✅ Yes' : '❌ No',
            issues: detection.modeAnalysis.integration.errors,
          },
          webhookMode: {
            status: detection.modeAnalysis.webhook.available ? '✅ Available' : '❌ Not Available',
            canCreateWebhooks: detection.modeAnalysis.webhook.canCreateWebhooks ? '✅ Yes' : '❌ No',
            issues: detection.modeAnalysis.webhook.errors,
          },
        },

        reasoning: detection.reasoning,

        nextSteps: detection.recommendedMode === 'INTEGRATION' ? [
          '🚀 RECOMMENDED: Use WebEx Integration (OAuth) to bypass organization restrictions',
          '📋 NEXT: Run webex_setup_integration with client_id and client_secret',
          '🌐 CREATE: Visit developer.webex.com → Create Integration (not Bot)',
        ] : detection.recommendedMode === 'WEBHOOK' ? [
          '🚀 RECOMMENDED: Use WebEx Webhooks for real-time notifications',
          '📋 NEXT: Run webex_setup_webhooks with your public webhook URL',
          '⚡ BENEFIT: Real-time message notifications without polling',
        ] : detection.recommendedMode === 'BOT' ? [
          '✅ Bot mode works normally - no bypass needed',
          '🎯 Use standard webex_get_message_summaries tool',
        ] : [
          '🔧 Multiple approaches needed - use HYBRID mode',
          '📞 Consider contacting WebEx organization administrator',
        ],
      };

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(response, null, 2),
        }],
      };
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: `Error detecting best mode: ${error.message}`,
        }],
      };
    }
  }

  private async handleSetupIntegration(args: any) {
    const { client_id, client_secret, redirect_uri = 'http://localhost:3000/callback' } = args;

    try {
      // Update hybrid configuration
      if (!this.hybridConfig) {
        this.hybridConfig = { botToken: process.env.WEBEX_BOT_TOKEN };
      }

      this.hybridConfig.integration = {
        clientId: client_id,
        clientSecret: client_secret,
        redirectUri: redirect_uri,
      };

      // Reinitialize hybrid service
      this.hybridService = new WebexHybridService(this.hybridConfig);

      // Get OAuth authorization URL
      const authUrl = this.hybridService.getIntegrationAuthUrl();

      const response = {
        integrationSetup: {
          status: '✅ Integration configured successfully',
          clientId: client_id,
          redirectUri: redirect_uri,
        },
        
        oauthFlow: {
          step1: 'Configuration Complete ✅',
          step2: 'Visit Authorization URL 👇',
          authorizationUrl: authUrl,
          step3: 'After authorization, you will get a code - use webex_complete_oauth tool',
        },

        instructions: [
          '1️⃣ Click the authorization URL above',
          '2️⃣ Sign in with your WebEx account and grant permissions',
          '3️⃣ Copy the authorization code from the callback',
          '4️⃣ Run webex_complete_oauth with the code',
          '5️⃣ Integration will bypass organization bot restrictions!',
        ],

        scopesRequested: [
          'spark:people_read - Read user information',
          'spark:rooms_read - List rooms', 
          'spark:messages_read - Read messages (bypasses bot restrictions)',
          'spark:messages_write - Send messages',
          'spark:memberships_read - Read room memberships',
        ],
      };

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(response, null, 2),
        }],
      };
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: `Error setting up integration: ${error.message}`,
        }],
      };
    }
  }

  private async handleCompleteOAuth(args: any) {
    const { authorization_code } = args;

    if (!this.hybridService) {
      return {
        content: [{
          type: 'text',
          text: 'Error: Integration not configured. Run webex_setup_integration first.',
        }],
      };
    }

    try {
      const result = await this.hybridService.completeIntegrationAuth(authorization_code);

      if (result.success && result.tokens) {
        const response = {
          oauthCompletion: {
            status: '🎉 OAuth completed successfully!',
            accessTokenReceived: '✅ Yes',
            refreshTokenReceived: '✅ Yes', 
          },

          integrationStatus: {
            mode: 'INTEGRATION',
            bypassesOrgRestrictions: '✅ Yes',
            canReadMessages: '✅ Yes (via user authorization)',
            readyToUse: '✅ Yes',
          },

          nextSteps: [
            '🚀 Integration setup complete!',
            '🎯 Use webex_get_messages_hybrid tool to get messages',
            '⚡ Messages will be retrieved via OAuth (bypasses bot restrictions)',
            '🔒 Tokens stored securely for future use',
          ],

          importantNotes: [
            '💡 Integration uses YOUR permissions, not bot permissions',
            '🔓 Bypasses organization bot reading restrictions',
            '⏰ Access token expires - will auto-refresh when needed',
            '🏢 Works even if organization blocks bot message access',
          ],

          // Don't expose actual tokens in response for security
          tokenInfo: {
            accessTokenLength: result.tokens.access_token.length,
            refreshTokenLength: result.tokens.refresh_token.length,
            status: 'Stored securely',
          },
        };

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(response, null, 2),
          }],
        };
      } else {
        return {
          content: [{
            type: 'text',
            text: `OAuth completion failed: ${result.error}`,
          }],
        };
      }
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: `Error completing OAuth: ${error.message}`,
        }],
      };
    }
  }

  private async handleSetupWebhooks(args: any) {
    const { webhook_url, webhook_secret = 'webex-webhook-secret' } = args;

    if (!this.hybridService) {
      return {
        content: [{
          type: 'text',
          text: 'Error: Hybrid service not initialized.',
        }],
      };
    }

    try {
      // Update configuration
      if (this.hybridConfig) {
        this.hybridConfig.webhookUrl = webhook_url;
        this.hybridConfig.webhookSecret = webhook_secret;
        this.hybridService = new WebexHybridService(this.hybridConfig);
      }

      const response = {
        webhookSetup: {
          status: '⚡ Webhook configuration ready',
          webhookUrl: webhook_url,
          secretConfigured: '✅ Yes',
        },

        howWebhooksWork: {
          concept: 'Real-time push notifications instead of polling',
          benefit: 'Bypasses message reading API restrictions',
          mechanism: 'WebEx sends HTTP POST when messages are created',
        },

        implementationSteps: [
          '1️⃣ Deploy webhook endpoint at: ' + webhook_url,
          '2️⃣ Endpoint should accept POST requests from WebEx',
          '3️⃣ Process incoming message events in real-time',
          '4️⃣ No need to poll for messages - they come to you!',
        ],

        webhookPayloadExample: {
          resource: 'messages',
          event: 'created',
          data: {
            id: 'message-id-here',
            roomId: 'room-id-here',
            personId: 'person-id-here',
            created: '2024-01-01T00:00:00.000Z',
          },
        },

        nextSteps: [
          '🚀 Webhook URL configured successfully',
          '⚡ Messages will be delivered in real-time',
          '🎯 Use webex_get_messages_hybrid with WEBHOOK mode',
          '📡 Implement HTTP server at webhook URL to receive events',
        ],

        benefits: [
          '⚡ Real-time notifications',
          '🔓 Bypasses polling restrictions', 
          '📊 Lower API usage',
          '🎯 Immediate urgent message detection',
        ],
      };

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(response, null, 2),
        }],
      };
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: `Error setting up webhooks: ${error.message}`,
        }],
      };
    }
  }

  private async handleGetMessagesHybrid(args: any) {
    const { since_hours = 24, mode = 'AUTO' } = args;

    if (!this.hybridService) {
      return {
        content: [{
          type: 'text',
          text: 'Error: Hybrid service not initialized.',
        }],
      };
    }

    try {
      // Auto-detect best mode if requested
      if (mode === 'AUTO') {
        const detection = await this.hybridService.detectBestMode();
        this.hybridService.setMode(detection.recommendedMode);
      } else {
        this.hybridService.setMode(mode as any);
      }

      // Get messages using hybrid approach
      const result = await this.hybridService.getAllMessages(since_hours);

      const response = {
        hybridResults: {
          modeUsed: result.mode,
          success: '✅ Retrieved messages successfully',
          bypassedRestrictions: result.mode !== 'BOT' ? '✅ Yes' : '➖ Not needed',
        },

        messageStats: {
          totalMessages: result.stats.totalMessages,
          urgentMessages: result.stats.totalUrgent,
          roomsAccessed: result.stats.roomsAccessed,
          timeRange: `Last ${since_hours} hours`,
        },

        urgentMessages: result.urgentMessages.length > 0 ? {
          count: result.urgentMessages.length,
          messages: result.urgentMessages.slice(0, 10).map(msg => ({
            roomTitle: msg.roomTitle || 'Unknown Room',
            sender: msg.personDisplayName || msg.personEmail,
            text: (msg.text || '').substring(0, 200) + (msg.text && msg.text.length > 200 ? '...' : ''),
            created: msg.created,
            urgencyScore: msg.urgencyScore,
            roomId: msg.roomId,
          }))
        } : 'No urgent messages in the specified time range',

        allMessages: {
          count: result.messages.length,
          preview: result.messages.slice(0, 5).map(msg => ({
            roomTitle: msg.roomTitle || 'Unknown Room',
            sender: msg.personDisplayName || msg.personEmail, 
            text: (msg.text || '').substring(0, 100) + (msg.text && msg.text.length > 100 ? '...' : ''),
            created: msg.created,
            isUrgent: msg.isUrgent,
          }))
        },

        guidance: {
          urgentAction: result.stats.totalUrgent > 0 ? 
            `🚨 ${result.stats.totalUrgent} urgent messages need attention!` :
            '✅ No urgent messages requiring immediate action',
          modeExplanation: result.mode === 'INTEGRATION' ? 
            '🔓 Using OAuth Integration - bypassed organization bot restrictions' :
            result.mode === 'WEBHOOK' ?
            '⚡ Using Webhooks - real-time message notifications' :
            result.mode === 'BOT' ?
            '🤖 Using Bot API - normal operation' :
            '🔀 Using Hybrid approach - multiple methods combined',
        },
      };

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(response, null, 2),
        }],
      };
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: `Error getting messages: ${error.message}`,
        }],
      };
    }
  }

  private async handleGetRoomMonitoringStats(args: any) {
    try {
      const stats = await this.webexService.getRoomMonitoringStats();
      
      return {
        content: [{
          type: 'text',
          text: `# Room Monitoring Statistics\n\n## Configuration\n- Max monitored rooms: ${stats.configuration.maxMonitoredRooms}\n- Priority rooms: ${stats.configuration.priorityRooms.join(', ') || 'None'}\n- Include patterns: ${stats.configuration.includePatterns.join(', ') || 'All'}\n- Exclude patterns: ${stats.configuration.excludePatterns.join(', ') || 'None'}\n\n## Current Status\n- Total rooms: ${stats.statistics?.totalRooms || 0}\n- Monitored: ${stats.statistics?.monitoredCount || 0}\n- Priority: ${stats.statistics?.priorityCount || 0}\n- Cache expires in: ${stats.statistics?.cacheExpiresIn || 0} minutes\n\n## Monitored Rooms (Top 10)\n${stats.monitoredRooms.slice(0, 10).map((r: any) => `- ${r.title} (score: ${r.score}, ${r.hasUrgentContent ? '🚨 urgent content' : 'normal'})`).join('\n')}\n\n## Sample Excluded Rooms\n${stats.excludedRooms.map((r: any) => `- ${r.title} (${r.reason})`).join('\n')}`,
        }],
      };
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: `Error getting room monitoring stats: ${error.message}`,
        }],
      };
    }
  }

  private async handleRefreshRoomFilter(args: any) {
    try {
      this.webexService.clearRoomFilterCache();
      
      return {
        content: [{
          type: 'text',
          text: '✅ Room filter cache cleared successfully. Next message request will use fresh room filtering.',
        }],
      };
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: `Error refreshing room filter: ${error.message}`,
        }],
      };
    }
  }

  async run(): Promise<void> {
    // Initialize services
    await this.webexService.initialize();

    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    console.error('WebEx MCP Server running on stdio');
  }
}

// Start the server
const server = new WebexMCPServer();
server.run().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});