import { WebexService } from './WebexService.js';
import { WebexIntegrationService, WebexIntegrationConfig } from './WebexIntegration.js';
import { WebexWebhookService } from './WebexWebhooks.js';
import { WebexMessage, WebexRoom } from '../types/webex.js';

export type WebexMode = 'BOT' | 'INTEGRATION' | 'WEBHOOK' | 'HYBRID';

export interface HybridConfig {
  // Bot configuration
  botToken?: string;
  
  // Integration configuration  
  integration?: WebexIntegrationConfig;
  
  // Webhook configuration
  webhookSecret?: string;
  webhookUrl?: string;
  
  // Preferred mode
  preferredMode?: WebexMode;
}

export class WebexHybridService {
  private botService?: WebexService;
  private integrationService?: WebexIntegrationService;  
  private webhookService?: WebexWebhookService;
  private activeMode: WebexMode = 'BOT';
  private config: HybridConfig;

  constructor(config: HybridConfig) {
    this.config = config;
    
    // Initialize available services
    if (config.botToken) {
      this.botService = new WebexService();
    }
    
    if (config.integration) {
      this.integrationService = new WebexIntegrationService(config.integration);
    }
    
    if (config.botToken && config.webhookSecret) {
      this.webhookService = new WebexWebhookService(config.botToken, config.webhookSecret);
    }
  }

  // Auto-detect best working mode for organization
  async detectBestMode(): Promise<{
    recommendedMode: WebexMode;
    modeAnalysis: {
      bot: { available: boolean; canReadMessages: boolean; errors: string[] };
      integration: { available: boolean; canReadMessages: boolean; errors: string[] };
      webhook: { available: boolean; canCreateWebhooks: boolean; errors: string[] };
    };
    reasoning: string[];
  }> {
    const analysis = {
      bot: { available: false, canReadMessages: false, errors: [] as string[] },
      integration: { available: false, canReadMessages: false, errors: [] as string[] },
      webhook: { available: false, canCreateWebhooks: false, errors: [] as string[] },
    };

    const reasoning: string[] = [];

    // Test Bot Mode
    if (this.botService) {
      try {
        const botDiagnostics = await this.botService.getPersonalTokenDiagnostics();
        analysis.bot.available = true;
        analysis.bot.canReadMessages = botDiagnostics.permissions.canReadMessages;
        
        if (botDiagnostics.organizationAnalysis.likely403Cause === 'ORG_POLICY') {
          analysis.bot.errors.push('Organization policy blocks bot message reading');
          reasoning.push('🚫 Bot mode blocked by organization policy');
        }
      } catch (error: any) {
        analysis.bot.errors.push(error.message);
      }
    }

    // Test Integration Mode  
    if (this.integrationService && this.config.integration?.accessToken) {
      try {
        const integrationTest = await this.integrationService.testIntegrationAccess();
        analysis.integration.available = true;
        analysis.integration.canReadMessages = integrationTest.canReadMessages;
        analysis.integration.errors = integrationTest.errors;
        
        if (integrationTest.canReadMessages) {
          reasoning.push('✅ Integration mode can read messages (bypasses bot restrictions)');
        }
      } catch (error: any) {
        analysis.integration.errors.push(error.message);
      }
    }

    // Test Webhook Mode
    if (this.webhookService) {
      try {
        const webhookTest = await this.webhookService.testWebhookAccess();
        analysis.webhook.available = true;
        analysis.webhook.canCreateWebhooks = webhookTest.canCreateWebhooks;
        analysis.webhook.errors = webhookTest.errors;
        
        if (webhookTest.canCreateWebhooks) {
          reasoning.push('✅ Webhook mode available (real-time notifications)');
        }
      } catch (error: any) {
        analysis.webhook.errors.push(error.message);
      }
    }

    // Determine best mode
    let recommendedMode: WebexMode = 'BOT';
    
    if (analysis.integration.canReadMessages) {
      recommendedMode = 'INTEGRATION';
      reasoning.push('🎯 RECOMMENDED: Integration mode bypasses organization restrictions');
    } else if (analysis.webhook.canCreateWebhooks && !analysis.bot.canReadMessages) {
      recommendedMode = 'WEBHOOK';
      reasoning.push('🎯 RECOMMENDED: Webhook mode for real-time notifications');
    } else if (analysis.bot.canReadMessages) {
      recommendedMode = 'BOT';
      reasoning.push('🎯 RECOMMENDED: Bot mode works normally');
    } else {
      recommendedMode = 'HYBRID';
      reasoning.push('🎯 RECOMMENDED: Hybrid mode using multiple approaches');
    }

    return {
      recommendedMode,
      modeAnalysis: analysis,
      reasoning,
    };
  }

  // Set active mode
  setMode(mode: WebexMode): void {
    this.activeMode = mode;
  }

  // Universal message retrieval - works with any mode
  async getAllMessages(sinceHours: number = 24): Promise<{
    messages: WebexMessage[];
    urgentMessages: WebexMessage[];
    mode: WebexMode;
    stats: {
      totalMessages: number;
      totalUrgent: number;
      roomsAccessed: number;
    };
  }> {
    let messages: WebexMessage[] = [];
    let urgentMessages: WebexMessage[] = [];
    let roomsAccessed = 0;

    try {
      switch (this.activeMode) {
        case 'INTEGRATION':
          if (this.integrationService) {
            const integrationResult = await this.integrationService.getAllMessagesWithIntegration(sinceHours);
            messages = integrationResult.rooms.flatMap(room => room.messages);
            urgentMessages = messages.filter(m => m.isUrgent);
            roomsAccessed = integrationResult.rooms.length;
          }
          break;

        case 'WEBHOOK':
          if (this.webhookService) {
            messages = this.webhookService.getRecentMessages(sinceHours * 60);
            urgentMessages = this.webhookService.getUrgentMessagesFromQueue();
            roomsAccessed = new Set(messages.map(m => m.roomId)).size;
          }
          break;

        case 'BOT':
          if (this.botService) {
            const botResult = await this.botService.getAllMessageSummaries(sinceHours, 10);
            // Convert bot result format to messages
            messages = botResult.roomSummaries.flatMap(room => room.latestMessages);
            urgentMessages = botResult.urgentMessages.map(urgent => ({
              id: urgent.id,
              roomId: urgent.roomId,
              text: urgent.text,
              personDisplayName: urgent.sender,
              created: urgent.created,
              isUrgent: true,
              urgencyScore: 1.0,
            } as WebexMessage));
            roomsAccessed = botResult.stats.accessibleRooms;
          }   
          break;

        case 'HYBRID':
          // Try multiple approaches and combine results
          const results = await this.tryMultipleApproaches(sinceHours);
          messages = results.messages;
          urgentMessages = results.urgentMessages;
          roomsAccessed = results.roomsAccessed;
          break;
      }

      return {
        messages,
        urgentMessages,
        mode: this.activeMode,
        stats: {
          totalMessages: messages.length,
          totalUrgent: urgentMessages.length,
          roomsAccessed,
        },
      };

    } catch (error: any) {
      throw new Error(`Failed to get messages in ${this.activeMode} mode: ${error.message}`);
    }
  }

  // Try multiple approaches and return best result
  private async tryMultipleApproaches(sinceHours: number): Promise<{
    messages: WebexMessage[];
    urgentMessages: WebexMessage[];
    roomsAccessed: number;
  }> {
    const results = {
      messages: [] as WebexMessage[],
      urgentMessages: [] as WebexMessage[], 
      roomsAccessed: 0,
    };

    // Try Integration first (most likely to work)
    if (this.integrationService && this.config.integration?.accessToken) {
      try {
        const integrationResult = await this.integrationService.getAllMessagesWithIntegration(sinceHours);
        results.messages.push(...integrationResult.rooms.flatMap(room => room.messages));
        results.roomsAccessed += integrationResult.rooms.length;
      } catch (error) {
        console.error('Integration approach failed:', error);
      }
    }

    // Try Webhook (for recent messages)
    if (this.webhookService && results.messages.length === 0) {
      try {
        const webhookMessages = this.webhookService.getRecentMessages(sinceHours * 60);
        results.messages.push(...webhookMessages);
        results.roomsAccessed += new Set(webhookMessages.map(m => m.roomId)).size;
      } catch (error) {
        console.error('Webhook approach failed:', error);
      }
    }

    // Filter urgent messages
    results.urgentMessages = results.messages.filter(m => m.isUrgent);

    return results;
  }

  // Send message using any available mode
  async sendMessage(roomId: string, message: string): Promise<{ id: string; mode: WebexMode }> {
    try {
      let result: { id: string };

      switch (this.activeMode) {
        case 'INTEGRATION':
          if (this.integrationService) {
            result = await this.integrationService.sendMessage(roomId, message);
            return { id: result.id, mode: 'INTEGRATION' };
          }
          break;

        case 'BOT':
        case 'WEBHOOK':
        case 'HYBRID':
          if (this.botService) {
            result = await this.botService.sendMessage(roomId, message);
            return { id: result.id, mode: 'BOT' };
          }
          break;
      }

      throw new Error(`No available service for sending messages in ${this.activeMode} mode`);
    } catch (error: any) {
      throw new Error(`Failed to send message: ${error.message}`);
    }
  }

  // Get OAuth authorization URL for integration setup
  getIntegrationAuthUrl(): string {
    if (!this.integrationService) {
      throw new Error('Integration service not configured');
    }
    return this.integrationService.getAuthorizationUrl();
  }

  // Complete OAuth flow
  async completeIntegrationAuth(code: string): Promise<{
    success: boolean;
    tokens?: {
      access_token: string;
      refresh_token: string;
    };
    error?: string;
  }> {
    if (!this.integrationService) {
      return { success: false, error: 'Integration service not configured' };
    }

    try {
      const tokens = await this.integrationService.exchangeCodeForTokens(code);
      return {
        success: true,
        tokens: {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
        },
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}