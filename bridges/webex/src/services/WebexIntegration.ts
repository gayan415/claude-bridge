import axios, { AxiosInstance } from 'axios';
import { WebexMessage, WebexRoom, WebexPerson } from '../types/webex.js';

export interface WebexIntegrationConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  accessToken?: string;
  refreshToken?: string;
}

export class WebexIntegrationService {
  private client: AxiosInstance;
  private config: WebexIntegrationConfig;

  constructor(config: WebexIntegrationConfig) {
    this.config = config;
    
    this.client = axios.create({
      baseURL: 'https://webexapis.com/v1',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  // OAuth Authorization URL Generation
  getAuthorizationUrl(): string {
    const scopes = [
      'spark:people_read',
      'spark:rooms_read', 
      'spark:messages_read',  // This scope can be requested via OAuth!
      'spark:messages_write',
      'spark:memberships_read'
    ].join(' ');

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: scopes,
      state: 'webex-integration-auth'
    });

    return `https://webexapis.com/v1/authorize?${params.toString()}`;
  }

  // Exchange authorization code for tokens
  async exchangeCodeForTokens(authorizationCode: string): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
  }> {
    try {
      const response = await axios.post('https://webexapis.com/v1/access_token', {
        grant_type: 'authorization_code',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        code: authorizationCode,
        redirect_uri: this.config.redirectUri,
      });

      // Update tokens
      this.config.accessToken = response.data.access_token;
      this.config.refreshToken = response.data.refresh_token;
      
      // Update client headers
      this.client.defaults.headers['Authorization'] = `Bearer ${response.data.access_token}`;

      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to exchange code for tokens: ${error?.response?.data?.message || error.message}`);
    }
  }

  // Refresh access token
  async refreshAccessToken(): Promise<string> {
    if (!this.config.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await axios.post('https://webexapis.com/v1/access_token', {
        grant_type: 'refresh_token',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        refresh_token: this.config.refreshToken,
      });

      this.config.accessToken = response.data.access_token;
      this.client.defaults.headers['Authorization'] = `Bearer ${response.data.access_token}`;

      return response.data.access_token;
    } catch (error: any) {
      throw new Error(`Failed to refresh token: ${error?.response?.data?.message || error.message}`);
    }
  }

  // Test integration permissions - bypasses org bot restrictions
  async testIntegrationAccess(): Promise<{
    canListRooms: boolean;
    canReadMessages: boolean;
    canSendMessages: boolean;
    userInfo: any;
    accessibleRooms: number;
    errors: string[];
  }> {
    const result = {
      canListRooms: false,
      canReadMessages: false,
      canSendMessages: false,
      userInfo: null,
      accessibleRooms: 0,
      errors: [] as string[]
    };

    try {
      // Test user info access
      const userResponse = await this.client.get('/people/me');
      result.userInfo = userResponse.data;
    } catch (error: any) {
      result.errors.push(`User info access failed: ${error?.response?.status}`);
    }

    try {
      // Test room listing
      const roomsResponse = await this.client.get('/rooms');
      result.canListRooms = true;
      
      const rooms = roomsResponse.data.items || [];
      result.accessibleRooms = rooms.length;

      // Test message reading on first room
      if (rooms.length > 0) {
        try {
          await this.client.get('/messages', {
            params: { roomId: rooms[0].id, max: 1 }
          });
          result.canReadMessages = true;
        } catch (error: any) {
          result.errors.push(`Message reading failed: ${error?.response?.status} - ${error?.response?.data?.message || 'Unknown'}`);
        }
      }

    } catch (error: any) {
      result.errors.push(`Room listing failed: ${error?.response?.status}`);
    }

    // Assume can send messages if can list rooms (to avoid sending test messages)
    result.canSendMessages = result.canListRooms;

    return result;
  }

  // Get messages using OAuth integration (bypasses bot restrictions)
  async getAllMessagesWithIntegration(sinceHours: number = 24): Promise<{
    rooms: Array<{
      id: string;
      title: string;
      messages: WebexMessage[];
      urgentCount: number;
    }>;
    totalMessages: number;
    totalUrgent: number;
  }> {
    const sinceTime = new Date(Date.now() - sinceHours * 60 * 60 * 1000);
    
    try {
      // Get all rooms user has access to
      const roomsResponse = await this.client.get('/rooms');
      const rooms: WebexRoom[] = roomsResponse.data.items;

      const roomsWithMessages = [];
      let totalMessages = 0;
      let totalUrgent = 0;

      for (const room of rooms) {
        try {
          // OAuth integration can read messages that bots cannot!
          const messagesResponse = await this.client.get('/messages', {
            params: {
              roomId: room.id,
              max: 50,
            },
          });

          const messages: WebexMessage[] = messagesResponse.data.items
            .filter((msg: any) => new Date(msg.created) > sinceTime)
            .map((msg: any) => ({
              id: msg.id,
              roomId: msg.roomId,
              roomType: msg.roomType,
              roomTitle: room.title,
              text: msg.text,
              personId: msg.personId,
              personEmail: msg.personEmail,
              personDisplayName: msg.personDisplayName,
              created: msg.created,
              mentionedPeople: msg.mentionedPeople,
              isUrgent: this.isMessageUrgent(msg.text),
              urgencyScore: this.isMessageUrgent(msg.text) ? 1.0 : 0.0,
            } as WebexMessage));

          if (messages.length > 0) {
            const urgentCount = messages.filter(m => m.isUrgent).length;
            
            roomsWithMessages.push({
              id: room.id,
              title: room.title || 'Unnamed Room',
              messages,
              urgentCount,
            });

            totalMessages += messages.length;
            totalUrgent += urgentCount;
          }

        } catch (error: any) {
          console.error(`Integration: Could not access room ${room.title}: ${error?.response?.status}`);
        }
      }

      return {
        rooms: roomsWithMessages,
        totalMessages,
        totalUrgent,
      };

    } catch (error: any) {
      throw new Error(`Integration message retrieval failed: ${error?.response?.data?.message || error.message}`);
    }
  }

  private isMessageUrgent(text: string): boolean {
    if (!text) return false;
    
    const urgencyKeywords = (process.env.URGENCY_KEYWORDS || 'urgent,asap,critical,production,down,incident,emergency,help,broken,failed,error,outage,sev1,p1').split(',');
    const lowerText = text.toLowerCase();
    
    return urgencyKeywords.some(keyword => 
      lowerText.includes(keyword.toLowerCase().trim())
    );
  }

  async sendMessage(roomId: string, message: string): Promise<{ id: string }> {
    try {
      const response = await this.client.post('/messages', {
        roomId,
        text: message,
      });

      return { id: response.data.id };
    } catch (error: any) {
      throw new Error(`Failed to send message via integration: ${error?.response?.data?.message || error.message}`);
    }
  }
}