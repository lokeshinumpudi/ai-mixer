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
  type SQL,
} from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import type { ArtifactKind } from '@/components/artifact';
import type { VisibilityType } from '@/components/visibility-selector';
import { entitlementsByUserType } from '@/lib/ai/entitlements';

import type { UserType } from '@/lib/supabase/types';
import { sql } from 'drizzle-orm';
import { ChatSDKError } from '../errors';
import {
  chat,
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

// Ensure a user exists for Supabase OAuth sign-ins (using Supabase user ID)
export async function createOAuthUserIfNotExists(
  supabaseUserId: string,
  email: string,
) {
  try {
    // First check if user exists by Supabase ID
    const existingById = await db
      .select()
      .from(user)
      .where(eq(user.id, supabaseUserId));
    if (existingById.length > 0) return existingById[0];

    // Check if user exists by email (legacy users)
    const existingByEmail = await db
      .select()
      .from(user)
      .where(eq(user.email, email));
    if (existingByEmail.length > 0) {
      // Update existing user with Supabase ID
      const updated = await db
        .update(user)
        .set({ id: supabaseUserId })
        .where(eq(user.email, email))
        .returning();
      return updated[0];
    }

    // Create new user with Supabase ID
    const inserted = await db
      .insert(user)
      .values({
        id: supabaseUserId,
        email,
      })
      .returning();
    return inserted[0];
  } catch (error) {
    console.error('Error in createOAuthUserIfNotExists:', error);
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to ensure OAuth user',
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

    // Create new anonymous user with Supabase ID (no email)
    const inserted = await db
      .insert(user)
      .values({
        id: supabaseUserId,
        email: `anonymous-${supabaseUserId}@temp.local`, // Temporary email to satisfy NOT NULL constraint
      })
      .returning();
    return inserted[0];
  } catch (error) {
    console.error('Error in createAnonymousUserIfNotExists:', error);
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

    const query = (whereCondition?: SQL<any>) =>
      db
        .select()
        .from(chat)
        .where(
          whereCondition
            ? and(whereCondition, eq(chat.userId, id))
            : eq(chat.userId, id),
        )
        .orderBy(desc(chat.createdAt))
        .limit(extendedLimit);

    let filteredChats: Array<Chat> = [];

    if (startingAfter) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, startingAfter))
        .limit(1);

      if (!selectedChat) {
        throw new ChatSDKError(
          'not_found:database',
          `Chat with id ${startingAfter} not found`,
        );
      }

      filteredChats = await query(gt(chat.createdAt, selectedChat.createdAt));
    } else if (endingBefore) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, endingBefore))
        .limit(1);

      if (!selectedChat) {
        throw new ChatSDKError(
          'not_found:database',
          `Chat with id ${endingBefore} not found`,
        );
      }

      filteredChats = await query(lt(chat.createdAt, selectedChat.createdAt));
    } else {
      filteredChats = await query();
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

export async function getMessagesByChatId({ id }: { id: string }) {
  try {
    return await db
      .select()
      .from(message)
      .where(eq(message.chatId, id))
      .orderBy(asc(message.createdAt));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get messages by chat id',
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
    console.log('💾 Creating payment event record...');
    console.log('📝 Inserting payment event with data:', {
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
      metadataType: typeof metadata,
      metadataKeys: metadata ? Object.keys(metadata) : [],
    });

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

    console.log('✅ Payment event created successfully');
  } catch (error) {
    console.error('❌ Database error in createPaymentEvent:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      paymentId,
      userId,
    });

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
    console.log('💎 Setting subscription plan:', {
      userId,
      plan,
      status,
      currentPeriodEnd: currentPeriodEnd?.toISOString(),
    });

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

    console.log('✅ Subscription plan set successfully');
  } catch (error) {
    console.error('❌ Database error in setSubscriptionPlan:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userId,
      plan,
    });

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
    console.error('Error checking subscription status:', error);
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
  usage,
  serverStartedAt,
  serverCompletedAt,
  inferenceTimeMs,
}: {
  runId: string;
  modelId: string;
  content: string;
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

    // Load results for each run
    const itemsWithResults = await Promise.all(
      items.map(async (run) => {
        const results = await db
          .select()
          .from(compareResult)
          .where(eq(compareResult.runId, run.id))
          .orderBy(asc(compareResult.createdAt));

        return {
          ...run,
          results,
        };
      }),
    );

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
