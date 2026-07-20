import { z } from "zod";

const optionalTrimmedString = z.string().trim().min(1).optional();

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: optionalTrimmedString,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: optionalTrimmedString,
});

const serverEnvSchema = publicEnvSchema.extend({
  OPENAI_API_KEY: optionalTrimmedString,
  OPENAI_LABEL_MODEL: optionalTrimmedString,
});

export const publicEnv = publicEnvSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
});

export const serverEnv = serverEnvSchema.parse({
  ...publicEnv,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_LABEL_MODEL: process.env.OPENAI_LABEL_MODEL,
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;
