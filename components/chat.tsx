'use client';

import { DefaultChatTransport } from 'ai';
import { useChat } from '@ai-sdk/react';
import { useEffect, useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { ChatHeader } from '@/components/chat-header';
import type { Vote } from '@/lib/db/schema';
import { fetcher, fetchWithErrorHandlers, generateUUID } from '@/lib/utils';
import { Artifact } from './artifact';
import { MultimodalInput } from './multimodal-input';
import { Messages } from './messages';
import type { VisibilityType } from './visibility-selector';
import { useArtifactSelector } from '@/hooks/use-artifact';
import { unstable_serialize } from 'swr/infinite';
import { getChatHistoryPaginationKey } from './sidebar-history';
import { toast } from './toast';
import type { Session } from 'next-auth';
import { useSearchParams } from 'next/navigation';
import { useChatVisibility } from '@/hooks/use-chat-visibility';
import { useAutoResume } from '@/hooks/use-auto-resume';
import { ChatSDKError } from '@/lib/errors';
import type { Attachment, ChatMessage } from '@/lib/types';
import { useDataStream } from './data-stream-provider';
import { CompareView } from './compare-view';

export function Chat({
  id,
  initialMessages,
  initialChatModel,
  initialVisibilityType,
  isReadonly,
  session,
  autoResume,
}: {
  id: string;
  initialMessages: ChatMessage[];
  initialChatModel: string;
  initialVisibilityType: VisibilityType;
  isReadonly: boolean;
  session: Session;
  autoResume: boolean;
}) {
  const { visibilityType } = useChatVisibility({
    chatId: id,
    initialVisibilityType,
  });

  const { mutate } = useSWRConfig();
  const { setDataStream } = useDataStream();

  const [input, setInput] = useState<string>('');

  const {
    messages,
    setMessages,
    sendMessage,
    status,
    stop,
    regenerate,
    resumeStream,
  } = useChat<ChatMessage>({
    id,
    messages: initialMessages,
    experimental_throttle: 100,
    generateId: generateUUID,
    transport: new DefaultChatTransport({
      api: '/api/chat',
      fetch: fetchWithErrorHandlers,
      prepareSendMessagesRequest({ messages, id, body }) {
        return {
          body: {
            id,
            message: messages.at(-1),
            selectedChatModel: initialChatModel,
            selectedVisibilityType: visibilityType,
            ...body,
          },
        };
      },
    }),
    onData: (dataPart) => {
      setDataStream((ds) => (ds ? [...ds, dataPart] : []));
    },
    onFinish: () => {
      mutate(unstable_serialize(getChatHistoryPaginationKey));
    },
    onError: (error) => {
      if (error instanceof ChatSDKError) {
        toast({
          type: 'error',
          description: error.message,
        });
      }
    },
  });

  const searchParams = useSearchParams();
  const query = searchParams.get('query');

  const [hasAppendedQuery, setHasAppendedQuery] = useState(false);

  useEffect(() => {
    if (query && !hasAppendedQuery) {
      sendMessage({
        role: 'user' as const,
        parts: [{ type: 'text', text: query }],
      });

      setHasAppendedQuery(true);
      window.history.replaceState({}, '', `/chat/${id}`);
    }
  }, [query, sendMessage, hasAppendedQuery, id]);

  const { data: votes } = useSWR<Array<Vote>>(
    messages.length >= 2 ? `/api/vote?chatId=${id}` : null,
    fetcher,
  );

  const [attachments, setAttachments] = useState<Array<Attachment>>([]);
  const isArtifactVisible = useArtifactSelector((state) => state.isVisible);

  // Compare mode state
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [compareModels, setCompareModels] = useState<string[]>([]);

  useAutoResume({
    autoResume,
    initialMessages,
    resumeStream,
    setMessages,
  });

  // Handle compare mode activation
  const handleCompareMode = async (models: string[], prompt: string) => {
    try {
      // Add the user message to the messages state
      const userMessageId = generateUUID();
      const userMessage = {
        id: userMessageId,
        role: 'user' as const,
        parts: [{ type: 'text' as const, text: prompt }],
      };

      setMessages((prev) => [...prev, userMessage]);

      // Optimistically enter compare mode
      setIsCompareMode(true);
      setCompareModels(models);
      setInput(''); // Clear the input after starting comparison

      // Call the compare API endpoint
      const response = await fetch(`/api/chat/compare`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: id,
          message: {
            id: generateUUID(),
            role: 'user',
            parts: [{ type: 'text', text: prompt }],
          },
          selectedModels: models,
          selectedVisibilityType: visibilityType,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('Compare API error:', errorData);
        throw new Error(`API returned ${response.status}: ${errorData}`);
      }

      // Handle the streaming response
      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  console.log('Parsed streaming data:', data);

                  // Handle different chunk types from the AI SDK
                  if (data.type === 'text-delta' && data.experimental_modelId) {
                    // Handle streaming text updates with model identification
                    const modelId = data.experimental_modelId;
                    const textContent = data.delta || '';
                    const messageId = data.id;

                    console.log(
                      'Processing text-delta for model:',
                      modelId,
                      'text:',
                      textContent,
                    );

                    setMessages((prev) => {
                      console.log('Current messages state:', prev);
                      const existing = prev.find(
                        (m) =>
                          m.role === 'assistant' &&
                          (m as any).modelId === modelId &&
                          m.id === messageId,
                      );
                      console.log('Found existing message:', existing);

                      if (existing) {
                        // Update existing message
                        return prev.map((m) =>
                          m.id === messageId
                            ? {
                                ...m,
                                parts: [
                                  {
                                    type: 'text' as const,
                                    text:
                                      ((m.parts[0] as any)?.text || '') +
                                      textContent,
                                  },
                                ],
                              }
                            : m,
                        );
                      } else {
                        // Create new message
                        return [
                          ...prev,
                          {
                            id: messageId,
                            role: 'assistant' as const,
                            parts: [
                              {
                                type: 'text' as const,
                                text: textContent,
                              },
                            ],
                            modelId: modelId,
                          },
                        ];
                      }
                    });
                  } else if (data.type === 'finish') {
                    // Handle completion
                    console.log('Stream finished');
                  } else {
                    // Log other chunk types for debugging
                    console.log('Unhandled chunk type:', data.type, data);
                  }
                } catch (parseError) {
                  console.error('Error parsing streaming data:', parseError);
                }
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
      }

      toast({ type: 'success', description: 'Compare mode started!' });
    } catch (error) {
      console.error('Error starting compare mode:', error);

      // Revert optimistic updates on error
      setIsCompareMode(false);
      setCompareModels([]);
      setInput(prompt); // Restore the input

      toast({
        type: 'error',
        description: `Failed to start comparison mode: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  };

  // Handle continuing with a single model
  const handleContinueWithModel = (modelId: string) => {
    setIsCompareMode(false);
    setCompareModels([]);
    // Update the chat to use the selected model
    // This would typically involve updating the chat settings
    toast({ type: 'success', description: `Continuing with ${modelId}` });
  };

  // Handle closing compare mode
  const handleCloseCompareMode = () => {
    setIsCompareMode(false);
    setCompareModels([]);
  };

  // Render compare mode or normal chat
  if (isCompareMode) {
    return (
      <CompareView
        chatId={id}
        selectedModels={compareModels}
        onClose={handleCloseCompareMode}
        onContinueWithModel={handleContinueWithModel}
        initialMessages={messages}
      />
    );
  }

  return (
    <>
      <div className="flex flex-col min-w-0 h-dvh bg-background">
        <ChatHeader
          chatId={id}
          selectedVisibilityType={initialVisibilityType}
          isReadonly={isReadonly}
          session={session}
        />

        <Messages
          chatId={id}
          status={status}
          votes={votes}
          messages={messages}
          setMessages={setMessages}
          regenerate={regenerate}
          isReadonly={isReadonly}
          isArtifactVisible={isArtifactVisible}
        />

        <form className="flex mx-auto px-4 bg-background pb-4 md:pb-6 gap-2 w-full md:max-w-3xl">
          {!isReadonly && (
            <MultimodalInput
              chatId={id}
              input={input}
              setInput={setInput}
              status={status}
              stop={stop}
              attachments={attachments}
              setAttachments={setAttachments}
              messages={messages}
              setMessages={setMessages}
              sendMessage={sendMessage}
              selectedVisibilityType={visibilityType}
              session={session}
              selectedModelId={initialChatModel}
              onCompareMode={handleCompareMode}
            />
          )}
        </form>
      </div>

      <Artifact
        chatId={id}
        input={input}
        setInput={setInput}
        status={status}
        stop={stop}
        attachments={attachments}
        setAttachments={setAttachments}
        sendMessage={sendMessage}
        messages={messages}
        setMessages={setMessages}
        regenerate={regenerate}
        votes={votes}
        isReadonly={isReadonly}
        selectedVisibilityType={visibilityType}
      />
    </>
  );
}
