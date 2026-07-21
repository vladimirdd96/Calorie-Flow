import { z } from "zod";

const emailSchema = z.string().trim().email();

export function prepareDiaryShareInvite(recipientEmail: string, ownerEmail?: string | null) {
  const result = emailSchema.safeParse(recipientEmail);
  if (!result.success) throw new Error("Enter a valid email address.");
  const normalizedRecipient = result.data.toLocaleLowerCase();
  if (ownerEmail && normalizedRecipient === ownerEmail.trim().toLocaleLowerCase()) throw new Error("Choose someone else to share with.");
  return normalizedRecipient;
}
