import 'server-only';

import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  lt,
  or,
  sum,
} from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import type { ArtifactKind } from '@/components/artifact';
import type { VisibilityType } from '@/components/visibility-selector';
import { entitlementsByUserType } from '@/lib/ai/entitlements';
import { dbLogger } from '@/lib/logger';

import type { UserType } from '@/lib/supabase/types';
import type { UserSystemPrompt } from '@/lib/types';
import { sql } from 'drizzle-orm';
import { ChatSDKError } from '../errors';
import {
  chat,
  chatUsage,
  compareResult,
  compareRun,
  creditLedger,
  document,
  message,
  payment,
  paymentEvent,
  refund,
  serviceDowntime,
  stream,
  subscription,
  suggestion,
  usageDaily,
  usageMonthly,
  user,
  userNotification,
  userSettings,
  vote,
  type Chat,
  type DBMessage,
  type Suggestion,
  type User,
} from './schema';
import { generateHashedPassword } from './utils';

// Optionally, if not using email/pass login, you can
// use the Drizzle adapter for Auth.js / NextAuth
// https://authjs.dev/reference/adapter/drizzle

// biome-ignore lint: Forbidden non-null assertion.
const client = postgres(process.env.POSTGRES_URL!);
const db = drizzle(client);

export async function getUser(email: string): Promise<Array<User>> {
  try {
    return await db.select().from(user).where(eq(user.email, email));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get user by email',
    );
  }
}

export async function getUserById(id: string): Promise<User | null> {
  try {
    const users = await db.select().from(user).where(eq(user.id, id)).limit(1);
    return users[0] || null;
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to get user by ID');
  }
}

export async function createUser(email: string, password: string) {
  const hashedPassword = generateHashedPassword(password);

  try {
    return await db.insert(user).values({ email, password: hashedPassword });
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to create user');
  }
}

// Old createOAuthUserIfNotExists function removed - replaced with createOAuthUserIfNotExistsSimple
// which leverages Supabase's built-in identity linking for automatic anonymous → OAuth transitions

// Simplified OAuth user creation leveraging Supabase identity linking
export async function createOAuthUserIfNotExistsSimple(
  supabaseUserId: string,
  email: string,
) {
  try {
    dbLogger.debug(
      {
        supabaseUserId,
        email,
      },
      'Creating OAuth user (Supabase identity linking)',
    );

    // Check if user already exists
    const [existingUser] = await db
      .select()
      .from(user)
      .where(eq(user.id, supabaseUserId))
      .limit(1);

    if (existingUser) {
      dbLogger.debug(
        {
          supabaseUserId,
          email,
          existingUserId: existingUser.id,
        },
        'OAuth user already exists',
      );
      return existingUser;
    }

    // Create new OAuth user
    const [newUser] = await db
      .insert(user)
      .values({
        id: supabaseUserId,
        email,
      })
      .returning();

    dbLogger.info(
      {
        supabaseUserId,
        email,
        newUserId: newUser.id,
      },
      'Created new OAuth user (Supabase identity linking)',
    );
    return newUser;
  } catch (error) {
    const parsedError =
      error instanceof Error ? error : new Error(String(error));
    dbLogger.error(
      {
        supabaseUserId,
        email,
        error: parsedError.message,
      },
      'Failed to create OAuth user',
    );
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to create user account',
    );
  }
}

// Ensure an anonymous user exists in the database
export async function createAnonymousUserIfNotExists(supabaseUserId: string) {
  try {
    // Check if user already exists by Supabase ID
    const existingById = await db
      .select()
      .from(user)
      .where(eq(user.id, supabaseUserId));
    if (existingById.length > 0) return existingById[0];

    // Create new anonymous user with auto-generated ID (don't use Supabase ID as primary key for anonymous users)
    const inserted = await db
      .insert(user)
      .values({
        email: `anonymous-${supabaseUserId}@temp.local`, // Temporary email to satisfy NOT NULL constraint
        supabaseId: supabaseUserId, // Store Supabase ID for linking later
      })
      .returning();
    return inserted[0];
  } catch (error) {
    const parsedError =
      error instanceof Error ? error : new Error(String(error));
    dbLogger.error(
      {
        supabaseUserId,
        error: parsedError.message,
        stack: parsedError.stack,
      },
      'Error in createAnonymousUserIfNotExists',
    );
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to ensure anonymous user',
    );
  }
}

export async function saveChat({
  id,
  userId,
  title,
  visibility,
}: {
  id: string;
  userId: string;
  title: string;
  visibility: VisibilityType;
}) {
  try {
    return await db.insert(chat).values({
      id,
      createdAt: new Date(),
      userId,
      title,
      visibility,
    });
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to save chat');
  }
}

export async function deleteChatById({ id }: { id: string }) {
  try {
    // Delete in correct order due to foreign key constraints
    await db.delete(vote).where(eq(vote.chatId, id));
    await db.delete(message).where(eq(message.chatId, id));
    await db.delete(stream).where(eq(stream.chatId, id));
    // Delete compare runs (compareResult will be cascade deleted automatically)
    await db.delete(compareRun).where(eq(compareRun.chatId, id));

    const [chatsDeleted] = await db
      .delete(chat)
      .where(eq(chat.id, id))
      .returning();
    return chatsDeleted;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to delete chat by id',
    );
  }
}

export async function getChatsByUserId({
  id,
  limit,
  startingAfter,
  endingBefore,
}: {
  id: string;
  limit: number;
  startingAfter: string | null;
  endingBefore: string | null;
}) {
  try {
    const extendedLimit = limit + 1;

    // 🚀 PERFORMANCE OPTIMIZATION: Use optimized index-aware query
    const baseQuery = db
      .select()
      .from(chat)
      .where(eq(chat.userId, id))
      .orderBy(desc(chat.createdAt))
      .limit(extendedLimit);

    let filteredChats: Array<Chat> = [];

    if (startingAfter) {
      // Optimized cursor-based pagination
      const [selectedChat] = await db
        .select({ createdAt: chat.createdAt })
        .from(chat)
        .where(eq(chat.id, startingAfter))
        .limit(1);

      if (!selectedChat) {
        throw new ChatSDKError(
          'not_found:database',
          `Chat with id ${startingAfter} not found`,
        );
      }

      filteredChats = await db
        .select()
        .from(chat)
        .where(
          and(eq(chat.userId, id), gt(chat.createdAt, selectedChat.createdAt)),
        )
        .orderBy(desc(chat.createdAt))
        .limit(extendedLimit);
    } else if (endingBefore) {
      // Optimized cursor-based pagination
      const [selectedChat] = await db
        .select({ createdAt: chat.createdAt })
        .from(chat)
        .where(eq(chat.id, endingBefore))
        .limit(1);

      if (!selectedChat) {
        throw new ChatSDKError(
          'not_found:database',
          `Chat with id ${endingBefore} not found`,
        );
      }

      filteredChats = await db
        .select()
        .from(chat)
        .where(
          and(eq(chat.userId, id), lt(chat.createdAt, selectedChat.createdAt)),
        )
        .orderBy(desc(chat.createdAt))
        .limit(extendedLimit);
    } else {
      // First page - use base query with index
      filteredChats = await baseQuery;
    }

    const hasMore = filteredChats.length > limit;

    return {
      chats: hasMore ? filteredChats.slice(0, limit) : filteredChats,
      hasMore,
    };
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get chats by user id',
    );
  }
}

export async function getChatById({ id }: { id: string }) {
  try {
    const [selectedChat] = await db.select().from(chat).where(eq(chat.id, id));
    return selectedChat;
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to get chat by id');
  }
}

export async function saveMessages({
  messages,
}: {
  messages: Array<DBMessage>;
}) {
  try {
    return await db.insert(message).values(messages);
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to save messages');
  }
}

export async function getMessagesByChatId({
  id,
  limit,
  before,
  excludeCompareMessages = false,
}: {
  id: string;
  limit?: number;
  before?: string;
  excludeCompareMessages?: boolean;
}) {
  try {
    // Build the base query
    let query = db
      .select()
      .from(message)
      .where(eq(message.chatId, id))
      .orderBy(desc(message.createdAt)); // Latest first for pagination

    // Add cursor-based pagination if before is provided
    if (before) {
      const cursorMessage = await db
        .select()
        .from(message)
        .where(eq(message.id, before))
        .limit(1);

      if (cursorMessage.length > 0) {
        // Create new query with cursor condition
        query = db
          .select()
          .from(message)
          .where(
            and(
              eq(message.chatId, id),
              lt(message.createdAt, cursorMessage[0].createdAt),
            ),
          )
          .orderBy(desc(message.createdAt));
      }
    }

    // Apply limit and execute query
    const messages = await (limit ? query.limit(limit) : query);

    // 🚀 PERFORMANCE OPTIMIZATION: Optimized compare message filtering
    let filteredMessages = messages;
    if (excludeCompareMessages && messages.length > 0) {
      // Single efficient query to check for compare runs
      const [compareRunCheck] = await db
        .select({ exists: sql<boolean>`1` })
        .from(compareRun)
        .where(eq(compareRun.chatId, id))
        .limit(1);

      if (compareRunCheck?.exists) {
        // Use optimized JSON filtering with GIN index
        filteredMessages = messages.filter((message) => {
          // Keep all user messages (most common case first)
          if (message.role === 'user') return true;

          // For assistant messages, use optimized metadata check
          if (message.role === 'assistant') {
            try {
              // Direct JSON access - leverages GIN index
              const parts = message.parts as any[];
              if (!Array.isArray(parts)) return true;

              // Fast metadata check using find with early return
              const hasCompareMetadata = parts.some(
                (part: any) => part.type === 'metadata' && part.compareRunId,
              );

              return !hasCompareMetadata;
            } catch (e) {
              // Fail safe: keep message if parsing fails
              return true;
            }
          }

          return true; // Keep other message types
        });
      }
    }

    // Reverse to chronological order for UI
    return filteredMessages.reverse();
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get messages by chat id',
    );
  }
}

export async function getMessagesCount({ chatId }: { chatId: string }) {
  try {
    const result = await db
      .select({ count: count() })
      .from(message)
      .where(eq(message.chatId, chatId));

    return result[0]?.count || 0;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get messages count',
    );
  }
}

export async function voteMessage({
  chatId,
  messageId,
  type,
}: {
  chatId: string;
  messageId: string;
  type: 'up' | 'down';
}) {
  try {
    const [existingVote] = await db
      .select()
      .from(vote)
      .where(and(eq(vote.messageId, messageId)));

    if (existingVote) {
      return await db
        .update(vote)
        .set({ isUpvoted: type === 'up' })
        .where(and(eq(vote.messageId, messageId), eq(vote.chatId, chatId)));
    }
    return await db.insert(vote).values({
      chatId,
      messageId,
      isUpvoted: type === 'up',
    });
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to vote message');
  }
}

export async function getVotesByChatId({ id }: { id: string }) {
  try {
    return await db.select().from(vote).where(eq(vote.chatId, id));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get votes by chat id',
    );
  }
}

export async function saveDocument({
  id,
  title,
  kind,
  content,
  userId,
}: {
  id: string;
  title: string;
  kind: ArtifactKind;
  content: string;
  userId: string;
}) {
  try {
    return await db
      .insert(document)
      .values({
        id,
        title,
        kind,
        content,
        userId,
        createdAt: new Date(),
      })
      .returning();
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to save document');
  }
}

export async function getDocumentsById({ id }: { id: string }) {
  try {
    const documents = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(asc(document.createdAt));

    return documents;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get documents by id',
    );
  }
}

export async function getDocumentById({ id }: { id: string }) {
  try {
    const [selectedDocument] = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(desc(document.createdAt));

    return selectedDocument;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get document by id',
    );
  }
}

export async function deleteDocumentsByIdAfterTimestamp({
  id,
  timestamp,
}: {
  id: string;
  timestamp: Date;
}) {
  try {
    await db
      .delete(suggestion)
      .where(
        and(
          eq(suggestion.documentId, id),
          gt(suggestion.documentCreatedAt, timestamp),
        ),
      );

    return await db
      .delete(document)
      .where(and(eq(document.id, id), gt(document.createdAt, timestamp)))
      .returning();
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to delete documents by id after timestamp',
    );
  }
}

export async function saveSuggestions({
  suggestions,
}: {
  suggestions: Array<Suggestion>;
}) {
  try {
    return await db.insert(suggestion).values(suggestions);
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to save suggestions',
    );
  }
}

export async function getSuggestionsByDocumentId({
  documentId,
}: {
  documentId: string;
}) {
  try {
    return await db
      .select()
      .from(suggestion)
      .where(and(eq(suggestion.documentId, documentId)));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get suggestions by document id',
    );
  }
}

export async function getMessageById({ id }: { id: string }) {
  try {
    return await db.select().from(message).where(eq(message.id, id));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get message by id',
    );
  }
}

export async function deleteMessagesByChatIdAfterTimestamp({
  chatId,
  timestamp,
}: {
  chatId: string;
  timestamp: Date;
}) {
  try {
    const messagesToDelete = await db
      .select({ id: message.id })
      .from(message)
      .where(
        and(eq(message.chatId, chatId), gte(message.createdAt, timestamp)),
      );

    const messageIds = messagesToDelete.map((message) => message.id);

    if (messageIds.length > 0) {
      await db
        .delete(vote)
        .where(
          and(eq(vote.chatId, chatId), inArray(vote.messageId, messageIds)),
        );

      return await db
        .delete(message)
        .where(
          and(eq(message.chatId, chatId), inArray(message.id, messageIds)),
        );
    }
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to delete messages by chat id after timestamp',
    );
  }
}

export async function updateChatVisiblityById({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: 'private' | 'public';
}) {
  try {
    return await db.update(chat).set({ visibility }).where(eq(chat.id, chatId));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to update chat visibility by id',
    );
  }
}

export async function getMessageCountByUserId({
  id,
  differenceInHours,
}: {
  id: string;
  differenceInHours: number;
}) {
  try {
    const twentyFourHoursAgo = new Date(
      Date.now() - differenceInHours * 60 * 60 * 1000,
    );

    const [stats] = await db
      .select({ count: count(message.id) })
      .from(message)
      .innerJoin(chat, eq(message.chatId, chat.id))
      .where(
        and(
          eq(chat.userId, id),
          gte(message.createdAt, twentyFourHoursAgo),
          eq(message.role, 'user'),
        ),
      )
      .execute();

    return stats?.count ?? 0;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get message count by user id',
    );
  }
}

export async function createStreamId({
  streamId,
  chatId,
}: {
  streamId: string;
  chatId: string;
}) {
  try {
    await db
      .insert(stream)
      .values({ id: streamId, chatId, createdAt: new Date() });
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to create stream id',
    );
  }
}

export async function getStreamIdsByChatId({ chatId }: { chatId: string }) {
  try {
    const streamIds = await db
      .select({ id: stream.id })
      .from(stream)
      .where(eq(stream.chatId, chatId))
      .orderBy(asc(stream.createdAt))
      .execute();

    return streamIds.map(({ id }) => id);
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get stream ids by chat id',
    );
  }
}

// Billing & Usage

export async function createPaymentRecord({
  userId,
  orderId,
  amountPaise,
  currency,
}: {
  userId: string;
  orderId: string;
  amountPaise: number;
  currency: string;
}) {
  try {
    await db
      .insert(payment)
      .values({
        userId,
        orderId,
        amountPaise,
        currency,
        status: 'created',
        createdAt: new Date(),
      })
      .onConflictDoNothing({ target: payment.orderId });
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to create payment');
  }
}

export async function updatePaymentFromWebhook({
  orderId,
  paymentId,
  status,
}: {
  orderId: string;
  paymentId: string;
  status: string;
}) {
  try {
    await db
      .update(payment)
      .set({ paymentId, status })
      .where(eq(payment.orderId, orderId));
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to update payment');
  }
}

export async function addCredit({
  userId,
  tokensDelta,
  reason,
}: {
  userId: string;
  tokensDelta: number;
  reason: string;
}) {
  try {
    await db.insert(creditLedger).values({
      userId,
      tokensDelta,
      reason,
      createdAt: new Date(),
    });
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to add credit');
  }
}

export async function getRecentPurchaseCreditsCount({
  userId,
  since,
}: {
  userId: string;
  since: Date;
}): Promise<number> {
  try {
    const rows = await db
      .select({ id: creditLedger.id })
      .from(creditLedger)
      .where(
        and(
          eq(creditLedger.userId, userId),
          eq(creditLedger.reason, 'purchase'),
          gte(creditLedger.createdAt, since),
        ),
      );

    return rows.length;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get recent purchase credits',
    );
  }
}

export async function getRecentPaymentEventsCount({
  userId,
  since,
}: {
  userId: string;
  since: Date;
}): Promise<number> {
  try {
    const rows = await db
      .select({ id: paymentEvent.id })
      .from(paymentEvent)
      .where(
        and(
          eq(paymentEvent.userId, userId),
          or(
            eq(paymentEvent.eventType, 'captured'),
            eq(paymentEvent.eventType, 'paid'),
          ),
          gte(paymentEvent.createdAt, since),
        ),
      );

    return rows.length;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get recent payment events',
    );
  }
}

// Enhanced payment event tracking
export async function createPaymentEvent({
  paymentId,
  orderId,
  userId,
  eventType,
  status,
  amountPaise,
  currency = 'INR',
  method,
  errorCode,
  errorDescription,
  metadata,
}: {
  paymentId: string;
  orderId?: string;
  userId: string;
  eventType: string;
  status: string;
  amountPaise: number;
  currency?: string;
  method?: string;
  errorCode?: string;
  errorDescription?: string;
  metadata?: any;
}) {
  try {
    dbLogger.info(
      {
        paymentId,
        orderId,
        userId,
        eventType,
        status,
        amountPaise,
        currency,
        method,
      },
      'Creating payment event record',
    );

    dbLogger.debug(
      {
        paymentId,
        orderId,
        userId,
        eventType,
        status,
        amountPaise,
        metadataKeys: metadata ? Object.keys(metadata) : [],
      },
      'Inserting payment event with data',
    );

    await db.insert(paymentEvent).values({
      paymentId,
      orderId,
      userId,
      eventType,
      status,
      amountPaise,
      currency,
      method,
      errorCode,
      errorDescription,
      metadata,
      createdAt: new Date(), // ✅ Fix: Explicitly set createdAt
    });

    dbLogger.info(
      {
        paymentId,
        orderId,
        userId,
        eventType,
      },
      'Payment event created successfully',
    );
  } catch (error) {
    const parsedError =
      error instanceof Error ? error : new Error(String(error));
    dbLogger.error(
      {
        error: parsedError.message,
        stack: parsedError.stack,
        paymentId,
        userId,
        orderId,
        eventType,
      },
      'Database error in createPaymentEvent',
    );

    throw new ChatSDKError(
      'bad_request:database',
      `Failed to create payment event: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

// Refund management
export async function createRefund({
  refundId,
  paymentId,
  userId,
  amountPaise,
  currency = 'INR',
  status,
  reason,
  errorCode,
  razorpayCreatedAt,
}: {
  refundId: string;
  paymentId: string;
  userId: string;
  amountPaise: number;
  currency?: string;
  status: string;
  reason?: string;
  errorCode?: string;
  razorpayCreatedAt?: Date;
}) {
  try {
    await db.insert(refund).values({
      refundId,
      paymentId,
      userId,
      amountPaise,
      currency,
      status,
      reason,
      errorCode,
      razorpayCreatedAt,
      processedAt: status === 'processed' ? new Date() : null,
    });

    // If refund processed, reverse credits
    if (status === 'processed') {
      await addCredit({
        userId,
        tokensDelta: -(amountPaise / 100) * 100, // Negative tokens
        reason: 'refund',
      });
    }
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to create refund');
  }
}

export async function updateRefundStatus({
  refundId,
  status,
  errorCode,
}: {
  refundId: string;
  status: string;
  errorCode?: string;
}) {
  try {
    await db
      .update(refund)
      .set({
        status,
        errorCode,
        processedAt: status === 'processed' ? new Date() : null,
      })
      .where(eq(refund.refundId, refundId));
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to update refund');
  }
}

// Service downtime tracking
export async function upsertServiceDowntime({
  downtimeId,
  method,
  status,
  severity,
  instrument,
  startedAt,
  resolvedAt,
  scheduled = false,
}: {
  downtimeId: string;
  method: string;
  status: string;
  severity: string;
  instrument: any;
  startedAt?: Date;
  resolvedAt?: Date;
  scheduled?: boolean;
}) {
  try {
    await db
      .insert(serviceDowntime)
      .values({
        downtimeId,
        method,
        status,
        severity,
        instrument,
        startedAt,
        resolvedAt,
        scheduled,
      })
      .onConflictDoUpdate({
        target: serviceDowntime.downtimeId,
        set: {
          status,
          severity,
          resolvedAt,
          updatedAt: new Date(),
        },
      });
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to upsert service downtime',
    );
  }
}

export async function getActiveDowntimes() {
  try {
    return await db
      .select()
      .from(serviceDowntime)
      .where(eq(serviceDowntime.status, 'started'))
      .orderBy(desc(serviceDowntime.createdAt));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get active downtimes',
    );
  }
}

// User notifications
export async function createUserNotification({
  userId,
  type,
  title,
  message,
  metadata,
}: {
  userId: string;
  type: string;
  title: string;
  message: string;
  metadata?: any;
}) {
  try {
    await db.insert(userNotification).values({
      userId,
      type,
      title,
      message,
      metadata,
    });
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to create notification',
    );
  }
}

export async function getUserNotifications({
  userId,
  unreadOnly = false,
  limit = 50,
}: {
  userId: string;
  unreadOnly?: boolean;
  limit?: number;
}) {
  try {
    const conditions = [eq(userNotification.userId, userId)];
    if (unreadOnly) {
      conditions.push(eq(userNotification.read, false));
    }

    return await db
      .select()
      .from(userNotification)
      .where(and(...conditions))
      .orderBy(desc(userNotification.createdAt))
      .limit(limit);
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get notifications',
    );
  }
}

export async function markNotificationAsRead(notificationId: string) {
  try {
    await db
      .update(userNotification)
      .set({ read: true })
      .where(eq(userNotification.id, notificationId));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to mark notification as read',
    );
  }
}

export async function setSubscriptionPlan({
  userId,
  plan,
  status,
  currentPeriodEnd,
}: {
  userId: string;
  plan: string;
  status: string;
  currentPeriodEnd?: Date | null;
}) {
  try {
    dbLogger.info(
      {
        userId,
        plan,
        status,
        currentPeriodEnd: currentPeriodEnd?.toISOString(),
      },
      'Setting subscription plan',
    );

    // Check if a subscription already exists for this user
    const existing = await db
      .select({ id: subscription.id })
      .from(subscription)
      .where(eq(subscription.userId, userId))
      .limit(1);

    if (existing.length > 0) {
      // Update existing row
      await db
        .update(subscription)
        .set({
          plan,
          status,
          currentPeriodEnd: currentPeriodEnd ?? null,
        })
        .where(eq(subscription.userId, userId));
    } else {
      // Insert new subscription row
      await db.insert(subscription).values({
        userId,
        plan,
        status,
        currentPeriodEnd: currentPeriodEnd ?? null,
        createdAt: new Date(),
      });
    }

    dbLogger.info(
      {
        userId,
        plan,
        status,
      },
      'Subscription plan set successfully',
    );
  } catch (error) {
    const parsedError =
      error instanceof Error ? error : new Error(String(error));
    dbLogger.error(
      {
        error: parsedError.message,
        stack: parsedError.stack,
        userId,
        plan,
        status,
      },
      'Database error in setSubscriptionPlan',
    );

    throw new ChatSDKError(
      'bad_request:database',
      `Failed to set subscription plan: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

export async function upsertDailyUsage({
  userId,
  modelId,
  tokensIn,
  tokensOut,
  messages = 0,
  day,
}: {
  userId: string;
  modelId: string;
  tokensIn: number;
  tokensOut: number;
  messages?: number;
  day?: Date;
}) {
  const d = day ? new Date(day) : new Date();
  const dayOnly = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(
    2,
    '0',
  )}-${String(d.getUTCDate()).padStart(2, '0')}`;

  try {
    await db
      .insert(usageDaily)
      .values({
        userId,
        day: dayOnly,
        modelId,
        tokensIn,
        tokensOut,
        messages,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [usageDaily.userId, usageDaily.day, usageDaily.modelId],
        set: {
          tokensIn: sql`${usageDaily.tokensIn} + ${tokensIn}`,
          tokensOut: sql`${usageDaily.tokensOut} + ${tokensOut}`,
          messages: sql`${usageDaily.messages} + ${messages}`,
          updatedAt: new Date(),
        },
      });
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to upsert usage');
  }
}

export async function upsertMonthlyUsage({
  userId,
  messages = 1,
  month,
}: {
  userId: string;
  messages?: number;
  month?: Date;
}) {
  const d = month ? new Date(month) : new Date();
  const monthOnly = `${d.getUTCFullYear()}-${String(
    d.getUTCMonth() + 1,
  ).padStart(2, '0')}-01`;

  try {
    await db
      .insert(usageMonthly)
      .values({
        userId,
        month: monthOnly,
        messages,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [usageMonthly.userId, usageMonthly.month],
        set: {
          messages: sql`${usageMonthly.messages} + ${messages}`,
          updatedAt: new Date(),
        },
      });
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to upsert monthly usage',
    );
  }
}

// Get current usage and check limits for a user
export async function getUserUsageAndLimits({
  userId,
  userType,
}: {
  userId: string;
  userType: UserType;
}) {
  try {
    const entitlements = entitlementsByUserType[userType];

    if (userType === 'anonymous') {
      // Anonymous users: daily limits (same as free but different quota)
      const today = new Date();
      const todayString = `${today.getUTCFullYear()}-${String(
        today.getUTCMonth() + 1,
      ).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}`;

      const [dailyUsage] = await db
        .select({ totalMessages: sum(usageDaily.messages) })
        .from(usageDaily)
        .where(
          and(eq(usageDaily.userId, userId), eq(usageDaily.day, todayString)),
        );

      const used = Number(dailyUsage?.totalMessages) || 0;
      const quota = entitlements.maxMessagesPerDay ?? 0;

      return {
        used,
        quota,
        remaining: Math.max(0, quota - used),
        isOverLimit: used >= quota,
        type: 'daily' as const,
        resetInfo: 'tomorrow at 5:29 AM',
      };
    } else if (userType === 'free') {
      // Free users: daily limits
      const today = new Date();
      const todayString = `${today.getUTCFullYear()}-${String(
        today.getUTCMonth() + 1,
      ).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}`;

      const [dailyUsage] = await db
        .select({ totalMessages: sum(usageDaily.messages) })
        .from(usageDaily)
        .where(
          and(eq(usageDaily.userId, userId), eq(usageDaily.day, todayString)),
        );

      const used = Number(dailyUsage?.totalMessages) || 0;
      const quota = entitlements.maxMessagesPerDay ?? 0;

      return {
        used,
        quota,
        remaining: Math.max(0, quota - used),
        isOverLimit: used >= quota,
        type: 'daily' as const,
        resetInfo: 'tomorrow at 5:29 AM',
      };
    } else {
      // Pro users: monthly limits
      const now = new Date();
      const monthStart = `${now.getUTCFullYear()}-${String(
        now.getUTCMonth() + 1,
      ).padStart(2, '0')}-01`;

      const [monthlyUsage] = await db
        .select({ totalMessages: sum(usageMonthly.messages) })
        .from(usageMonthly)
        .where(
          and(
            eq(usageMonthly.userId, userId),
            eq(usageMonthly.month, monthStart),
          ),
        );

      const used = Number(monthlyUsage?.totalMessages) || 0;
      const quota = entitlements.maxMessagesPerMonth ?? 0;

      return {
        used,
        quota,
        remaining: Math.max(0, quota - used),
        isOverLimit: used >= quota,
        type: 'monthly' as const,
        resetInfo: 'monthly at 5:29 AM',
      };
    }
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get user usage and limits',
    );
  }
}

// User Settings Management
export async function getUserSettings(userId: string) {
  try {
    const [settings] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);

    return settings;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get user settings',
    );
  }
}

export async function upsertUserSettings(
  userId: string,
  settings: Record<string, any>,
) {
  try {
    await db
      .insert(userSettings)
      .values({
        userId,
        settings,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: userSettings.userId,
        set: {
          settings,
          updatedAt: new Date(),
        },
      });

    return { success: true };
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to upsert user settings',
    );
  }
}

export async function updateUserSetting(
  userId: string,
  key: string,
  value: any,
) {
  try {
    // Get current settings
    const currentSettings = await getUserSettings(userId);
    const updatedSettings = {
      ...(currentSettings?.settings || {}),
      [key]: value,
    };

    return await upsertUserSettings(userId, updatedSettings);
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to update user setting',
    );
  }
}

// Multi-model settings functions
export async function getUserDefaultModel(
  userId: string,
): Promise<string | null> {
  try {
    const settings = await getUserSettings(userId);
    return (settings?.settings as any)?.defaultModel || null;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get user default model',
    );
  }
}

export async function setUserDefaultModel(userId: string, modelId: string) {
  try {
    return await updateUserSetting(userId, 'defaultModel', modelId);
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to set user default model',
    );
  }
}

export async function getUserCompareModels(userId: string): Promise<string[]> {
  try {
    const settings = await getUserSettings(userId);
    return (settings?.settings as any)?.compareModels || [];
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get user compare models',
    );
  }
}

export async function setUserCompareModels(userId: string, modelIds: string[]) {
  try {
    return await updateUserSetting(userId, 'compareModels', modelIds);
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to set user compare models',
    );
  }
}

export async function getUserMode(
  userId: string,
): Promise<'single' | 'compare'> {
  try {
    const settings = await getUserSettings(userId);
    return (settings?.settings as any)?.mode || 'single';
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to get user mode');
  }
}

export async function setUserMode(userId: string, mode: 'single' | 'compare') {
  try {
    return await updateUserSetting(userId, 'mode', mode);
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to set user mode');
  }
}

// Convenience function to update both mode and models at once
export async function setUserModelSelection(
  userId: string,
  mode: 'single' | 'compare',
  modelIdOrIds: string | string[],
) {
  try {
    const settings: Record<string, any> = { mode };

    if (mode === 'single' && typeof modelIdOrIds === 'string') {
      settings.defaultModel = modelIdOrIds;
      settings.compareModels = []; // Clear compare models when switching to single mode
    } else if (mode === 'compare' && Array.isArray(modelIdOrIds)) {
      settings.compareModels = modelIdOrIds;
      settings.defaultModel = null; // Clear default model when switching to compare mode
    } else {
      throw new ChatSDKError(
        'bad_request:api',
        'Invalid mode or model selection combination',
      );
    }

    return await upsertUserSettings(userId, settings);
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to set user model selection',
    );
  }
}

// System Prompt functions
export async function getUserSystemPrompt(
  userId: string,
): Promise<UserSystemPrompt | null> {
  try {
    const settings = await getUserSettings(userId);
    return (settings?.settings as any)?.systemPrompt || null;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get user system prompt',
    );
  }
}

export async function updateUserSystemPrompt(
  userId: string,
  prompt: UserSystemPrompt,
): Promise<void> {
  try {
    const promptWithTimestamp = {
      ...prompt,
      updatedAt: new Date().toISOString(),
    };

    await updateUserSetting(userId, 'systemPrompt', promptWithTimestamp);
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to update user system prompt',
    );
  }
}

// Helper function to check if user has active subscription
export async function getUserType(
  userId: string,
  isAnonymous?: boolean,
): Promise<UserType> {
  try {
    // Anonymous users always get 'anonymous' type
    if (isAnonymous) {
      return 'anonymous';
    }

    const [userSubscription] = await db
      .select()
      .from(subscription)
      .where(eq(subscription.userId, userId))
      .limit(1);

    // Check if user has an active pro subscription
    if (
      userSubscription?.plan === 'pro' &&
      userSubscription?.status === 'active'
    ) {
      // Also check if subscription hasn't expired
      if (
        userSubscription.currentPeriodEnd &&
        userSubscription.currentPeriodEnd > new Date()
      ) {
        return 'pro';
      }
      // If expired, we should update the subscription status
      if (
        userSubscription.currentPeriodEnd &&
        userSubscription.currentPeriodEnd <= new Date()
      ) {
        await db
          .update(subscription)
          .set({ status: 'past_due' })
          .where(eq(subscription.userId, userId));
      }
    }

    return 'free';
  } catch (error) {
    const parsedError =
      error instanceof Error ? error : new Error(String(error));
    dbLogger.error(
      {
        userId,
        error: parsedError.message,
        stack: parsedError.stack,
      },
      'Error checking subscription status',
    );
    return 'free'; // Default to free on error
  }
}

// Get user subscription details
export async function getUserSubscription(userId: string) {
  try {
    const [userSubscription] = await db
      .select()
      .from(subscription)
      .where(eq(subscription.userId, userId))
      .limit(1);

    return userSubscription;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get user subscription',
    );
  }
}

// Get usage history for the last 30 days
export async function getUsageHistory(userId: string) {
  try {
    const now = new Date();
    const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const startDateString = `${start.getUTCFullYear()}-${String(
      start.getUTCMonth() + 1,
    ).padStart(2, '0')}-${String(start.getUTCDate()).padStart(2, '0')}`;

    return await db
      .select()
      .from(usageDaily)
      .where(
        and(
          eq(usageDaily.userId, userId),
          gte(usageDaily.day, startDateString),
        ),
      )
      .orderBy(desc(usageDaily.day));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get usage history',
    );
  }
}

// Get complete usage summary for a user
export async function getUserUsageSummary(userId: string) {
  try {
    // First determine user type to decide how to get usage data
    const userType = await getUserType(userId, false); // We'll determine if anonymous from user data

    const [userSubscription, usageHistory] = await Promise.all([
      getUserSubscription(userId),
      getUsageHistory(userId),
    ]);

    const isProUser =
      userSubscription?.plan === 'pro' && userSubscription?.status === 'active';

    // Use the same logic as getUserUsageAndLimits for consistency
    const usageInfo = await getUserUsageAndLimits({ userId, userType });

    let planName = 'Free';
    if (userType === 'anonymous') {
      planName = 'Guest';
    } else if (isProUser) {
      planName = 'Pro';
    }

    return {
      plan: {
        name: planName,
        quota: usageInfo.quota,
        used: usageInfo.used,
        resetInfo: usageInfo.resetInfo,
        type: usageInfo.type,
      },
      usage: usageHistory,
    };
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get user usage summary',
    );
  }
}

// ============================================================================
// AI Compare Run Queries
// ============================================================================

export async function createCompareRun({
  userId,
  chatId,
  prompt,
  modelIds,
}: {
  userId: string;
  chatId: string;
  prompt: string;
  modelIds: string[];
}) {
  try {
    // Create the compare run
    const [run] = await db
      .insert(compareRun)
      .values({
        userId,
        chatId,
        prompt,
        modelIds,
        status: 'running',
      })
      .returning();

    // Create result entries for each model
    const results = await db
      .insert(compareResult)
      .values(
        modelIds.map((modelId) => ({
          runId: run.id,
          modelId,
          status: 'running' as const,
          content: '',
        })),
      )
      .returning();

    return { run, results };
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to create compare run',
    );
  }
}

export async function appendCompareResultContent({
  runId,
  modelId,
  delta,
}: {
  runId: string;
  modelId: string;
  delta: string;
}) {
  try {
    // Get current content and append delta
    const [result] = await db
      .select({ content: compareResult.content })
      .from(compareResult)
      .where(
        and(eq(compareResult.runId, runId), eq(compareResult.modelId, modelId)),
      );

    if (!result) {
      throw new ChatSDKError('not_found:compare', 'Compare result not found');
    }

    const newContent = (result.content || '') + delta;

    await db
      .update(compareResult)
      .set({ content: newContent })
      .where(
        and(eq(compareResult.runId, runId), eq(compareResult.modelId, modelId)),
      );

    return newContent;
  } catch (error) {
    if (error instanceof ChatSDKError) throw error;
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to append compare result content',
    );
  }
}

export async function startCompareResultInference({
  runId,
  modelId,
}: {
  runId: string;
  modelId: string;
}) {
  try {
    await db
      .update(compareResult)
      .set({
        status: 'running',
        serverStartedAt: new Date(),
      })
      .where(
        and(eq(compareResult.runId, runId), eq(compareResult.modelId, modelId)),
      );
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to start compare result inference',
    );
  }
}

export async function completeCompareResult({
  runId,
  modelId,
  content,
  reasoning,
  usage,
  serverStartedAt,
  serverCompletedAt,
  inferenceTimeMs,
}: {
  runId: string;
  modelId: string;
  content: string;
  reasoning?: string;
  usage?: any;
  serverStartedAt?: Date;
  serverCompletedAt?: Date;
  inferenceTimeMs?: number;
}) {
  try {
    await db
      .update(compareResult)
      .set({
        status: 'completed',
        content,
        reasoning,
        usage,
        completedAt: new Date(),
        serverStartedAt,
        serverCompletedAt,
        inferenceTimeMs,
      })
      .where(
        and(eq(compareResult.runId, runId), eq(compareResult.modelId, modelId)),
      );
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to complete compare result',
    );
  }
}

export async function failCompareResult({
  runId,
  modelId,
  error: errorMessage,
}: {
  runId: string;
  modelId: string;
  error: string;
}) {
  try {
    await db
      .update(compareResult)
      .set({
        status: 'failed',
        error: errorMessage,
        completedAt: new Date(),
      })
      .where(
        and(eq(compareResult.runId, runId), eq(compareResult.modelId, modelId)),
      );
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to fail compare result',
    );
  }
}

export async function cancelCompareResult({
  runId,
  modelId,
}: {
  runId: string;
  modelId: string;
}) {
  try {
    await db
      .update(compareResult)
      .set({
        status: 'canceled',
        completedAt: new Date(),
      })
      .where(
        and(eq(compareResult.runId, runId), eq(compareResult.modelId, modelId)),
      );
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to cancel compare result',
    );
  }
}

export async function completeCompareRun({ runId }: { runId: string }) {
  try {
    await db
      .update(compareRun)
      .set({
        status: 'completed',
        updatedAt: new Date(),
      })
      .where(eq(compareRun.id, runId));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to complete compare run',
    );
  }
}

export async function cancelCompareRun({ runId }: { runId: string }) {
  try {
    // Cancel the run
    await db
      .update(compareRun)
      .set({
        status: 'canceled',
        updatedAt: new Date(),
      })
      .where(eq(compareRun.id, runId));

    // Cancel all running results
    await db
      .update(compareResult)
      .set({
        status: 'canceled',
        completedAt: new Date(),
      })
      .where(
        and(
          eq(compareResult.runId, runId),
          eq(compareResult.status, 'running'),
        ),
      );
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to cancel compare run',
    );
  }
}

export async function getCompareRun({ runId }: { runId: string }) {
  try {
    const [run] = await db
      .select()
      .from(compareRun)
      .where(eq(compareRun.id, runId));

    if (!run) {
      throw new ChatSDKError('not_found:compare', 'Compare run not found');
    }

    const results = await db
      .select()
      .from(compareResult)
      .where(eq(compareResult.runId, runId))
      .orderBy(asc(compareResult.createdAt));

    return { run, results };
  } catch (error) {
    if (error instanceof ChatSDKError) throw error;
    throw new ChatSDKError('bad_request:database', 'Failed to get compare run');
  }
}

export async function listCompareRunsByChat({
  chatId,
  limit = 50,
  cursor,
}: {
  chatId: string;
  limit?: number;
  cursor?: string;
}) {
  try {
    const conditions = [eq(compareRun.chatId, chatId)];

    if (cursor) {
      conditions.push(gt(compareRun.createdAt, new Date(cursor)));
    }

    const runs = await db
      .select()
      .from(compareRun)
      .where(and(...conditions))
      .orderBy(asc(compareRun.createdAt))
      .limit(limit + 1); // Get one extra to check if there are more

    const hasMore = runs.length > limit;
    const items = hasMore ? runs.slice(0, -1) : runs;
    const nextCursor = hasMore
      ? items[items.length - 1]?.createdAt.toISOString()
      : null;

    // 🚀 PERFORMANCE OPTIMIZATION: Batch load ALL results in single query
    if (items.length === 0) {
      return { items: [], nextCursor, hasMore };
    }

    const runIds = items.map((run) => run.id);
    const allResults = await db
      .select()
      .from(compareResult)
      .where(inArray(compareResult.runId, runIds))
      .orderBy(asc(compareResult.createdAt));

    // Group results by runId for O(1) lookup
    const resultsByRunId = allResults.reduce(
      (acc, result) => {
        if (!acc[result.runId]) acc[result.runId] = [];
        acc[result.runId].push(result);
        return acc;
      },
      {} as Record<string, typeof allResults>,
    );

    // Attach results to runs
    const itemsWithResults = items.map((run) => ({
      ...run,
      results: resultsByRunId[run.id] || [],
    }));

    return {
      items: itemsWithResults,
      nextCursor,
      hasMore,
    };
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to list compare runs',
    );
  }
}

export async function listCompareRunsByUser({
  userId,
  limit = 50,
  cursor,
}: {
  userId: string;
  limit?: number;
  cursor?: string;
}) {
  try {
    const conditions = [eq(compareRun.userId, userId)];

    if (cursor) {
      conditions.push(gt(compareRun.createdAt, new Date(cursor)));
    }

    const runs = await db
      .select()
      .from(compareRun)
      .where(and(...conditions))
      .orderBy(asc(compareRun.createdAt))
      .limit(limit + 1);

    const hasMore = runs.length > limit;
    const items = hasMore ? runs.slice(0, -1) : runs;
    const nextCursor = hasMore
      ? items[items.length - 1]?.createdAt.toISOString()
      : null;

    return {
      items,
      nextCursor,
      hasMore,
    };
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to list compare runs by user',
    );
  }
}

// ============================================================================
// MODEL CACHE QUERIES
// ============================================================================

export async function getActiveModelCache() {
  try {
    // We need to use Supabase client directly for ModelCache table
    // since it's in Supabase storage, not our local database
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();

    const { data: cache } = await supabase
      .from('ModelCache')
      .select('models')
      .eq('status', 'active')
      .gt('expiresAt', new Date().toISOString())
      .order('lastRefreshedAt', { ascending: false })
      .limit(1)
      .single();

    return cache;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get active model cache',
    );
  }
}

// ============================================================================
// NEW USAGE TRACKING SYSTEM
// ============================================================================

// Cost calculation utility using model pricing
export function calculateCost(modelId: string, usage: any): number {
  // Model pricing in USD per 1M tokens (input, output)
  const pricing: Record<string, { input: number; output: number }> = {
    // Add more models as needed
  };

  const modelPricing = pricing[modelId];
  if (!modelPricing) return 0;

  const inputTokens = usage?.promptTokens || 0;
  const outputTokens = usage?.completionTokens || 0;

  const inputCost = (inputTokens / 1_000_000) * modelPricing.input;
  const outputCost = (outputTokens / 1_000_000) * modelPricing.output;

  // Return cost in cents to avoid floating point issues
  return Math.round((inputCost + outputCost) * 100);
}

// Batch insert chat usage - CRITICAL for multi-model efficiency
interface UsageRecord {
  userId: string;
  chatId: string | null; // NULL for deleted chats
  modelId: string;
  tokensIn: number;
  tokensOut: number;
  cost: number; // In cents
}

export async function batchInsertChatUsage(records: UsageRecord[]) {
  try {
    if (records.length === 0) return;

    dbLogger.info(
      { recordCount: records.length },
      'Batch inserting usage records',
    );

    return await db.insert(chatUsage).values(records);
  } catch (error) {
    dbLogger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        recordCount: records.length,
      },
      'Failed to batch insert usage records',
    );
    throw new ChatSDKError('bad_request:database', 'Failed to track usage');
  }
}

// Ultra-minimal query for raw usage data (client-side computation)
export async function getUserUsageData(userId: string, limit = 25, page = 1) {
  try {
    const offset = (page - 1) * limit;

    const [usageData, totalCount] = await Promise.all([
      db
        .select()
        .from(chatUsage)
        .where(eq(chatUsage.userId, userId))
        .orderBy(desc(chatUsage.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: count() })
        .from(chatUsage)
        .where(eq(chatUsage.userId, userId)),
    ]);

    return {
      items: usageData,
      total: totalCount[0].count,
      page,
      limit,
      hasMore: offset + limit < totalCount[0].count,
    };
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get user usage data',
    );
  }
}

// Server-side validation functions for security (cannot trust client data)
export async function getCurrentUserUsage(userId: string) {
  try {
    const [result] = await db
      .select({
        totalTokens: sql<number>`SUM(${chatUsage.tokensIn} + ${chatUsage.tokensOut})`,
        totalCostCents: sql<number>`SUM(${chatUsage.cost})`,
        totalChats: sql<number>`COUNT(DISTINCT ${chatUsage.chatId})`,
        activeChats: sql<number>`COUNT(DISTINCT CASE WHEN ${chatUsage.chatId} IS NOT NULL THEN ${chatUsage.chatId} END)`,
      })
      .from(chatUsage)
      .where(eq(chatUsage.userId, userId));

    return (
      result || {
        totalTokens: 0,
        totalCostCents: 0,
        totalChats: 0,
        activeChats: 0,
      }
    );
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get current user usage',
    );
  }
}

// Get usage data with server validation context for API
export async function getUserUsageWithValidation(
  userId: string,
  userType: UserType,
  page = 1,
  limit = 25,
) {
  try {
    // Get raw data for client computation
    const usageData = await getUserUsageData(userId, limit, page);

    // Get server validation data
    const currentUsage = await getCurrentUserUsage(userId);
    const usageInfo = await getUserUsageAndLimits({ userId, userType });

    // Generate server-side warnings/limits for security
    const warnings: Array<{
      type: string;
      message: string;
      severity: string;
    }> = [];
    const warningThreshold = 0.8;

    if (usageInfo.used > usageInfo.quota * warningThreshold) {
      warnings.push({
        type: 'quota',
        message: `You've used ${Math.round(
          (usageInfo.used / usageInfo.quota) * 100,
        )}% of your quota`,
        severity: 'warning',
      });
    }

    return {
      ...usageData,
      // Server validation context
      limits: {
        quota: usageInfo.quota,
        used: usageInfo.used,
        remaining: usageInfo.quota - usageInfo.used,
        type: usageInfo.type,
        resetInfo: usageInfo.resetInfo,
      },
      currentUsage: {
        totalTokens: currentUsage.totalTokens || 0,
        totalCost:
          Math.round(((currentUsage.totalCostCents || 0) / 100) * 10000) /
          10000, // Convert cents to dollars with 4 decimal places
        totalChats: currentUsage.totalChats || 0,
        activeChats: currentUsage.activeChats || 0,
      },
      warnings,
    };
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get user usage with validation',
    );
  }
}
