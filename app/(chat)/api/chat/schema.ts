import { z } from 'zod';
import { SUPPORTED_MODEL_IDS } from '@/lib/constants';

const textPartSchema = z.object({
  type: z.enum(['text']),
  text: z.string().min(1).max(2000),
});

const filePartSchema = z.object({
  type: z.enum(['file']),
  mediaType: z.enum(['image/jpeg', 'image/png']),
  name: z.string().min(1).max(100),
  url: z.string().url(),
});

const partSchema = z.union([textPartSchema, filePartSchema]);

// Use supported models for validation
export const postRequestBodySchema = z.object({
  id: z.string().uuid(),
  message: z.object({
    id: z.string().uuid(),
    role: z.enum(['user']),
    parts: z.array(partSchema),
  }),
  selectedChatModel: z
    .string()
    .refine((modelId) => SUPPORTED_MODEL_IDS.includes(modelId as any), {
      message: 'Model not supported',
    }),
  selectedVisibilityType: z.enum(['public', 'private']),
});

export type PostRequestBody = z.infer<typeof postRequestBodySchema>;
