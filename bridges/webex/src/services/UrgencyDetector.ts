import { WebexMessage } from '../types/webex.js';

export interface UrgencyAnalysis {
  score: number; // 0-1 scale
  reasoning: string;
  categories: string[];
  requiresImmediate: boolean;
  suggestedResponse?: string;
}

export class UrgencyDetector {
  private keywordPatterns: RegExp[];
  private highPriorityDomains: string[];
  private emergencyKeywords: string[];

  constructor() {
    
    // Compile urgency keyword patterns
    const urgencyKeywords = (process.env.URGENCY_KEYWORDS || 'urgent,asap,critical,production,down,incident,emergency,help,broken,failed,error,outage,sev1,p1').split(',');
    this.keywordPatterns = urgencyKeywords.map(keyword => 
      new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
    );

    this.highPriorityDomains = (process.env.HIGH_PRIORITY_DOMAINS || '').split(',').filter(d => d.length > 0);
    this.emergencyKeywords = ['production down', 'outage', 'sev1', 'p1', 'critical incident', 'emergency'];
  }

  async analyzeUrgency(message: WebexMessage): Promise<UrgencyAnalysis> {
    return this.basicUrgencyAnalysis(message);
  }

  private basicUrgencyAnalysis(message: WebexMessage): UrgencyAnalysis {
    let score = 0;
    const categories: string[] = [];
    const reasoning: string[] = [];
    
    const text = (message.text || '').toLowerCase();
    const senderDomain = message.personEmail.split('@')[1];

    // Emergency keywords (highest priority)
    for (const emergencyKeyword of this.emergencyKeywords) {
      if (text.includes(emergencyKeyword.toLowerCase())) {
        score += 0.4;
        categories.push('emergency');
        reasoning.push(`Contains emergency keyword: "${emergencyKeyword}"`);
        break;
      }
    }

    // Regular urgency keywords
    let keywordMatches = 0;
    for (const pattern of this.keywordPatterns) {
      if (pattern.test(text)) {
        keywordMatches++;
      }
    }
    
    if (keywordMatches > 0) {
      score += Math.min(keywordMatches * 0.15, 0.3);
      categories.push('keyword-urgent');
      reasoning.push(`Found ${keywordMatches} urgency keyword(s)`);
    }

    // High priority sender domain
    if (this.highPriorityDomains.includes(senderDomain)) {
      score += 0.2;
      categories.push('priority-sender');
      reasoning.push(`High priority sender domain: ${senderDomain}`);
    }

    // Direct mentions
    if (message.mentionedPeople && message.mentionedPeople.length > 0) {
      score += 0.15;
      categories.push('direct-mention');
      reasoning.push('You were directly mentioned');
    }

    // Time-based urgency
    const messageTime = new Date(message.created);
    const hour = messageTime.getHours();
    const isWeekend = messageTime.getDay() === 0 || messageTime.getDay() === 6;
    const isOffHours = hour < 9 || hour > 17;

    if (isOffHours && score > 0.2) {
      score += 0.1;
      categories.push('off-hours');
      reasoning.push('Sent during off-hours');
    }

    if (isWeekend && score > 0.2) {
      score += 0.1;
      categories.push('weekend');
      reasoning.push('Sent during weekend');
    }

    // Question urgency (questions from managers/leads are more urgent)
    if (text.includes('?') && (text.includes('when') || text.includes('status') || text.includes('update'))) {
      score += 0.1;
      categories.push('status-request');
      reasoning.push('Appears to be requesting status update');
    }

    // Short urgent messages
    if (text.length < 30 && score > 0.2) {
      score += 0.05;
      categories.push('short-urgent');
      reasoning.push('Short message with urgent content');
    }

    score = Math.min(score, 1.0);

    return {
      score,
      reasoning: reasoning.join('; '),
      categories,
      requiresImmediate: score > 0.7,
      suggestedResponse: this.generateBasicResponse(score, categories),
    };
  }

  private generateBasicResponse(score: number, categories: string[]): string {
    const templates = {
      emergency: "I'm addressing this emergency situation immediately. Will provide updates shortly.",
      incident: "Investigating this incident now. I'll respond with findings within 15 minutes.",
      'priority-sender': "Thanks for reaching out. I'm reviewing this high-priority request now.",
      'status-request': "Let me get you that status update. I'll respond within 10 minutes.",
      'direct-mention': "Thanks for the mention. I'm looking into this now.",
      default: "I've received your message and will respond shortly. Currently focused on a high-priority task.",
    };

    // Choose response based on categories
    for (const category of categories) {
      if (templates[category as keyof typeof templates]) {
        return templates[category as keyof typeof templates];
      }
    }

    if (score > 0.8) {
      return templates.emergency;
    } else if (score > 0.6) {
      return templates.incident;
    } else {
      return templates.default;
    }
  }
}