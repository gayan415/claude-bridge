export interface WebexMessage {
  id: string;
  roomId: string;
  roomType: 'group' | 'direct';
  roomTitle?: string;
  text?: string;
  markdown?: string;
  html?: string;
  personId: string;
  personEmail: string;
  personDisplayName: string;
  created: string;
  updated?: string;
  mentionedPeople?: string[];
  mentionedGroups?: string[];
  attachments?: WebexAttachment[];
  isUrgent?: boolean;
  urgencyScore?: number;
  isHandled?: boolean;
}

export interface WebexAttachment {
  contentType: string;
  content: {
    type: string;
    version: string;
    body: any[];
  };
}

export interface WebexRoom {
  id: string;
  title: string;
  type: 'group' | 'direct';
  isLocked: boolean;
  lastActivity: string;
  creatorId: string;
  created: string;
  ownerId?: string;
  isAnnouncementOnly?: boolean;
  description?: string;
}

export interface WebexPerson {
  id: string;
  emails: string[];
  phoneNumbers?: string[];
  displayName: string;
  nickName?: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  orgId?: string;
  created?: string;
  lastModified?: string;
  lastActivity?: string;
  status?: string;
  type: string;
}

export interface UrgencyConfig {
  keywords: string[];
  highPrioritySenders: string[];
  timeBasedRules: {
    offHoursMultiplier: number;
    weekendMultiplier: number;
  };
  sentimentThreshold: number;
}

