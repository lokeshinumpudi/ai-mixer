import { authenticatedRoute } from '@/lib/auth-decorators';
import { getMessagesByChatId } from '@/lib/db/queries';
import { ChatSDKError } from '@/lib/errors';
import { convertToUIMessages } from '@/lib/utils';

export const GET = authenticatedRoute(async (request, context, user) => {
  if (!context.params) {
    return new ChatSDKError(
      'bad_request:api',
      'Chat ID is required',
    ).toResponse();
  }

  const { id: chatId } = await context.params;
  const { searchParams } = new URL(request.url);
  const limit = Number.parseInt(searchParams.get('limit') || '20');
  const before = searchParams.get('before'); // Cursor for pagination

  if (!chatId) {
    return new ChatSDKError(
      'bad_request:api',
      'Chat ID is required',
    ).toResponse();
  }

  try {
    // First check if user has access to this chat
    const { getChatById } = await import('@/lib/db/queries');
    const chat = await getChatById({ id: chatId });

    if (!chat) {
      return new ChatSDKError('not_found:chat', 'Chat not found').toResponse();
    }

    if (chat.visibility === 'private' && chat.userId !== user.id) {
      return new ChatSDKError('forbidden:chat', 'Access denied').toResponse();
    }

    const messagesFromDb = await getMessagesByChatId({
      id: chatId,
      limit,
      before: before || undefined,
      excludeCompareMessages: true, // Exclude compare-related messages to prevent duplication
    });
    const uiMessages = convertToUIMessages(messagesFromDb);

    // Check if there are more messages
    const { getMessagesCount } = await import('@/lib/db/queries');
    const totalMessages = await getMessagesCount({ chatId });
    const hasMore =
      messagesFromDb.length === limit && uiMessages.length < totalMessages;

    return Response.json({
      messages: uiMessages,
      hasMore,
      nextCursor: hasMore && uiMessages.length > 0 ? uiMessages[0].id : null,
    });
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      'bad_request:api',
      'Failed to fetch messages',
    ).toResponse();
  }
});
