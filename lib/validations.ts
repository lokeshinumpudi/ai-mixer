import { z } from "zod";

// System Prompt Validation Schema
export const systemPromptSchema = z.object({
  name: z.string().max(100, "Name must be 100 characters or less").optional(),
  profession: z
    .string()
    .max(200, "Profession must be 200 characters or less")
    .optional(),
  traits: z
    .array(z.string().max(100, "Each trait must be 100 characters or less"))
    .max(50, "Maximum 50 traits allowed")
    .optional(),
  preferences: z
    .string()
    .max(3000, "Preferences must be 3000 characters or less")
    .optional(),
  updatedAt: z.string().optional(),
});

export type SystemPromptInput = z.infer<typeof systemPromptSchema>;

// Helper validation functions
export function validateSystemPrompt(data: unknown): SystemPromptInput {
  return systemPromptSchema.parse(data);
}

export function validateSystemPromptSafe(data: unknown): {
  success: boolean;
  data?: SystemPromptInput;
  error?: z.ZodError;
} {
  const result = systemPromptSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

// Character count helpers for frontend
export const SYSTEM_PROMPT_LIMITS = {
  NAME_MAX: 100,
  PROFESSION_MAX: 200,
  TRAITS_MAX_COUNT: 50,
  TRAIT_MAX_LENGTH: 100,
  PREFERENCES_MAX: 3000,
} as const;
