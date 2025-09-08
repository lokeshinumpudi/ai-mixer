import { z } from 'zod';

export const compareStreamRequestSchema = z.object({
  chatId: z.string().uuid(),
  prompt: z.string().min(1),
  modelIds: z.array(z.string()).min(1).max(3),
  runId: z.string().uuid().optional(), // For follow-ups
});

export type CompareStreamRequest = z.infer<typeof compareStreamRequestSchema>;

export const compareCancelRequestSchema = z.object({
  runId: z.string().uuid(),
  modelId: z.string().optional(), // If not provided, cancel all
});

export type CompareCancelRequest = z.infer<typeof compareCancelRequestSchema>;
