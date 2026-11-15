/**
 * Google Gemini API LLM Client
 */

import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import type {
  ILLMClient,
  ILLMChatSession,
  Message,
  LLMResponse,
} from '../types/index.js';
import { validateGeminiConfig } from './geminiValidation.js';

function messagesToGeminiContents(history: Message[]) {
  return history.map((msg) => ({
    role: msg.role === 'model' ? ('model' as const) : ('user' as const),
    parts: msg.parts.map((part) => ({ text: part.text })),
  }));
}

function isLegacyGeminiModel(modelName: string): boolean {
  return modelName.startsWith('gemini-2.5') || modelName.startsWith('gemini-1.5');
}

function isFlashLiteModel(modelName: string): boolean {
  return modelName.includes('flash-lite');
}

/**
 * Wrapper for Gemini chat session to provide universal interface
 */
class GeminiChatSessionWrapper implements ILLMChatSession {
  private ai: GoogleGenAI;
  private modelName: string;
  private systemInstruction: string;
  private history: Message[] = [];
  private thinkingBudget?: number;

  constructor(
    ai: GoogleGenAI,
    modelName: string,
    systemInstruction: string,
    initialHistory?: Message[],
    thinkingBudget?: number
  ) {
    this.ai = ai;
    this.modelName = modelName;
    this.systemInstruction = systemInstruction;
    this.history = initialHistory || [];
    this.thinkingBudget = thinkingBudget;
  }

  async sendMessage(text: string): Promise<LLMResponse> {
    this.history.push({
      role: 'user',
      parts: [{ text }],
    });

    const contents = messagesToGeminiContents(this.history);
    let result;

    if (isLegacyGeminiModel(this.modelName)) {
      const budget = this.thinkingBudget ?? 0;
      result = await this.ai.models.generateContent({
        model: this.modelName,
        contents,
        config: {
          systemInstruction: this.systemInstruction,
          thinkingConfig: {
            thinkingBudget: budget,
          },
        },
      });
    } else if (isFlashLiteModel(this.modelName)) {
      result = await this.ai.models.generateContent({
        model: this.modelName,
        contents,
        config: {
          systemInstruction: this.systemInstruction,
        },
      });
    } else {
      result = await this.ai.models.generateContent({
        model: this.modelName,
        contents,
        config: {
          systemInstruction: this.systemInstruction,
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.MINIMAL,
          },
        },
      });
    }

    const responseText = result.text?.trim() ?? '';

    this.history.push({
      role: 'model',
      parts: [{ text: responseText }],
    });

    return { text: responseText };
  }

  getHistory(): Message[] {
    return this.history;
  }
}

/**
 * Gemini LLM Client implementation
 */
export class GeminiLLMClient implements ILLMClient {
  private ai: GoogleGenAI;
  private modelName: string;
  private apiKey: string;

  constructor(modelName: string, apiKey: string) {
    this.modelName = modelName;
    this.apiKey = apiKey;
    this.ai = new GoogleGenAI({ apiKey });
  }

  /**
   * Create client from environment variables
   */
  static fromEnvironment(): GeminiLLMClient {
    const config = validateGeminiConfig();
    return new GeminiLLMClient(config.modelName, config.geminiApiKey);
  }

  /**
   * Create a chat session
   */
  createChatSession(
    systemInstruction: string,
    history?: Message[],
    thinkingBudget?: number
  ): ILLMChatSession {
    return new GeminiChatSessionWrapper(
      this.ai,
      this.modelName,
      systemInstruction,
      history,
      thinkingBudget
    );
  }

  /**
   * Count tokens in history
   */
  countHistoryTokens(history: Message[]): number {
    let totalTokens = 0;
    for (const msg of history) {
      for (const part of msg.parts) {
        totalTokens += Math.ceil(part.text.length / 4);
      }
    }
    return totalTokens;
  }

  getModelName(): string {
    return this.modelName;
  }

  isAvailable(): boolean {
    return !!this.apiKey && this.apiKey.length > 0;
  }

  preparingForUseMessage(): string {
    return `Preparing Gemini model ${this.modelName}...`;
  }

  readyForUseMessage(): string {
    const maskedKey = this.apiKey
      ? `${this.apiKey.substring(0, 8)}...${this.apiKey.substring(this.apiKey.length - 4)}`
      : 'NOT SET';
    return `Gemini ${this.modelName} ready (API Key: ${maskedKey})`;
  }
}