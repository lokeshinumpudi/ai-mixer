import { documentHandlersByArtifactKind } from '@/lib/artifacts/server';
import { getDocumentById } from '@/lib/db/queries';
import type { AppUser } from '@/lib/supabase/types';
import type { ChatMessage } from '@/lib/types';
import { tool, type UIMessageStreamWriter } from 'ai';
import { z } from 'zod';
interface SelectedModel {
  id: string;
  supportsArtifacts: boolean;
  supportsReasoning: boolean;
}

interface UpdateDocumentProps {
  user: AppUser;
  dataStream: UIMessageStreamWriter<ChatMessage>;
  selectedModel: SelectedModel;
}

export const updateDocument = ({
  user,
  dataStream,
  selectedModel,
}: UpdateDocumentProps) =>
  tool({
    description: 'Update a document with the given description.',
    inputSchema: z.object({
      id: z.string().describe('The ID of the document to update'),
      description: z
        .string()
        .describe('The description of changes that need to be made'),
    }),
    execute: async ({ id, description }) => {
      const document = await getDocumentById({ id });

      if (!document) {
        return {
          error: 'Document not found',
        };
      }

      dataStream.write({
        type: 'data-clear',
        data: null,
        transient: true,
      });

      const documentHandler = documentHandlersByArtifactKind.find(
        (documentHandlerByArtifactKind) =>
          documentHandlerByArtifactKind.kind === document.kind,
      );

      if (!documentHandler) {
        throw new Error(`No document handler found for kind: ${document.kind}`);
      }

      await documentHandler.onUpdateDocument({
        document,
        description,
        dataStream,
        user: user as AppUser,
        selectedModel,
      });

      dataStream.write({ type: 'data-finish', data: null, transient: true });

      return {
        id,
        title: document.title,
        kind: document.kind,
        content: 'The document has been updated successfully.',
      };
    },
  });
