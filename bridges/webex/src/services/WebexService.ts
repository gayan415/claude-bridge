import axios, { AxiosInstance } from 'axios';
import { WebexMessage, WebexRoom, WebexPerson } from '../types/webex.js';
import { RoomFilterService, RoomMetadata, FilterResult } from './RoomFilterService.js';

export class WebexService {
  private client: AxiosInstance;
  private personalToken: string;
  private handledMessages: Set<string> = new Set();
  private roomFilter: RoomFilterService;

  constructor() {
    this.personalToken = process.env.WEBEX_PERSONAL_TOKEN || '';
    
    if (!this.personalToken) {
      throw new Error('WEBEX_PERSONAL_TOKEN environment variable is required');
    }

    this.client = axios.create({
      baseURL: 'https://webexapis.com/v1',
      headers: {
        'Authorization': `Bearer ${this.personalToken}`,
        'Content-Type': 'application/json',
      },
    });

    this.roomFilter = new RoomFilterService();
  }

  async initialize(): Promise<void> {
    try {
      // Verify personal token by getting user info
      const response = await this.client.get('/people/me');
      console.error(`WebEx personal token initialized: ${response.data.displayName} (${response.data.emails[0]})`);
    } catch (error) {
      throw new Error(`Failed to initialize WebEx service: ${error}`);
    }
  }

  private async collectRoomMetadata(rooms: WebexRoom[]): Promise<Map<string, RoomMetadata>> {
    const metadata = new Map<string, RoomMetadata>();
    const urgencyKeywords = (process.env.URGENCY_KEYWORDS || 'urgent,asap,critical,production,down,incident,emergency').split(',');
    const sinceTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Last 7 days

    for (const room of rooms) {
      try {
        // Get recent messages for activity analysis
        const messagesResponse = await this.client.get('/messages', {
          params: { roomId: room.id, max: 20 }
        });

        const messages = messagesResponse.data.items || [];
        const recentMessages = messages.filter((msg: any) => new Date(msg.created) > sinceTime);
        
        // Check for urgent keywords
        const urgentMessages = messages.filter((msg: any) => {
          const text = (msg.text || '').toLowerCase();
          return urgencyKeywords.some(keyword => text.includes(keyword.toLowerCase()));
        });

        // Get member count
        let memberCount;
        try {
          const membershipsResponse = await this.client.get('/memberships', {
            params: { roomId: room.id }
          });
          memberCount = membershipsResponse.data.items.length;
        } catch {
          memberCount = undefined;
        }

        metadata.set(room.id, {
          id: room.id,
          title: room.title || 'Unknown Room',
          type: room.type,
          memberCount,
          lastActivity: room.lastActivity,
          recentMessageCount: recentMessages.length,
          isArchived: room.isLocked || false,
          hasUrgentKeywords: urgentMessages.length > 0,
          urgentMessageCount: urgentMessages.length,
          score: 0,
          filterReason: ''
        });
      } catch (error) {
        // Create minimal metadata for rooms we can't access
        metadata.set(room.id, {
          id: room.id,
          title: room.title || 'Unknown Room',
          type: room.type,
          memberCount: 0,
          lastActivity: room.lastActivity || new Date().toISOString(),
          recentMessageCount: 0,
          isArchived: true,
          hasUrgentKeywords: false,
          urgentMessageCount: 0,
          score: 0,
          filterReason: 'Access error'
        });
      }
    }

    return metadata;
  }

  async getUrgentMessages(limit: number = 10, sinceHours: number = 1): Promise<WebexMessage[]> {
    const sinceTime = new Date(Date.now() - sinceHours * 60 * 60 * 1000);
    
    try {
      // Get all rooms and collect metadata
      const roomsResponse = await this.client.get('/rooms');
      const allRooms: WebexRoom[] = roomsResponse.data.items;
      
      // Collect room metadata and apply filtering
      const roomMetadata = await this.collectRoomMetadata(allRooms);
      const filterResult = await this.roomFilter.filterRooms(allRooms, roomMetadata);

      const allMessages: WebexMessage[] = [];
      const accessibleRooms: string[] = [];
      const inaccessibleRooms: string[] = [];

      // Only process filtered/monitored rooms
      for (const roomMeta of filterResult.monitoredRooms) {
        const room = allRooms.find(r => r.id === roomMeta.id);
        if (!room) continue;
        
        try {
          const messagesResponse = await this.client.get(`/messages`, {
            params: {
              roomId: roomMeta.id,
              max: 50, // WebEx API limit
            },
          });

          const roomMessages: WebexMessage[] = messagesResponse.data.items
            .filter((msg: any) => new Date(msg.created) > sinceTime)
            .map((msg: any) => this.mapWebexMessage(msg, room));

          allMessages.push(...roomMessages);
          accessibleRooms.push(room.title || room.id);
        } catch (error: any) {
          // Only log non-403 errors as actual errors
          if (error?.response?.status === 403) {
            inaccessibleRooms.push(room.title || room.id);
            // Skip rooms without access (shouldn't happen with personal token)
          } else {
            console.error(`Error fetching messages from room ${room.title || room.id}:`, error?.message || error);
          }
        }
      }

      // Log summary of filtered room processing
      console.error(`✓ Processed ${filterResult.stats.monitoredCount}/${filterResult.stats.totalRooms} filtered rooms`);
      if (filterResult.stats.priorityCount > 0) {
        console.error(`  Priority rooms: ${filterResult.stats.priorityCount}`);
      }
      if (filterResult.stats.droppedDueToLimit > 0) {
        console.error(`  Dropped due to limit: ${filterResult.stats.droppedDueToLimit}`);
      }

      // Sort by urgency score and creation time
      const urgentMessages = allMessages
        .filter(msg => this.isMessageUrgent(msg))
        .sort((a, b) => {
          const urgencyDiff = (b.urgencyScore || 0) - (a.urgencyScore || 0);
          if (urgencyDiff !== 0) return urgencyDiff;
          return new Date(b.created).getTime() - new Date(a.created).getTime();
        })
        .slice(0, limit);

      return urgentMessages;
    } catch (error) {
      throw new Error(`Failed to fetch urgent messages: ${error}`);
    }
  }

  async sendMessage(roomId: string, message: string, replyToMessageId?: string): Promise<{ id: string }> {
    try {
      const payload: any = {
        roomId,
        text: message,
      };

      if (replyToMessageId) {
        payload.parentId = replyToMessageId;
      }

      // Check auto-response limits

      const response = await this.client.post('/messages', payload);

      return { id: response.data.id };
    } catch (error) {
      throw new Error(`Failed to send message: ${error}`);
    }
  }

  async getRoomContext(roomId: string, messageCount: number = 10): Promise<{
    room: WebexRoom;
    messages: WebexMessage[];
    participants: WebexPerson[];
  }> {
    try {
      // Get room details
      const roomResponse = await this.client.get(`/rooms/${roomId}`);
      const room: WebexRoom = roomResponse.data;

      // Get recent messages
      const messagesResponse = await this.client.get('/messages', {
        params: {
          roomId,
          max: messageCount,
        },
      });

      const messages: WebexMessage[] = messagesResponse.data.items
        .map((msg: any) => this.mapWebexMessage(msg, room));

      // Get room participants
      const membershipsResponse = await this.client.get('/memberships', {
        params: {
          roomId,
        },
      });

      const participantIds = membershipsResponse.data.items.map((m: any) => m.personId);
      const participants: WebexPerson[] = [];

      // Get participant details (limited to avoid rate limits)
      for (const personId of participantIds.slice(0, 10)) {
        try {
          const personResponse = await this.client.get(`/people/${personId}`);
          participants.push(personResponse.data);
        } catch (error) {
          console.error(`Error fetching person ${personId}:`, error);
        }
      }

      return {
        room,
        messages,
        participants,
      };
    } catch (error) {
      throw new Error(`Failed to get room context: ${error}`);
    }
  }

  async markAsHandled(messageId: string): Promise<void> {
    this.handledMessages.add(messageId);
    // Note: WebEx doesn't have a native "mark as handled" API
    // This is tracked locally in the service
  }

  async getRoomMonitoringStats(): Promise<any> {
    try {
      const roomsResponse = await this.client.get('/rooms');
      const allRooms: WebexRoom[] = roomsResponse.data.items;
      
      const roomMetadata = await this.collectRoomMetadata(allRooms);
      const filterResult = await this.roomFilter.filterRooms(allRooms, roomMetadata);
      
      return {
        configuration: this.roomFilter.getConfig(),
        statistics: this.roomFilter.getStats(),
        monitoredRooms: filterResult.monitoredRooms.map(r => ({
          title: r.title,
          score: r.score,
          reason: r.filterReason,
          hasUrgentContent: r.hasUrgentKeywords,
          recentMessages: r.recentMessageCount
        })),
        excludedRooms: filterResult.excludedRooms.slice(0, 10).map(r => ({
          title: r.title,
          reason: r.filterReason,
          score: r.score
        }))
      };
    } catch (error) {
      throw new Error(`Failed to get room monitoring stats: ${error}`);
    }
  }

  clearRoomFilterCache(): void {
    this.roomFilter.clearCache();
  }


  private mapWebexMessage(webexMsg: any, room?: WebexRoom): WebexMessage {
    const message: WebexMessage = {
      id: webexMsg.id,
      roomId: webexMsg.roomId,
      roomType: webexMsg.roomType,
      roomTitle: room?.title,
      text: webexMsg.text,
      markdown: webexMsg.markdown,
      html: webexMsg.html,
      personId: webexMsg.personId,
      personEmail: webexMsg.personEmail,
      personDisplayName: webexMsg.personDisplayName,
      created: webexMsg.created,
      updated: webexMsg.updated,
      mentionedPeople: webexMsg.mentionedPeople,
      mentionedGroups: webexMsg.mentionedGroups,
      attachments: webexMsg.attachments,
      isHandled: this.handledMessages.has(webexMsg.id),
    };

    // Calculate urgency score
    message.urgencyScore = this.calculateUrgencyScore(message);
    message.isUrgent = message.urgencyScore > 0.6; // Threshold for urgency

    return message;
  }

  private isMessageUrgent(message: WebexMessage): boolean {
    return message.isUrgent || false;
  }

  // HARD FILTER: Boolean urgency detection based on URGENCY_KEYWORDS priority
  private isMessageCriticallyUrgent(message: WebexMessage): boolean {
    const text = (message.text || '').toLowerCase();
    const urgencyKeywords = (process.env.URGENCY_KEYWORDS || 'urgent,asap,critical,production,down,incident,emergency,help,broken,failed,error,outage,sev1,p1').split(',');
    const highPrioritySenders = (process.env.HIGH_PRIORITY_SENDERS || '').split(',').filter(s => s.length > 0);

    // PRIORITY 1: URGENCY_KEYWORDS - Absolute priority
    for (const keyword of urgencyKeywords) {
      if (text.includes(keyword.toLowerCase().trim())) {
        return true; // Hard filter - this is urgent, period
      }
    }

    // PRIORITY 2: High priority senders with any mention
    if (highPrioritySenders.includes(message.personEmail)) {
      return true;
    }

    // PRIORITY 3: Direct mentions during off-hours
    if (message.mentionedPeople && message.mentionedPeople.length > 0) {
      const messageTime = new Date(message.created);
      const hour = messageTime.getHours();
      const isOffHours = hour < 9 || hour > 17;
      const isWeekend = messageTime.getDay() === 0 || messageTime.getDay() === 6;
      
      if (isOffHours || isWeekend) {
        return true; // Mentions during off-hours are urgent
      }
    }

    return false; // Not urgent
  }

  private getUrgencyReasons(message: WebexMessage): string[] {
    const reasons: string[] = [];
    const text = (message.text || '').toLowerCase();
    const urgencyKeywords = (process.env.URGENCY_KEYWORDS || 'urgent,asap,critical,production,down,incident,emergency,help,broken,failed,error,outage,sev1,p1').split(',');
    const highPrioritySenders = (process.env.HIGH_PRIORITY_SENDERS || '').split(',').filter(s => s.length > 0);

    // Check for urgency keywords
    const matchedKeywords = urgencyKeywords.filter(keyword => 
      text.includes(keyword.toLowerCase().trim())
    );
    
    if (matchedKeywords.length > 0) {
      reasons.push(`Contains urgency keywords: ${matchedKeywords.join(', ')}`);
      
      // Flag critical emergencies
      const emergencyKeywords = ['production', 'down', 'outage', 'sev1', 'p1', 'critical', 'emergency'];
      if (matchedKeywords.some(k => emergencyKeywords.includes(k.toLowerCase()))) {
        reasons.push('CRITICAL: Production/emergency issue detected');
      }
    }

    // Check high priority sender
    if (highPrioritySenders.includes(message.personEmail)) {
      reasons.push(`High priority sender: ${message.personDisplayName || message.personEmail}`);
    }

    // Check mentions during off-hours
    if (message.mentionedPeople && message.mentionedPeople.length > 0) {
      const messageTime = new Date(message.created);
      const hour = messageTime.getHours();
      const isOffHours = hour < 9 || hour > 17;
      const isWeekend = messageTime.getDay() === 0 || messageTime.getDay() === 6;
      
      if (isOffHours) {
        reasons.push('Direct mention during off-hours');
      }
      if (isWeekend) {
        reasons.push('Direct mention during weekend');
      }
      if (!isOffHours && !isWeekend) {
        reasons.push('Direct mention during business hours');
      }
    }

    return reasons;
  }

  private calculateUrgencyScore(message: WebexMessage): number {
    // Keep this for backward compatibility, but now it's just a boolean conversion
    return this.isMessageCriticallyUrgent(message) ? 1.0 : 0.0;
  }


  async getMessageById(messageId: string): Promise<WebexMessage | null> {
    try {
      const response = await this.client.get(`/messages/${messageId}`);
      return this.mapWebexMessage(response.data);
    } catch (error) {
      console.error(`Error fetching message ${messageId}:`, error);
      return null;
    }
  }

  async getPersonalTokenDiagnostics(): Promise<{
    userInfo: {
      id: string;
      displayName: string;
      emails: string[];
      created: string;
      type: string;
      status: string;
    };
    tokenScopes: string[];
    permissions: {
      canListRooms: boolean;
      canReadMessages: boolean;
      canSendMessages: boolean;
      canManageMemberships: boolean;
    };
    organizationAnalysis: {
      likely403Cause: 'MISSING_SCOPE' | 'ORG_POLICY' | 'NOT_ROOM_MEMBER' | 'TOKEN_INVALID' | 'UNKNOWN';
      evidence: string[];
      orgRestrictionsDetected: boolean;
      botInRoomsButCantRead: boolean;
    };
    detailedTests: {
      tokenValidityTest: { passed: boolean; details: string };
      roomMembershipTest: { passed: boolean; details: string; testedRooms: number };
      messageReadTest: { passed: boolean; details: string; errorCode?: number };
      scopeInferenceTest: { details: string; inferredScopes: string[] };
    };
    recommendations: string[];
  }> {
    try {
      // DETAILED DIAGNOSTIC TESTS
      const detailedTests = {
        tokenValidityTest: { passed: false, details: '' },
        roomMembershipTest: { passed: false, details: '', testedRooms: 0 },
        messageReadTest: { passed: false, details: '', errorCode: undefined as number | undefined },
        scopeInferenceTest: { details: '', inferredScopes: [] as string[] },
      };

      const organizationAnalysis = {
        likely403Cause: 'UNKNOWN' as 'MISSING_SCOPE' | 'ORG_POLICY' | 'NOT_ROOM_MEMBER' | 'TOKEN_INVALID' | 'UNKNOWN',
        evidence: [] as string[],
        orgRestrictionsDetected: false,
        botInRoomsButCantRead: false,
      };

      // TEST 1: Personal Token Validity Test
      let userInfo: any;
      try {
        const userResponse = await this.client.get('/people/me');
        userInfo = userResponse.data;
        detailedTests.tokenValidityTest = {
          passed: true,
          details: `✅ Personal token valid for user: ${userInfo.displayName} (${userInfo.emails[0]})`
        };
        organizationAnalysis.evidence.push('Token successfully authenticates');
      } catch (error: any) {
        detailedTests.tokenValidityTest = {
          passed: false,
          details: `❌ Token invalid: ${error?.response?.status} - ${error?.message}`
        };
        organizationAnalysis.likely403Cause = 'TOKEN_INVALID';
        organizationAnalysis.evidence.push(`Token fails authentication: ${error?.response?.status}`);
      }

      // TEST 2: Room Listing Test (Scope Inference)
      const permissions = {
        canListRooms: false,
        canReadMessages: false,
        canSendMessages: false,
        canManageMemberships: false,
      };

      let allRooms: any[] = [];
      try {
        const roomsResponse = await this.client.get('/rooms');
        allRooms = roomsResponse.data.items || [];
        permissions.canListRooms = true;
        detailedTests.scopeInferenceTest.inferredScopes.push('spark:rooms_read');
        organizationAnalysis.evidence.push(`Can list ${allRooms.length} rooms - has spark:rooms_read scope`);
      } catch (error: any) {
        organizationAnalysis.evidence.push(`Cannot list rooms: ${error?.response?.status} - missing spark:rooms_read`);
      }

      // TEST 3: Membership Test - Check if bot is actually in rooms
      let botInRoomsCount = 0;
      let roomsWithMembershipAccess = 0;
      const userEmail = userInfo?.emails[0];

      for (const room of allRooms.slice(0, 3)) { // Test first 3 rooms
        try {
          const membershipsResponse = await this.client.get('/memberships', {
            params: { roomId: room.id }
          });
          roomsWithMembershipAccess++;
          
          // Check if user is actually a member
          const userMembership = membershipsResponse.data.items.find((member: any) => 
            member.personEmail === userEmail
          );
          
          if (userMembership) {
            botInRoomsCount++;
            organizationAnalysis.evidence.push(`✅ User has access to room: ${room.title || room.id}`);
          } else {
            organizationAnalysis.evidence.push(`❌ User NOT member of room: ${room.title || room.id}`);
          }
          
        } catch (error: any) {
          if (error?.response?.status === 403) {
            organizationAnalysis.evidence.push(`Cannot check membership for ${room.title}: 403 Forbidden`);
          }
        }
      }

      detailedTests.roomMembershipTest = {
        passed: botInRoomsCount > 0,
        details: `User has access to ${botInRoomsCount}/${allRooms.slice(0, 3).length} tested rooms`,
        testedRooms: Math.min(allRooms.length, 3)
      };

      if (roomsWithMembershipAccess > 0) {
        detailedTests.scopeInferenceTest.inferredScopes.push('spark:memberships_read');
        permissions.canManageMemberships = true;
      }

      // TEST 4: Message Reading Test - The critical test
      let messageReadErrorCode: number | undefined;
      let messageReadAttempts = 0;
      
      for (const room of allRooms.slice(0, 3)) {
        try {
          await this.client.get('/messages', { params: { roomId: room.id, max: 1 } });
          permissions.canReadMessages = true;
          detailedTests.scopeInferenceTest.inferredScopes.push('spark:messages_read');
          organizationAnalysis.evidence.push(`✅ Successfully read messages from room: ${room.title || room.id}`);
          break; // Success - no need to test more rooms
        } catch (error: any) {
          messageReadErrorCode = error?.response?.status;
          messageReadAttempts++;
          
          if (error?.response?.status === 403) {
            organizationAnalysis.evidence.push(`❌ 403 Forbidden reading messages from room: ${room.title || room.id}`);
          }
        }
      }

      detailedTests.messageReadTest = {
        passed: permissions.canReadMessages,
        details: permissions.canReadMessages 
          ? `✅ Can read messages from rooms`
          : `❌ Cannot read messages from ${messageReadAttempts} tested rooms`,
        errorCode: messageReadErrorCode
      };

      // ANALYSIS: Determine Root Cause
      if (permissions.canListRooms && botInRoomsCount > 0 && !permissions.canReadMessages) {
        // User can list rooms, is member of rooms, but can't read messages (unusual for personal token)
        organizationAnalysis.likely403Cause = 'ORG_POLICY';
        organizationAnalysis.orgRestrictionsDetected = true;
        organizationAnalysis.botInRoomsButCantRead = true;
        organizationAnalysis.evidence.push('🚨 ORGANIZATION POLICY: User has room access but cannot read messages');
        organizationAnalysis.evidence.push('This indicates unusual restrictions on personal token access');
      } else if (permissions.canListRooms && botInRoomsCount === 0) {
        organizationAnalysis.likely403Cause = 'NOT_ROOM_MEMBER';
        organizationAnalysis.evidence.push('User can list rooms but is not member of tested rooms');
      } else if (!permissions.canListRooms) {
        organizationAnalysis.likely403Cause = 'TOKEN_INVALID';
        organizationAnalysis.evidence.push('Personal token cannot perform basic API operations');
      } else if (permissions.canListRooms && !permissions.canReadMessages && messageReadErrorCode === 403) {
        organizationAnalysis.likely403Cause = 'MISSING_SCOPE';
        organizationAnalysis.evidence.push('Personal token may lack required scopes or org policy blocks access');
      }

      detailedTests.scopeInferenceTest.details = `Inferred scopes: ${detailedTests.scopeInferenceTest.inferredScopes.join(', ')}`;

      // RECOMMENDATIONS based on analysis
      const recommendations: string[] = [];
      
      switch (organizationAnalysis.likely403Cause) {
        case 'ORG_POLICY':
          recommendations.push('🚨 ROOT CAUSE: Organization policy restricts personal token access (unusual)');
          recommendations.push('🔧 SOLUTION: Contact WebEx organization administrator');
          recommendations.push('📋 REQUEST: Ask admin about personal token restrictions');
          recommendations.push('🏢 ALTERNATIVE: Try generating a new personal token');
          recommendations.push('⚙️ ALTERNATIVE: Use different WebEx account if available');
          break;
          
        case 'NOT_ROOM_MEMBER':
          recommendations.push('🔧 SOLUTION: Personal token should have access to your rooms automatically');
          recommendations.push(`📧 USER EMAIL: ${userEmail}`);
          recommendations.push('👥 CHECK: Verify you have access to the rooms in WebEx Teams app');
          break;
          
        case 'MISSING_SCOPE':
          recommendations.push('🔧 SOLUTION: Personal token should have full user permissions');
          recommendations.push('🔄 ACTION: Generate new personal access token from developer.webex.com');
          recommendations.push('🏢 CHECK: Verify token was copied correctly from developer portal');
          break;
          
        case 'TOKEN_INVALID':
          recommendations.push('🔧 SOLUTION: Generate new personal access token');
          recommendations.push('🌐 PORTAL: Visit developer.webex.com/docs/getting-started');
          break;
          
        default:
          recommendations.push('🔍 Run additional diagnostics to identify issue');
          recommendations.push('📞 Contact WebEx support if problems persist with personal token');
      }

      // Personal tokens have full user scopes (WebEx API doesn't expose this directly)
      const expectedScopes = [
        'spark:rooms_read',
        'spark:messages_read', 
        'spark:messages_write',
        'spark:memberships_read',
        'spark:people_read'
      ];

      return {
        userInfo: {
          id: userInfo?.id || 'unknown',
          displayName: userInfo?.displayName || 'unknown',
          emails: userInfo?.emails || ['unknown'],
          created: userInfo?.created || 'unknown',
          type: userInfo?.type || 'unknown',
          status: userInfo?.status || 'unknown',
        },
        tokenScopes: expectedScopes,
        permissions,
        organizationAnalysis,
        detailedTests,
        recommendations,
      };

    } catch (error: any) {
      throw new Error(`Failed to run personal token diagnostics: ${error?.response?.data?.message || error.message}`);
    }
  }

  async getRoomsInfo(): Promise<{
    totalRooms: number;
    accessibleRooms: Array<{
      id: string;
      title: string;
      type: 'group' | 'direct';
      isTeamRoom: boolean;
      lastActivity: string;
      created: string;
      memberCount?: number;
      recentMessageCount: number;
      hasUrgentKeywords: boolean;
    }>;
    inaccessibleRooms: Array<{
      id: string;
      title: string;
      type: 'group' | 'direct';
      error: string;
    }>;
    stats: {
      accessibleCount: number;
      inaccessibleCount: number;
      groupRooms: number;
      directRooms: number;
      roomsWithRecentActivity: number;
      roomsWithUrgentContent: number;
    };
  }> {
    try {
      // Get all rooms where the bot is a member
      const roomsResponse = await this.client.get('/rooms');
      const allRooms: WebexRoom[] = roomsResponse.data.items;
      
      const accessibleRooms: any[] = [];
      const inaccessibleRooms: any[] = [];
      const urgencyKeywords = (process.env.URGENCY_KEYWORDS || 'urgent,asap,critical,production,down,incident,emergency,help,broken,failed,error,outage,sev1,p1').split(',');
      
      // Test access to each room and gather metadata
      for (const room of allRooms) {
        try {
          // Try to get recent messages to test accessibility
          const messagesResponse = await this.client.get('/messages', {
            params: {
              roomId: room.id,
              max: 5, // Just a few messages to test access
            },
          });
          
          const messages = messagesResponse.data.items;
          
          // Check if room has urgent keywords in recent messages
          const hasUrgentKeywords = messages.some((msg: any) => {
            const text = (msg.text || '').toLowerCase();
            return urgencyKeywords.some(keyword => 
              text.includes(keyword.toLowerCase().trim())
            );
          });
          
          // Try to get member count
          let memberCount;
          try {
            const membershipsResponse = await this.client.get('/memberships', {
              params: { roomId: room.id },
            });
            memberCount = membershipsResponse.data.items.length;
          } catch {
            memberCount = undefined; // Can't access membership info
          }
          
          accessibleRooms.push({
            id: room.id,
            title: room.title || (room.type === 'direct' ? 'Direct Message' : 'Unnamed Room'),
            type: room.type,
            isTeamRoom: room.isLocked || false,
            lastActivity: room.lastActivity,
            created: room.created,
            memberCount,
            recentMessageCount: messages.length,
            hasUrgentKeywords,
          });
          
        } catch (error: any) {
          let errorMsg = 'Unknown error';
          if (error?.response?.status === 403) {
            errorMsg = '403 Forbidden - Bot not added to room as member';
          } else if (error?.response?.status === 401) {
            errorMsg = '401 Unauthorized - Invalid bot token';
          } else if (error?.response?.status === 404) {
            errorMsg = '404 Not Found - Room may have been deleted';
          } else {
            errorMsg = `${error?.response?.status || 'Error'}: ${error?.message || 'Unknown error'}`;
          }
          
          inaccessibleRooms.push({
            id: room.id,
            title: room.title || (room.type === 'direct' ? 'Direct Message' : 'Unnamed Room'),
            type: room.type,
            error: errorMsg,
          });
        }
      }
      
      // Calculate statistics
      const stats = {
        accessibleCount: accessibleRooms.length,
        inaccessibleCount: inaccessibleRooms.length,
        groupRooms: [...accessibleRooms, ...inaccessibleRooms].filter(r => r.type === 'group').length,
        directRooms: [...accessibleRooms, ...inaccessibleRooms].filter(r => r.type === 'direct').length,
        roomsWithRecentActivity: accessibleRooms.filter(r => {
          const lastActivity = new Date(r.lastActivity);
          const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
          return lastActivity > oneDayAgo;
        }).length,
        roomsWithUrgentContent: accessibleRooms.filter(r => r.hasUrgentKeywords).length,
      };
      
      // Sort accessible rooms by last activity
      accessibleRooms.sort((a, b) => 
        new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
      );
      
      return {
        totalRooms: allRooms.length,
        accessibleRooms,
        inaccessibleRooms,
        stats,
      };
      
    } catch (error) {
      throw new Error(`Failed to get rooms info: ${error}`);
    }
  }

  async getAllMessageSummaries(sinceHours: number = 24, maxPerRoom: number = 10): Promise<{
    urgentMessages: Array<{
      id: string;
      roomId: string;
      roomTitle: string;
      sender: string;
      text: string;
      created: string;
      urgencyReasons: string[];
      requiresImmediate: boolean;
    }>;
    roomSummaries: Array<{
      id: string;
      title: string;
      type: 'group' | 'direct';
      unreadCount: number;
      lastActivity: string;
      latestMessages: WebexMessage[];
      summary: string;
    }>;
    stats: {
      totalUrgent: number;
      totalRoomsSummary: number;
      totalMessages: number;
      accessibleRooms: number;
      inaccessibleRooms: number;
    };
  }> {
    const sinceTime = new Date(Date.now() - sinceHours * 60 * 60 * 1000);
    
    try {
      // Get all rooms
      const roomsResponse = await this.client.get('/rooms');
      const rooms: WebexRoom[] = roomsResponse.data.items;
      
      const urgentMessages: any[] = [];
      const roomSummaries: any[] = [];
      let totalMessages = 0;
      let accessibleRooms = 0;
      let inaccessibleRooms = 0;
      
      // STEP 1: Scan ALL rooms for URGENT messages first (priority filter)
      for (const room of rooms) {
        try {
          // Get messages from this room
          const messagesResponse = await this.client.get('/messages', {
            params: {
              roomId: room.id,
              max: maxPerRoom,
            },
          });
          
          const messages: WebexMessage[] = messagesResponse.data.items
            .map((msg: any) => this.mapWebexMessage(msg, room))
            .filter((msg: WebexMessage) => new Date(msg.created) > sinceTime);
          
          accessibleRooms++;
          totalMessages += messages.length;
          
          // PRIORITY CHECK: Extract URGENT messages using hard filter
          const roomUrgentMessages = messages.filter(msg => this.isMessageCriticallyUrgent(msg));
          
          for (const urgentMsg of roomUrgentMessages) {
            const urgencyReasons = this.getUrgencyReasons(urgentMsg);
            urgentMessages.push({
              id: urgentMsg.id,
              roomId: urgentMsg.roomId,
              roomTitle: room.title || (room.type === 'direct' ? 'Direct Message' : 'Unnamed Room'),
              sender: urgentMsg.personDisplayName || urgentMsg.personEmail,
              text: urgentMsg.text || '',
              created: urgentMsg.created,
              urgencyReasons,
              requiresImmediate: urgencyReasons.some(r => r.includes('emergency') || r.includes('critical')),
            });
          }
          
          // STEP 2: Create summaries for remaining (non-urgent) messages
          const nonUrgentMessages = messages.filter(msg => !this.isMessageCriticallyUrgent(msg));
          
          if (nonUrgentMessages.length > 0) {
            const senders = [...new Set(nonUrgentMessages.map(m => m.personDisplayName || m.personEmail))];
            const topics = this.extractTopics(nonUrgentMessages);
            
            const summary = `${nonUrgentMessages.length} non-urgent message${nonUrgentMessages.length > 1 ? 's' : ''} from ${senders.slice(0, 3).join(', ')}${senders.length > 3 ? ` and ${senders.length - 3} others` : ''}${topics ? `. Topics: ${topics}` : ''}`;
            
            roomSummaries.push({
              id: room.id,
              title: room.title || (room.type === 'direct' ? 'Direct Message' : 'Unnamed Room'),
              type: room.type,
              unreadCount: nonUrgentMessages.length,
              lastActivity: room.lastActivity,
              latestMessages: nonUrgentMessages.slice(-3), // Last 3 non-urgent messages
              summary,
            });
          }
          
        } catch (error: any) {
          if (error?.response?.status === 403) {
            inaccessibleRooms++;
          } else {
            console.error(`Error fetching messages from room ${room.title || room.id}:`, error?.message);
          }
        }
      }
      
      // Sort urgent messages by criticality, then by time
      urgentMessages.sort((a, b) => {
        if (a.requiresImmediate !== b.requiresImmediate) {
          return a.requiresImmediate ? -1 : 1; // Immediate first
        }
        return new Date(b.created).getTime() - new Date(a.created).getTime(); // Newest first
      });
      
      // Sort room summaries by last activity
      roomSummaries.sort((a, b) => 
        new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
      );
      
      return {
        urgentMessages,
        roomSummaries,
        stats: {
          totalUrgent: urgentMessages.length,
          totalRoomsSummary: roomSummaries.length,
          totalMessages,
          accessibleRooms,
          inaccessibleRooms,
        },
      };
    } catch (error) {
      throw new Error(`Failed to fetch prioritized message summaries: ${error}`);
    }
  }
  
  private extractTopics(messages: WebexMessage[]): string {
    // Extract potential topics from messages
    const allText = messages.map(m => m.text || '').join(' ').toLowerCase();
    
    // Look for common topic patterns
    const topics: string[] = [];
    
    // Check for questions
    if (allText.includes('?')) topics.push('questions');
    
    // Check for urgency
    const urgencyWords = ['urgent', 'asap', 'critical', 'important', 'emergency'];
    if (urgencyWords.some(word => allText.includes(word))) topics.push('urgent');
    
    // Check for common work topics
    if (allText.includes('meeting') || allText.includes('call')) topics.push('meeting');
    if (allText.includes('review') || allText.includes('feedback')) topics.push('review');
    if (allText.includes('issue') || allText.includes('problem') || allText.includes('bug')) topics.push('issues');
    if (allText.includes('deploy') || allText.includes('release')) topics.push('deployment');
    
    return topics.slice(0, 3).join(', ');
  }
}