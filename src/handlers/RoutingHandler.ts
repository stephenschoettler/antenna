import { QueueManager, type Priority, type RoutingAction } from './QueueManager.js';
import { TelegramNotifier, type NotificationMessage } from './TelegramNotifier.js';
import { AutoResponder, type ResponseChannel } from './AutoResponder.js';

export interface IncomingMessage {
  sender: string;
  content: string;
  channel: 'sms' | 'email' | 'other';
  timestamp?: number;
  metadata?: Record<string, unknown>;
}

export interface RoutingRule {
  condition: (message: IncomingMessage) => boolean;
  priority: Priority;
  action: RoutingAction;
  autoResponse?: {
    template: string;
    channel: ResponseChannel;
    subject?: string;
  };
}

export interface ProcessingResult {
  messageId: number;
  action: RoutingAction;
  priority: Priority;
  notified: boolean;
  responded: boolean;
  error?: string;
}

/**
 * RoutingHandler handles the routing and processing of incoming messages
 */
export class RoutingHandler {
  private queueManager: QueueManager;
  private telegramNotifier: TelegramNotifier;
  private autoResponder: AutoResponder;
  private rules: RoutingRule[];

  constructor(
    queueManager: QueueManager,
    telegramNotifier: TelegramNotifier,
    autoResponder: AutoResponder
  ) {
    this.queueManager = queueManager;
    this.telegramNotifier = telegramNotifier;
    this.autoResponder = autoResponder;
    this.rules = [];
    
    this.initializeDefaultRules();
    
    console.log('[RoutingHandler] Initialized with', this.rules.length, 'routing rules');
  }

  /**
   * Initialize default routing rules
   */
  private initializeDefaultRules(): void {
    // Rule 1: Emergency keywords -> urgent + notify
    this.rules.push({
      condition: (msg) => {
        const urgentKeywords = ['urgent', 'emergency', '911', 'help', 'asap', 'critical'];
        const content = msg.content.toLowerCase();
        return urgentKeywords.some((keyword) => content.includes(keyword));
      },
      priority: 'urgent',
      action: 'notify',
    });

    // Rule 2: Important keywords -> high + notify
    this.rules.push({
      condition: (msg) => {
        const importantKeywords = ['important', 'priority', 'deadline', 'tomorrow'];
        const content = msg.content.toLowerCase();
        return importantKeywords.some((keyword) => content.includes(keyword));
      },
      priority: 'high',
      action: 'notify',
    });

    // Rule 3: Questions -> queue for later review
    this.rules.push({
      condition: (msg) => {
        const content = msg.content.trim();
        return content.endsWith('?') || content.toLowerCase().startsWith('can you');
      },
      priority: 'normal',
      action: 'queue',
    });

    // Rule 4: Known spam patterns -> ignore
    this.rules.push({
      condition: (msg) => {
        const spamKeywords = ['free', 'win', 'prize', 'click here', 'unsubscribe'];
        const content = msg.content.toLowerCase();
        return spamKeywords.some((keyword) => content.includes(keyword));
      },
      priority: 'low',
      action: 'ignore',
    });

    // Rule 5: Default -> queue with normal priority
    this.rules.push({
      condition: () => true, // Always matches (catch-all)
      priority: 'normal',
      action: 'queue',
    });
  }

  /**
   * Add a custom routing rule
   */
  addRule(rule: RoutingRule): void {
    // Insert before the catch-all rule (last rule)
    this.rules.splice(this.rules.length - 1, 0, rule);
    console.log('[RoutingHandler] Added custom rule, total rules:', this.rules.length);
  }

  /**
   * Remove all custom rules (keep defaults)
   */
  resetRules(): void {
    this.rules = [];
    this.initializeDefaultRules();
    console.log('[RoutingHandler] Reset to default rules');
  }

  /**
   * Find the matching rule for a message
   */
  private findMatchingRule(message: IncomingMessage): RoutingRule {
    for (const rule of this.rules) {
      if (rule.condition(message)) {
        return rule;
      }
    }
    
    // Should never happen due to catch-all rule, but just in case
    return {
      condition: () => true,
      priority: 'normal',
      action: 'queue',
    };
  }

  /**
   * Process an incoming message
   */
  async process(message: IncomingMessage): Promise<ProcessingResult> {
    const timestamp = message.timestamp || Date.now();
    
    console.log('[RoutingHandler] Processing message from', message.sender);

    try {
      // Find matching rule
      const rule = this.findMatchingRule(message);
      
      console.log(`[RoutingHandler] Matched rule: ${rule.action} with ${rule.priority} priority`);

      // Add to queue
      const messageId = this.queueManager.addToQueue(
        message.content,
        rule.priority,
        rule.action,
        message.sender,
        {
          ...message.metadata,
          channel: message.channel,
          processedAt: Date.now(),
        }
      );

      let notified = false;
      let responded = false;

      // Handle notification action
      if (rule.action === 'notify') {
        this.queueManager.markProcessing(messageId);
        
        const notification: NotificationMessage = {
          sender: message.sender,
          content: message.content,
          priority: rule.priority,
          timestamp,
          messageId,
        };

        notified = await this.telegramNotifier.sendNotification(notification);
        
        if (notified) {
          this.queueManager.markResolved(messageId);
        } else {
          this.queueManager.markFailed(messageId);
        }
      }

      // Handle auto-response action
      if (rule.action === 'auto-respond' && rule.autoResponse) {
        this.queueManager.markProcessing(messageId);
        
        const variables = {
          sender: message.sender,
          content: message.content,
          timestamp: new Date(timestamp).toLocaleString(),
        };

        const result = await this.autoResponder.sendTemplatedResponse(
          message.sender,
          rule.autoResponse.template,
          variables,
          rule.autoResponse.channel,
          rule.autoResponse.subject
        );

        responded = result.success;
        
        if (responded) {
          this.queueManager.markResolved(messageId);
        } else {
          this.queueManager.markFailed(messageId);
        }
      }

      // Ignore action: just log
      if (rule.action === 'ignore') {
        console.log('[RoutingHandler] Message ignored per routing rule');
        this.queueManager.markResolved(messageId);
      }

      // Queue action: leave as pending for manual review
      if (rule.action === 'queue') {
        console.log('[RoutingHandler] Message queued for review');
      }

      return {
        messageId,
        action: rule.action,
        priority: rule.priority,
        notified,
        responded,
      };
    } catch (err) {
      const error = err as Error;
      console.error('[RoutingHandler] Failed to process message:', error);
      
      return {
        messageId: -1,
        action: 'queue',
        priority: 'normal',
        notified: false,
        responded: false,
        error: error.message,
      };
    }
  }

  /**
   * Process a batch of messages
   */
  async processBatch(messages: IncomingMessage[]): Promise<ProcessingResult[]> {
    console.log('[RoutingHandler] Processing batch of', messages.length, 'messages');
    
    const results: ProcessingResult[] = [];
    
    for (const message of messages) {
      const result = await this.process(message);
      results.push(result);
      
      // Small delay to avoid overwhelming external APIs
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    
    console.log('[RoutingHandler] Batch processing complete');
    
    return results;
  }

  /**
   * Get pending messages that need review
   */
  getPendingMessages(limit = 50) {
    return this.queueManager.getQueue({
      status: 'pending',
      limit,
    });
  }

  /**
   * Get messages by priority
   */
  getMessagesByPriority(priority: Priority, limit = 50) {
    return this.queueManager.getQueue({
      priority,
      limit,
    });
  }

  /**
   * Get processing statistics
   */
  getStats() {
    return this.queueManager.getStats();
  }

  /**
   * Get handler statuses
   */
  getHandlerStatus() {
    return {
      telegram: this.telegramNotifier.isEnabled(),
      sms: this.autoResponder.isSMSEnabled(),
      email: this.autoResponder.isEmailEnabled(),
    };
  }
}
