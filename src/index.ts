/**
 * Antenna - Siphon Engine Integration Layer
 * Main exports
 */

export { MessageProcessor, createMessageProcessor } from './processors/MessageProcessor';
export type { ProcessorOptions } from './processors/MessageProcessor';
export { loadConfig, validateConfig } from './config/antenna.config';
export type { AntennaConfig } from './config/antenna.config';

// Re-export core Siphon Engine types for convenience
export type { 
  InboundMessage, 
  RoutingAction, 
  TriageScore,
  VIPConfig,
  SiphonConfig 
} from '../../siphon-engine/src/types';
