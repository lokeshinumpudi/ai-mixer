/**
 * ===============================================================================================
 * DEPRECATED: Regular Chat Stream API
 * ===============================================================================================
 *
 * This endpoint has been deprecated as of [DATE] in favor of unified compare mode.
 *
 * REASON: The application now operates exclusively in compare mode. All chat interactions
 * use the compare infrastructure (/api/compare/stream) for consistency and better UX.
 *
 * SECURITY CONCERN: This endpoint was missing usage validation, creating a potential
 * security gap where users could bypass rate limits.
 *
 * PRESERVED FOR REFERENCE: This file is commented out rather than deleted to maintain
 * historical context and implementation patterns for future reference.
 *
 * If you need to re-enable this endpoint, ensure you add proper usage validation
 * using getUserUsageAndLimits() before deployment.
 *
 * Related files:
 * - Active: /api/compare/stream/route.ts (current implementation)
 * - Active: /api/chat/route.ts (regular chat with proper validation)
 * ===============================================================================================
 */

import { NextResponse } from "next/server";

// Disabled endpoint - returns 410 Gone
export async function GET() {
  return NextResponse.json(
    {
      error: "This endpoint has been deprecated",
      message: "Use /api/compare/stream for all chat interactions",
      deprecated: true,
    },
    { status: 410 }
  );
}

/**
 * COMMENTED OUT IMPLEMENTATION - FOR REFERENCE ONLY
 *
 * import { authenticatedRoute } from '@/lib/auth-decorators';
 * import {
 *   getChatById,
 *   getMessagesByChatId,
 *   getStreamIdsByChatId,
 * } from '@/lib/db/queries';
 * import type { Chat } from '@/lib/db/schema';
 * import { ChatSDKError } from '@/lib/errors';
 * import type { ChatMessage } from '@/lib/types';
 * import { createUIMessageStream, JsonToSseTransformStream } from 'ai';
 * import { differenceInSeconds } from 'date-fns';
 * import { getStreamContext } from '../../route';
 *
 * export const GET = authenticatedRoute(async (_: Request, context, user) => {
 *   if (!context.params) {
 *     return new ChatSDKError('bad_request:api').toResponse();
 *   }
 *   const { id: chatId } = await context.params;
 *
 *   const streamContext = getStreamContext();
 *   const resumeRequestedAt = new Date();
 *
 *   if (!streamContext) {
 *     return new Response(null, { status: 204 });
 *   }
 *
 *   if (!chatId) {
 *     return new ChatSDKError('bad_request:api').toResponse();
 *   }
 *
 *   let chat: Chat;
 *
 *   try {
 *     chat = await getChatById({ id: chatId });
 *   } catch {
 *     return new ChatSDKError('not_found:chat').toResponse();
 *   }
 *
 *   if (!chat) {
 *     return new ChatSDKError('not_found:chat').toResponse();
 *   }
 *
 *   if (chat.visibility === 'private' && chat.userId !== user.id) {
 *     return new ChatSDKError('forbidden:chat').toResponse();
 *   }
 *
 *   const streamIds = await getStreamIdsByChatId({ chatId });
 *
 *   if (!streamIds.length) {
 *     return new ChatSDKError('not_found:stream').toResponse();
 *   }
 *
 *   const recentStreamId = streamIds.at(-1);
 *
 *   if (!recentStreamId) {
 *     return new ChatSDKError('not_found:stream').toResponse();
 *   }
 *
 *   const emptyDataStream = createUIMessageStream<ChatMessage>({
 *     execute: () => {},
 *   });
 *
 *   const stream = await streamContext.resumableStream(recentStreamId, () =>
 *     emptyDataStream.pipeThrough(new JsonToSseTransformStream()),
 *   );
 *
 *   // For when the generation is streaming during SSR
 *   // but the resumable stream has concluded at this point.
 *   if (!stream) {
 *     const messages = await getMessagesByChatId({
 *       id: chatId,
 *       excludeCompareMessages: true, // Exclude compare messages in regular chat mode
 *     });
 *     const mostRecentMessage = messages.at(-1);
 *
 *     if (!mostRecentMessage) {
 *       return new Response(emptyDataStream, { status: 200 });
 *     }
 *
 *     if (mostRecentMessage.role !== 'assistant') {
 *       return new Response(emptyDataStream, { status: 200 });
 *     }
 *
 *     const messageCreatedAt = new Date(mostRecentMessage.createdAt);
 *
 *     if (differenceInSeconds(resumeRequestedAt, messageCreatedAt) > 15) {
 *       return new Response(emptyDataStream, { status: 200 });
 *     }
 *
 *     const restoredStream = createUIMessageStream<ChatMessage>({
 *       execute: ({ writer }) => {
 *         writer.write({
 *           type: 'data-appendMessage',
 *           data: JSON.stringify(mostRecentMessage),
 *           transient: true,
 *         });
 *       },
 *     });
 *
 *     return new Response(
 *       restoredStream.pipeThrough(new JsonToSseTransformStream()),
 *       { status: 200 },
 *     );
 *   }
 *
 *   return new Response(stream, { status: 200 });
 * });
 */
