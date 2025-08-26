import { WebexRoom } from '../types/webex.js';

export interface RoomMetadata {
  id: string;
  title: string;
  type: 'group' | 'direct';
  memberCount?: number;
  lastActivity: string;
  recentMessageCount: number;
  isArchived: boolean;
  hasUrgentKeywords: boolean;
  urgentMessageCount: number;
  score: number;
  filterReason: string;
}

export interface FilterConfig {
  priorityRooms: string[];
  includePatterns: string[];
  excludePatterns: string[];
  maxMonitoredRooms: number;
  minActivityMessages: number;
  minActivityDays: number;
  skipDirectMessages: boolean;
  cacheMinutes: number;
}

export interface FilterResult {
  monitoredRooms: RoomMetadata[];
  excludedRooms: RoomMetadata[];
  stats: {
    totalRooms: number;
    monitoredCount: number;
    priorityCount: number;
    patternMatchedCount: number;
    droppedDueToLimit: number;
  };
  lastRefresh: Date;
}

export class RoomFilterService {
  private config: FilterConfig;
  private cachedResult: FilterResult | null = null;
  private cacheExpiry: Date | null = null;
  private urgencyKeywords: string[];

  constructor() {
    this.config = this.loadConfiguration();
    this.urgencyKeywords = (process.env.URGENCY_KEYWORDS || 'urgent,asap,critical,production,down,incident,emergency').split(',');
  }

  private loadConfiguration(): FilterConfig {
    return {
      priorityRooms: this.parseList(process.env.WEBEX_PRIORITY_ROOMS),
      includePatterns: this.parseList(process.env.WEBEX_INCLUDE_PATTERNS),
      excludePatterns: this.parseList(process.env.WEBEX_EXCLUDE_PATTERNS),
      maxMonitoredRooms: parseInt(process.env.WEBEX_MAX_MONITORED_ROOMS || '25'),
      minActivityMessages: parseInt(process.env.WEBEX_MIN_ACTIVITY_MESSAGES || '5'),
      minActivityDays: parseInt(process.env.WEBEX_MIN_ACTIVITY_DAYS || '7'),
      skipDirectMessages: process.env.WEBEX_SKIP_DIRECT_MESSAGES !== 'false',
      cacheMinutes: parseInt(process.env.WEBEX_CACHE_ROOM_LIST_MINUTES || '30'),
    };
  }

  private parseList(value: string | undefined): string[] {
    return value ? value.split(',').map(s => s.trim()).filter(Boolean) : [];
  }

  async filterRooms(allRooms: WebexRoom[], roomMetadata: Map<string, RoomMetadata>): Promise<FilterResult> {
    if (this.cachedResult && this.cacheExpiry && new Date() < this.cacheExpiry) {
      return this.cachedResult;
    }

    const stats = { totalRooms: allRooms.length, monitoredCount: 0, priorityCount: 0, patternMatchedCount: 0, droppedDueToLimit: 0 };
    const monitoredRooms: RoomMetadata[] = [];
    const excludedRooms: RoomMetadata[] = [];
    const prioritySet = new Set<string>();

    // Phase 1: Priority rooms (always included)
    for (const identifier of this.config.priorityRooms) {
      const room = allRooms.find(r => r.id === identifier || r.title?.toLowerCase() === identifier.toLowerCase());
      if (room && roomMetadata.has(room.id)) {
        const metadata = roomMetadata.get(room.id)!;
        metadata.filterReason = 'Priority room';
        prioritySet.add(room.id);
        monitoredRooms.push(metadata);
        stats.priorityCount++;
      }
    }

    // Phase 2-4: Filter remaining rooms
    const candidates: RoomMetadata[] = [];
    
    for (const room of allRooms) {
      if (prioritySet.has(room.id)) continue;
      
      const metadata = roomMetadata.get(room.id);
      if (!metadata) continue;

      // Skip direct messages if configured
      if (this.config.skipDirectMessages && room.type === 'direct') {
        metadata.filterReason = 'Direct message skipped';
        excludedRooms.push(metadata);
        continue;
      }

      // Apply exclude patterns
      if (this.matchesPatterns(room.title || '', this.config.excludePatterns)) {
        metadata.filterReason = 'Matches exclude pattern';
        excludedRooms.push(metadata);
        continue;
      }

      // Check include patterns
      const matchesInclude = this.config.includePatterns.length === 0 || 
                           this.matchesPatterns(room.title || '', this.config.includePatterns);
      
      if (!matchesInclude) {
        metadata.filterReason = 'No include pattern match';
        excludedRooms.push(metadata);
        continue;
      }

      // Activity filter
      if (!this.passesActivityFilter(metadata)) {
        metadata.filterReason = 'Low activity';
        excludedRooms.push(metadata);
        continue;
      }

      metadata.score = this.calculateScore(metadata);
      candidates.push(metadata);
    }

    // Sort and apply limits
    candidates.sort((a, b) => b.score - a.score);
    const limit = this.config.maxMonitoredRooms - stats.priorityCount;

    for (let i = 0; i < candidates.length; i++) {
      if (i < limit) {
        candidates[i].filterReason = 'Passed filters';
        monitoredRooms.push(candidates[i]);
        stats.patternMatchedCount++;
      } else {
        candidates[i].filterReason = 'Limit exceeded';
        excludedRooms.push(candidates[i]);
        stats.droppedDueToLimit++;
      }
    }

    stats.monitoredCount = monitoredRooms.length;

    const result: FilterResult = { monitoredRooms, excludedRooms, stats, lastRefresh: new Date() };
    this.cachedResult = result;
    this.cacheExpiry = new Date(Date.now() + this.config.cacheMinutes * 60000);

    console.error(`Room filtering: ${stats.monitoredCount}/${stats.totalRooms} rooms monitored (${stats.priorityCount} priority)`);
    return result;
  }

  private matchesPatterns(title: string, patterns: string[]): boolean {
    if (!patterns.length) return false;
    const lowerTitle = title.toLowerCase();
    return patterns.some(pattern => {
      const regex = new RegExp('^' + pattern.toLowerCase().replace(/\*/g, '.*') + '$');
      return regex.test(lowerTitle);
    });
  }

  private passesActivityFilter(metadata: RoomMetadata): boolean {
    const cutoff = new Date(Date.now() - this.config.minActivityDays * 24 * 60 * 60 * 1000);
    return new Date(metadata.lastActivity) > cutoff && metadata.recentMessageCount >= this.config.minActivityMessages;
  }

  private calculateScore(metadata: RoomMetadata): number {
    let score = 0;
    if (metadata.hasUrgentKeywords) score += 1000;
    score += metadata.recentMessageCount * 10;
    score += (metadata.memberCount || 0) * 2;
    const daysSince = (Date.now() - new Date(metadata.lastActivity).getTime()) / 86400000;
    score += Math.max(0, 50 - daysSince);
    return score;
  }

  clearCache(): void {
    this.cachedResult = null;
    this.cacheExpiry = null;
  }

  getConfig(): FilterConfig {
    return { ...this.config };
  }

  getStats(): any {
    return this.cachedResult ? {
      ...this.cachedResult.stats,
      lastRefresh: this.cachedResult.lastRefresh,
      cacheExpiresIn: this.cacheExpiry ? Math.max(0, Math.round((this.cacheExpiry.getTime() - Date.now()) / 60000)) : 0
    } : null;
  }
}