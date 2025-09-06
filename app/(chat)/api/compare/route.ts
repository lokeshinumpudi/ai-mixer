import { authenticatedRoute } from "@/lib/auth-decorators";
import { getChatById, listCompareRunsByChat } from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

export const GET = authenticatedRoute(async (request, _context, user) => {
  try {
    const url = new URL(request.url);
    const chatId = url.searchParams.get("chatId");
    const limit = Number.parseInt(url.searchParams.get("limit") || "50", 10);
    const cursor = url.searchParams.get("cursor") || undefined;

    if (!chatId) {
      return new ChatSDKError(
        "bad_request:api",
        "chatId is required"
      ).toResponse();
    }

    // Verify user has access to this chat based on visibility/ownership
    const chat = await getChatById({ id: chatId });
    if (!chat) {
      return new ChatSDKError("not_found:chat", "Chat not found").toResponse();
    }

    // Private chats are only visible to the owner
    if (chat.visibility === "private" && chat.userId !== user.id) {
      return new ChatSDKError("forbidden:chat", "Access denied").toResponse();
    }

    const result = await listCompareRunsByChat({
      chatId,
      limit,
      cursor,
    });

    // At this point, access has been validated by chat visibility.
    // Return runs for this chat regardless of owner so public shares work in incognito.
    return Response.json({
      items: result.items,
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    });
  } catch (error) {
    console.error("List compare runs error:", error);

    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }

    return new ChatSDKError(
      "bad_request:api",
      "Failed to list compare runs"
    ).toResponse();
  }
});
