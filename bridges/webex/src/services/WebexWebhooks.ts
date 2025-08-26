import axios, { AxiosInstance } from 'axios';
import { WebexMessage } from '../types/webex.js';

export interface WebhookEvent {
  id: string;
  name: string;
  resource: string;
  event: string;
  filter?: string;
  data: {
    id: string;
    roomId: string;
    personId: string;
    personEmail: string;
    created: string;
  };
}

export class WebexWebhookService {
  private client: AxiosInstance;
  private webhookSecret: string;
  private messageQueue: WebexMessage[] = [];
  private urgentMessages: WebexMessage[] = [];

  constructor(botToken: string, webhookSecret: string) {
    this.webhookSecret = webhookSecret;
    
    this.client = axios.create({
      baseURL: 'https://webexapis.com/v1',
      headers: {
        'Authorization': `Bearer ${botToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  // Create webhook for message events - bypasses polling restrictions
  async createMessageWebhook(targetUrl: string): Promise<{ id: string; targetUrl: string }> {
    try {
      const response = await this.client.post('/webhooks', {
        name: 'Claude WebEx Message Webhook',
        targetUrl: targetUrl,
        resource: 'messages',
        event: 'created',
        secret: this.webhookSecret,
      });

      return {
        id: response.data.id,
        targetUrl: response.data.targetUrl,
      };
    } catch (error: any) {
      throw new Error(`Failed to create webhook: ${error?.response?.data?.message || error.message}`);
    }
  }

  // Process incoming webhook events - receives message notifications
  async processWebhookEvent(event: WebhookEvent): Promise<void> {
    try {
      if (event.resource === 'messages' && event.event === 'created') {
        // Get the actual message content
        const message = await this.getMessageById(event.data.id);
        
        if (message) {
          this.messageQueue.push(message);
          
          // Check if message is urgent
          if (this.isMessageUrgent(message.text || '')) {
            this.urgentMessages.push(message);
            console.log(`🚨 URGENT MESSAGE DETECTED: ${(message.text || '').substring(0, 100)}...`);
          }
        }
      }
    } catch (error: any) {
      console.error(`Webhook processing error: ${error.message}`);
    }
  }

  // Get message by ID - this might work even when listing doesn't
  private async getMessageById(messageId: string): Promise<WebexMessage | null> {
    try {
      const response = await this.client.get(`/messages/${messageId}`);
      const msg = response.data;
      
      return {
        id: msg.id,
        roomId: msg.roomId,
        roomType: msg.roomType,
        text: msg.text,
        personId: msg.personId,
        personEmail: msg.personEmail,
        personDisplayName: msg.personDisplayName,
        created: msg.created,
        mentionedPeople: msg.mentionedPeople,
        isUrgent: this.isMessageUrgent(msg.text),
        urgencyScore: this.isMessageUrgent(msg.text) ? 1.0 : 0.0,
      } as WebexMessage;
    } catch (error: any) {
      console.error(`Failed to get message ${messageId}:`, error?.response?.status);
      return null;
    }
  }

  // Get recent messages from webhook queue - no API polling needed!
  getRecentMessages(sinceMinutes: number = 60): WebexMessage[] {
    const since = new Date(Date.now() - sinceMinutes * 60 * 1000);
    
    return this.messageQueue.filter(msg => 
      new Date(msg.created) > since
    );
  }

  // Get urgent messages from webhook queue
  getUrgentMessagesFromQueue(): WebexMessage[] {
    return [...this.urgentMessages];
  }

  // Clear processed messages
  clearProcessedMessages(): void {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    this.messageQueue = this.messageQueue.filter(msg => 
      new Date(msg.created) > oneHourAgo
    );
    
    this.urgentMessages = this.urgentMessages.filter(msg => 
      new Date(msg.created) > oneHourAgo
    );
  }

  private isMessageUrgent(text: string): boolean {
    if (!text) return false;
    
    const urgencyKeywords = (process.env.URGENCY_KEYWORDS || 'urgent,asap,critical,production,down,incident,emergency,help,broken,failed,error,outage,sev1,p1').split(',');
    const lowerText = text.toLowerCase();
    
    return urgencyKeywords.some(keyword => 
      lowerText.includes(keyword.toLowerCase().trim())
    );
  }

  // List existing webhooks
  async listWebhooks(): Promise<Array<{
    id: string;
    name: string;
    targetUrl: string;
    resource: string;
    event: string;
    status: string;
  }>> {
    try {
      const response = await this.client.get('/webhooks');
      return response.data.items.map((webhook: any) => ({
        id: webhook.id,
        name: webhook.name,
        targetUrl: webhook.targetUrl,
        resource: webhook.resource,
        event: webhook.event,
        status: webhook.status,
      }));
    } catch (error: any) {
      throw new Error(`Failed to list webhooks: ${error?.response?.data?.message || error.message}`);
    }
  }

  // Delete webhook
  async deleteWebhook(webhookId: string): Promise<void> {
    try {
      await this.client.delete(`/webhooks/${webhookId}`);
    } catch (error: any) {
      throw new Error(`Failed to delete webhook: ${error?.response?.data?.message || error.message}`);
    }
  }

  // Test webhook connectivity
  async testWebhookAccess(): Promise<{
    canCreateWebhooks: boolean;
    canListWebhooks: boolean;
    existingWebhooks: number;
    errors: string[];
  }> {
    const result = {
      canCreateWebhooks: false,
      canListWebhooks: false,
      existingWebhooks: 0,
      errors: [] as string[]
    };

    try {
      const webhooks = await this.listWebhooks();
      result.canListWebhooks = true;
      result.existingWebhooks = webhooks.length;
      
      // If we can list webhooks, we can likely create them
      result.canCreateWebhooks = true;
    } catch (error: any) {
      result.errors.push(`Webhook access failed: ${error.message}`);
    }

    return result;
  }
}