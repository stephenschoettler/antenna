import TelegramBot from 'node-telegram-bot-api';
import type { Priority } from './QueueManager.js';

export interface NotificationOptions {
  threadId?: number;
  replyToMessageId?: number;
  parseMode?: 'Markdown' | 'HTML';
  disableNotification?: boolean;
}

export interface NotificationMessage {
  sender: string;
  content: string;
  priority: Priority;
  timestamp: number;
  messageId?: number;
}

/**
 * TelegramNotifier handles sending formatted notifications to Telegram
 */
export class TelegramNotifier {
  private bot: TelegramBot;
  private chatId: string;
  private enabled: boolean;

  constructor(token?: string, chatId?: string) {
    const actualToken = token || process.env.TELEGRAM_BOT_TOKEN;
    const actualChatId = chatId || process.env.TELEGRAM_CHAT_ID;

    if (!actualToken) {
      console.warn('[TelegramNotifier] Bot token not provided, notifications disabled');
      this.enabled = false;
      // Create a dummy bot instance to avoid null checks everywhere
      this.bot = {} as TelegramBot;
      this.chatId = '';
      return;
    }

    if (!actualChatId) {
      console.warn('[TelegramNotifier] Chat ID not provided, notifications disabled');
      this.enabled = false;
      this.bot = {} as TelegramBot;
      this.chatId = '';
      return;
    }

    this.bot = new TelegramBot(actualToken, { polling: false });
    this.chatId = actualChatId;
    this.enabled = true;
    
    console.log('[TelegramNotifier] Initialized with chat ID:', this.chatId);
  }

  /**
   * Get the priority emoji indicator
   */
  private getPriorityEmoji(priority: Priority): string {
    switch (priority) {
      case 'urgent':
        return '🔴';
      case 'high':
        return '🟡';
      case 'normal':
        return '🟢';
      case 'low':
        return '⚪';
      default:
        return '🔵';
    }
  }

  /**
   * Get the priority label
   */
  private getPriorityLabel(priority: Priority): string {
    return priority.toUpperCase();
  }

  /**
   * Format a message for Telegram
   */
  private formatMessage(message: NotificationMessage): string {
    const emoji = this.getPriorityEmoji(message.priority);
    const label = this.getPriorityLabel(message.priority);
    const timestamp = new Date(message.timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    let formatted = `${emoji} *${label}* from *${this.escapeMarkdown(message.sender)}*\n`;
    formatted += `📅 ${timestamp}\n`;
    
    if (message.messageId) {
      formatted += `🔗 ID: ${message.messageId}\n`;
    }
    
    formatted += `\n${this.escapeMarkdown(message.content)}`;

    return formatted;
  }

  /**
   * Escape special Markdown characters for Telegram
   */
  private escapeMarkdown(text: string): string {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/\*/g, '\\*')
      .replace(/_/g, '\\_')
      .replace(/\[/g, '\\[')
      .replace(/\]/g, '\\]')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .replace(/~/g, '\\~')
      .replace(/`/g, '\\`')
      .replace(/>/g, '\\>')
      .replace(/#/g, '\\#')
      .replace(/\+/g, '\\+')
      .replace(/-/g, '\\-')
      .replace(/=/g, '\\=')
      .replace(/\|/g, '\\|')
      .replace(/\{/g, '\\{')
      .replace(/\}/g, '\\}')
      .replace(/\./g, '\\.')
      .replace(/!/g, '\\!');
  }

  /**
   * Send a notification to Telegram
   */
  async sendNotification(
    message: NotificationMessage,
    options: NotificationOptions = {}
  ): Promise<boolean> {
    if (!this.enabled) {
      console.warn('[TelegramNotifier] Notifications disabled, skipping');
      return false;
    }

    try {
      const formattedMessage = this.formatMessage(message);
      const sendOptions: TelegramBot.SendMessageOptions = {
        parse_mode: options.parseMode || 'Markdown',
        disable_notification: options.disableNotification || message.priority === 'low',
      };

      // Add threading support if provided
      if (options.threadId) {
        sendOptions.message_thread_id = options.threadId;
      }

      // Add reply support if provided
      if (options.replyToMessageId) {
        sendOptions.reply_to_message_id = options.replyToMessageId;
      }

      const result = await this.bot.sendMessage(
        this.chatId,
        formattedMessage,
        sendOptions
      );

      console.log(
        `[TelegramNotifier] Sent notification (msg ${result.message_id}) for ${message.priority} message from ${message.sender}`
      );

      return true;
    } catch (err) {
      console.error('[TelegramNotifier] Failed to send notification:', err);
      
      // Log more details for debugging
      const error = err as Error;
      console.error('[TelegramNotifier] Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });

      return false;
    }
  }

  /**
   * Send a simple text notification (no formatting)
   */
  async sendSimple(
    text: string,
    options: NotificationOptions = {}
  ): Promise<boolean> {
    if (!this.enabled) {
      console.warn('[TelegramNotifier] Notifications disabled, skipping');
      return false;
    }

    try {
      const sendOptions: TelegramBot.SendMessageOptions = {
        parse_mode: options.parseMode,
        disable_notification: options.disableNotification,
      };

      if (options.threadId) {
        sendOptions.message_thread_id = options.threadId;
      }

      if (options.replyToMessageId) {
        sendOptions.reply_to_message_id = options.replyToMessageId;
      }

      const result = await this.bot.sendMessage(this.chatId, text, sendOptions);

      console.log(`[TelegramNotifier] Sent simple message (msg ${result.message_id})`);

      return true;
    } catch (err) {
      console.error('[TelegramNotifier] Failed to send simple message:', err);
      return false;
    }
  }

  /**
   * Send a batch of notifications
   */
  async sendBatch(
    messages: NotificationMessage[],
    options: NotificationOptions = {},
    delayMs = 100
  ): Promise<{ sent: number; failed: number }> {
    if (!this.enabled) {
      console.warn('[TelegramNotifier] Notifications disabled, skipping batch');
      return { sent: 0, failed: messages.length };
    }

    let sent = 0;
    let failed = 0;

    for (const message of messages) {
      const success = await this.sendNotification(message, options);
      
      if (success) {
        sent++;
      } else {
        failed++;
      }

      // Rate limiting: wait between messages to avoid Telegram API limits
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    console.log(`[TelegramNotifier] Batch complete: ${sent} sent, ${failed} failed`);

    return { sent, failed };
  }

  /**
   * Check if the notifier is enabled and ready
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get the configured chat ID
   */
  getChatId(): string {
    return this.chatId;
  }
}
