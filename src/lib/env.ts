import { z } from "zod";

const optionalTrimmedString = z.string().trim().min(1).optional();
const optionalUrl = z.string().trim().url().optional();

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: optionalUrl,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: optionalTrimmedString,
});

const serverEnvSchema = publicEnvSchema.extend({
  SUPABASE_URL: optionalUrl,
  SUPABASE_PUBLISHABLE_KEY: optionalTrimmedString,
  OPENAI_API_KEY: optionalTrimmedString,
  FDC_API_KEY: optionalTrimmedString,
  OPENAI_LABEL_MODEL: optionalTrimmedString,
  OPENAI_COACH_MODEL: optionalTrimmedString,
});

export const publicEnv = publicEnvSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
});

export const serverEnv = serverEnvSchema.parse({
  ...publicEnv,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  FDC_API_KEY: process.env.FDC_API_KEY,
  OPENAI_LABEL_MODEL: process.env.OPENAI_LABEL_MODEL,
  OPENAI_COACH_MODEL: process.env.OPENAI_COACH_MODEL,
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;
