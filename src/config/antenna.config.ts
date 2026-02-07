/**
 * Type-safe configuration loader for Antenna
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';
import type { SiphonConfig, VIPConfig } from '../../../siphon-engine/src/types';
import { ClaudeLLMProvider, TemplateLLMProvider } from '../../../siphon-engine';

export interface SMSConfig {
  provider: 'dekusms' | 'twilio';
  dekusms?: {
    rabbitmq_url: string;
    queue_name: string;
    callback_queue: string;
  };
  twilio?: {
    account_sid: string;
    auth_token: string;
    from_number: string;
  };
}

export interface AntennaConfig extends SiphonConfig {
  vips: VIPConfig;
  persona: string;
  thresholds: {
    urgent: number;
    high: number;
    normal: number;
  };
  llm?: {
    provider: 'claude' | 'template';
    apiKey?: string;
    model?: string;
  };
  sms?: SMSConfig;
}

interface RawYamlConfig {
  vips: {
    tier1: string[];
    tier2: string[];
    tier3?: string;
  };
  persona: string;
  thresholds: {
    urgent: number;
    high: number;
    normal: number;
  };
  llm?: {
    provider: 'claude' | 'template';
    apiKey?: string;
    model?: string;
  };
  sms?: {
    provider: 'dekusms' | 'twilio';
    dekusms?: {
      rabbitmq_url: string;
      queue_name: string;
      callback_queue: string;
    };
    twilio?: {
      account_sid: string;
      auth_token: string;
      from_number: string;
    };
  };
}

/**
 * Load and validate configuration from YAML file
 */
export function loadConfig(configPath?: string): AntennaConfig {
  const path = configPath || join(process.cwd(), 'antenna.config.yaml');
  
  let rawConfig: RawYamlConfig;
  try {
    const fileContents = readFileSync(path, 'utf8');
    rawConfig = yaml.load(fileContents) as RawYamlConfig;
  } catch (error) {
    throw new Error(`Failed to load config from ${path}: ${error}`);
  }

  // Validate required fields
  if (!rawConfig.vips || !rawConfig.persona || !rawConfig.thresholds) {
    throw new Error('Config missing required fields: vips, persona, or thresholds');
  }

  if (!rawConfig.vips.tier1 || !Array.isArray(rawConfig.vips.tier1)) {
    throw new Error('Config vips.tier1 must be an array');
  }

  if (!rawConfig.vips.tier2 || !Array.isArray(rawConfig.vips.tier2)) {
    throw new Error('Config vips.tier2 must be an array');
  }

  // Initialize LLM provider
  let llmProvider;
  if (rawConfig.llm) {
    if (rawConfig.llm.provider === 'claude') {
      if (!rawConfig.llm.apiKey) {
        throw new Error('Claude provider requires apiKey in config');
      }
      llmProvider = new ClaudeLLMProvider(rawConfig.llm.apiKey);
    } else if (rawConfig.llm.provider === 'template') {
      llmProvider = new TemplateLLMProvider();
    }
  } else {
    // Default to template provider
    llmProvider = new TemplateLLMProvider();
  }

  return {
    vips: {
      tier1: rawConfig.vips.tier1,
      tier2: rawConfig.vips.tier2,
      tier3: rawConfig.vips.tier3,
    },
    persona: rawConfig.persona,
    thresholds: rawConfig.thresholds,
    llmProvider,
    llm: rawConfig.llm,
    sms: rawConfig.sms,
  };
}

/**
 * Validate config structure (for testing)
 */
export function validateConfig(config: AntennaConfig): boolean {
  if (!config.vips || !config.persona || !config.thresholds) {
    return false;
  }

  if (!Array.isArray(config.vips.tier1) || !Array.isArray(config.vips.tier2)) {
    return false;
  }

  const { urgent, high, normal } = config.thresholds;
  if (typeof urgent !== 'number' || typeof high !== 'number' || typeof normal !== 'number') {
    return false;
  }

  if (urgent <= high || high <= normal) {
    return false;
  }

  return true;
}
