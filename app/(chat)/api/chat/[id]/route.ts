import { protectedRoute } from '@/lib/auth-decorators';
import { getChatById } from '@/lib/db/queries';
import { ChatSDKError } from '@/lib/errors';

export const GET = protectedRoute(async (request, context, user) => {
  if (!context.params) {
    return new ChatSDKError(
      'bad_request:api',
      'Chat ID is required',
    ).toResponse();
  }

  const { id: chatId } = await context.params;

  if (!chatId) {
    return new ChatSDKError(
      'bad_request:api',
      'Chat ID is required',
    ).toResponse();
  }

  try {
    const chat = await getChatById({ id: chatId });

    if (!chat) {
      return new ChatSDKError('not_found:chat', 'Chat not found').toResponse();
    }

    // Check access permissions
    if (chat.visibility === 'private' && chat.userId !== user.id) {
      return new ChatSDKError('forbidden:chat', 'Access denied').toResponse();
    }

    return Response.json(chat);
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      'bad_request:api',
      'Failed to fetch chat',
    ).toResponse();
  }
});
