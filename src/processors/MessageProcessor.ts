/**
 * MessageProcessor - Integration layer for SiphonEngine
 */

import { SiphonEngine } from '../../../siphon-engine';
import type { InboundMessage, RoutingAction } from '../../../siphon-engine/src/types';
import type { AntennaConfig } from '../config/antenna.config';
import { loadConfig } from '../config/antenna.config';

export interface ProcessorOptions {
  config?: AntennaConfig;
  configPath?: string;
}

/**
 * Main message processor that orchestrates inbound message handling
 */
export class MessageProcessor {
  private engine: SiphonEngine;
  private config: AntennaConfig;

  constructor(options: ProcessorOptions = {}) {
    // Load config from file or use provided config
    this.config = options.config || loadConfig(options.configPath);
    
    // Initialize SiphonEngine with loaded config
    this.engine = new SiphonEngine({
      vips: this.config.vips,
      persona: this.config.persona,
      thresholds: this.config.thresholds,
      llmProvider: this.config.llmProvider,
    });
  }

  /**
   * Process an inbound message and return routing actions
   */
  async processInbound(message: InboundMessage): Promise<RoutingAction> {
    try {
      // Validate message
      if (!message.id || !message.sender || !message.content) {
        throw new Error('Invalid message: missing required fields (id, sender, content)');
      }

      // Process through SiphonEngine
      const action = await this.engine.process(message);

      // Log the action for observability
      console.log('Message processed:', {
        messageId: message.id,
        sender: message.sender,
        channel: message.channel,
        actionType: action.type,
        priority: action.priority,
      });

      return action;
    } catch (error) {
      console.error('Error processing message:', {
        messageId: message.id,
        error: error instanceof Error ? error.message : String(error),
      });
      
      // Return a safe fallback action on error
      return {
        type: 'queue',
        priority: 'normal',
      };
    }
  }

  /**
   * Process multiple messages in batch
   */
  async processBatch(messages: InboundMessage[]): Promise<RoutingAction[]> {
    return Promise.all(messages.map(msg => this.processInbound(msg)));
  }

  /**
   * Get current configuration (for testing/debugging)
   */
  getConfig(): AntennaConfig {
    return this.config;
  }

  /**
   * Reload configuration from file
   */
  reloadConfig(configPath?: string): void {
    this.config = loadConfig(configPath);
    
    // Reinitialize engine with new config
    this.engine = new SiphonEngine({
      vips: this.config.vips,
      persona: this.config.persona,
      thresholds: this.config.thresholds,
      llmProvider: this.config.llmProvider,
    });

    console.log('Configuration reloaded');
  }
}

/**
 * Factory function for easy initialization
 */
export function createMessageProcessor(options?: ProcessorOptions): MessageProcessor {
  return new MessageProcessor(options);
}
