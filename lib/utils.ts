import type { DBMessage, Document } from '@/lib/db/schema';
import type {
  CoreAssistantMessage,
  CoreToolMessage,
  UIMessage,
  UIMessagePart,
} from 'ai';
import { type ClassValue, clsx } from 'clsx';
import { formatISO } from 'date-fns';
import { twMerge } from 'tailwind-merge';
import { ChatSDKError, type ErrorCode } from './errors';
import type { ChatMessage, ChatTools, CustomUIDataTypes } from './types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Parse content to extract thinking/reasoning sections from AI responses
 * This utility function can be used across components to handle reasoning content
 * that comes embedded in text responses (e.g., from compare API)
 */
export function parseContentWithThinking(content: string): {
  mainContent: string;
  thinkingContent: string | null;
} {
  if (!content) return { mainContent: '', thinkingContent: null };

  // Look for <thinking> or <think> tags (case insensitive)
  const thinkingRegex = /<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi;
  const thinkingMatches = content.match(thinkingRegex);

  if (!thinkingMatches) {
    return { mainContent: content, thinkingContent: null };
  }

  // Extract thinking content (remove the tags)
  const thinkingContent = thinkingMatches
    .map((match) => match.replace(/<\/?think(?:ing)?>/gi, '').trim())
    .join('\n\n');

  // Remove thinking sections from main content
  const mainContent = content.replace(thinkingRegex, '').trim();

  return {
    mainContent,
    thinkingContent: thinkingContent || null,
  };
}

export const fetcher = async (url: string) => {
  const response = await fetch(url);

  if (!response.ok) {
    const { code, cause } = await response.json();
    throw new ChatSDKError(code as ErrorCode, cause);
  }

  return response.json();
};

export async function fetchWithErrorHandlers(
  input: RequestInfo | URL,
  init?: RequestInit,
) {
  try {
    const response = await fetch(input, init);

    if (!response.ok) {
      const { code, cause } = await response.json();
      throw new ChatSDKError(code as ErrorCode, cause);
    }

    return response;
  } catch (error: unknown) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new ChatSDKError('offline:chat');
    }

    throw error;
  }
}

export function getLocalStorage(key: string) {
  if (typeof window !== 'undefined') {
    return JSON.parse(localStorage.getItem(key) || '[]');
  }
  return [];
}

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Get the base URL for the application
 * Uses NEXT_PUBLIC_BASE_URL environment variable if available,
 * otherwise falls back to constructing from current location (client-side)
 * or from headers (server-side)
 */
export function getBaseUrl(headers?: Headers): string {
  // Debug logging to trace URL resolution
  console.log(
    '[getBaseUrl] Environment variable:',
    process.env.NEXT_PUBLIC_BASE_URL,
  );
  console.log('[getBaseUrl] Is client-side:', typeof window !== 'undefined');
  console.log('[getBaseUrl] Headers provided:', !!headers);

  // If environment variable is set, use it
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    console.log(
      '[getBaseUrl] Using environment variable:',
      process.env.NEXT_PUBLIC_BASE_URL,
    );
    return process.env.NEXT_PUBLIC_BASE_URL;
  }

  // Client-side fallback
  if (typeof window !== 'undefined') {
    const clientUrl = `${window.location.protocol}//${window.location.host}`;
    console.log('[getBaseUrl] Using client-side URL:', clientUrl);
    return clientUrl;
  }

  // Server-side fallback using headers
  if (headers) {
    const host = headers.get('host');
    const protocol = headers.get('x-forwarded-proto') || 'http';
    const serverUrl = `${protocol}://${host}`;
    console.log('[getBaseUrl] Using server-side URL from headers:', serverUrl);
    return serverUrl;
  }

  // Last resort fallback
  console.log('[getBaseUrl] Using fallback URL: http://localhost:3000');
  return 'http://localhost:3000';
}

type ResponseMessageWithoutId = CoreToolMessage | CoreAssistantMessage;
type ResponseMessage = ResponseMessageWithoutId & { id: string };

export function getMostRecentUserMessage(messages: Array<UIMessage>) {
  const userMessages = messages.filter((message) => message.role === 'user');
  return userMessages.at(-1);
}

export function getDocumentTimestampByIndex(
  documents: Array<Document>,
  index: number,
) {
  if (!documents) return new Date();
  if (index > documents.length) return new Date();

  return documents[index].createdAt;
}

export function getTrailingMessageId({
  messages,
}: {
  messages: Array<ResponseMessage>;
}): string | null {
  const trailingMessage = messages.at(-1);

  if (!trailingMessage) return null;

  return trailingMessage.id;
}

export function sanitizeText(text: string) {
  return text.replace('<has_function_call>', '');
}

export function convertToUIMessages(messages: DBMessage[]): ChatMessage[] {
  return messages.map((message) => ({
    id: message.id,
    role: message.role as 'user' | 'assistant' | 'system',
    parts: message.parts as UIMessagePart<CustomUIDataTypes, ChatTools>[],
    metadata: {
      createdAt: formatISO(message.createdAt),
    },
  }));
}

export function getTextFromMessage(message: ChatMessage): string {
  return message.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('');
}
