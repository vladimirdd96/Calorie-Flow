import type { CoachChat, CoachMessage, Food, Meal, Profile } from "./types";
import { getSupabase } from "./supabase";
import { z } from "zod";
import { coachChatSchema, coachMessageSchema, foodSchema, mealSchema, profileSchema } from "./schemas";

export type CloudSnapshot = {
  profile?: Profile;
  meals: Meal[];
  foods: Food[];
};

type CloudTable = "user_meals" | "user_foods";

function client() {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Cloud sync is not configured.");
  return supabase;
}

function isCoachThreadsUnavailable(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const record = error as Record<string, unknown>;
  const code = record.code;
  const message = typeof record.message === "string" ? record.message : "";
  return code === "42P01" || code === "42703" || code === "PGRST204" || code === "PGRST205"
    || /coach_(?:chats|messages).*?(?:does not exist|not found|schema cache)/i.test(message);
}

async function getLegacyCoachMessages(userId: string): Promise<CoachMessage[]> {
  const { data, error } = await client()
    .from("coach_messages")
    .select("id,role,content,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []).map((row) => coachMessageSchema.parse({
    id: row.id,
    chatId: `legacy-${userId}`,
    role: row.role,
    content: row.content,
    createdAt: row.created_at,
  }));
}

async function readAll<T>(table: CloudTable, userId: string, schema: z.ZodType<T>) {
  const rows: T[] = [];
  const pageSize = 500;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client()
      .from(table)
      .select("data")
      .eq("user_id", userId)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const page = z.array(z.object({ data: schema })).parse(data || []);
    rows.push(...page.map((row) => row.data));
    if (page.length < pageSize) return rows;
  }
}

async function upsertInChunks(table: CloudTable, rows: Array<Record<string, unknown>>) {
  for (let start = 0; start < rows.length; start += 200) {
    const { error } = await client().from(table).upsert(rows.slice(start, start + 200), { onConflict: "user_id,id" });
    if (error) throw error;
  }
}

export async function getCloudSnapshot(userId: string): Promise<CloudSnapshot> {
  const [{ data: profileRow, error: profileError }, meals, foods] = await Promise.all([
    client().from("user_profiles").select("data").eq("user_id", userId).maybeSingle(),
    readAll("user_meals", userId, mealSchema),
    readAll("user_foods", userId, foodSchema),
  ]);
  if (profileError) throw profileError;
  return { profile: profileSchema.optional().parse(profileRow?.data), meals, foods };
}

export async function upsertCloudProfile(userId: string, profile: Profile) {
  const { error } = await client().from("user_profiles").upsert({
    user_id: userId,
    data: profile,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function upsertCloudMeal(userId: string, meal: Meal) {
  const { error } = await client().from("user_meals").upsert({
    user_id: userId,
    id: meal.id,
    data: meal,
    created_at: meal.createdAt,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,id" });
  if (error) throw error;
}

export async function deleteCloudMeal(userId: string, mealId: string) {
  const { error } = await client().from("user_meals").delete().eq("user_id", userId).eq("id", mealId);
  if (error) throw error;
}

export async function upsertCloudFood(userId: string, food: Food) {
  const { error } = await client().from("user_foods").upsert({
    user_id: userId,
    id: food.id,
    data: food,
    updated_at: food.lastUsedAt || new Date().toISOString(),
  }, { onConflict: "user_id,id" });
  if (error) throw error;
}

export async function getCloudCoachChats(userId: string): Promise<CoachChat[]> {
  const { data, error } = await client().from("coach_chats").select("id,title,created_at,updated_at").eq("user_id", userId).order("updated_at", { ascending: false });
  if (error) {
    if (!isCoachThreadsUnavailable(error)) throw error;
    const messages = await getLegacyCoachMessages(userId);
    if (!messages.length) return [];
    const createdAt = messages[0].createdAt;
    const updatedAt = messages[messages.length - 1].createdAt;
    return [{ id: `legacy-${userId}`, title: "Past Coach conversation", createdAt, updatedAt }];
  }
  return (data || []).map((row) => coachChatSchema.parse({ id: row.id, title: row.title, createdAt: row.created_at, updatedAt: row.updated_at }));
}

export async function saveCloudCoachChat(userId: string, chat: CoachChat) {
  const { error } = await client().from("coach_chats").upsert({ user_id: userId, id: chat.id, title: chat.title, created_at: chat.createdAt, updated_at: chat.updatedAt }, { onConflict: "user_id,id" });
  if (error && !isCoachThreadsUnavailable(error)) throw error;
}

export async function getCloudCoachMessages(userId: string, chatId: string, limit = 120): Promise<CoachMessage[]> {
  const { data, error } = await client()
    .from("coach_messages")
    .select("id,chat_id,role,content,created_at")
    .eq("user_id", userId).eq("chat_id", chatId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    if (!isCoachThreadsUnavailable(error)) throw error;
    const messages = await getLegacyCoachMessages(userId);
    return messages.slice(-limit);
  }
  return (data || []).reverse().map((row) => coachMessageSchema.parse({
    id: row.id,
    chatId: row.chat_id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at,
  }));
}

export async function getAllCloudCoachMessages(userId: string): Promise<CoachMessage[]> {
  const messages: CoachMessage[] = [];
  const pageSize = 500;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client()
      .from("coach_messages")
      .select("id,chat_id,role,content,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const page = (data || []).map((row) => coachMessageSchema.parse({
      id: row.id,
      chatId: row.chat_id,
      role: row.role,
      content: row.content,
      createdAt: row.created_at,
    }));
    messages.push(...page);
    if (page.length < pageSize) return messages;
  }
}

export async function saveCloudCoachMessage(userId: string, message: CoachMessage) {
  const supabase = client();
  const { error } = await supabase.from("coach_messages").upsert({
    user_id: userId,
    id: message.id,
    chat_id: message.chatId,
    role: message.role,
    content: message.content,
    created_at: message.createdAt,
  }, { onConflict: "user_id,chat_id,id" });
  if (error) {
    if (!isCoachThreadsUnavailable(error)) throw error;
    const { error: legacyError } = await supabase.from("coach_messages").upsert({
      user_id: userId,
      id: message.id,
      role: message.role,
      content: message.content,
      created_at: message.createdAt,
    }, { onConflict: "user_id,id" });
    if (legacyError) throw legacyError;
    return;
  }
  const { error: chatError } = await supabase
    .from("coach_chats")
    .update({ updated_at: message.createdAt })
    .eq("user_id", userId)
    .eq("id", message.chatId);
  if (chatError) throw chatError;
}

export async function clearCloudCoachMessages(userId: string, chatId?: string) {
  let query = client().from("coach_messages").delete().eq("user_id", userId);
  if (chatId) query = query.eq("chat_id", chatId);
  const { error } = await query;
  if (error) {
    if (!isCoachThreadsUnavailable(error)) throw error;
    const { error: legacyError } = await client().from("coach_messages").delete().eq("user_id", userId);
    if (legacyError) throw legacyError;
  }
}

export async function deleteCloudCoachChat(userId: string, chatId: string) {
  const { error } = await client().from("coach_chats").delete().eq("user_id", userId).eq("id", chatId);
  if (error && !isCoachThreadsUnavailable(error)) throw error;
  if (error) {
    const { error: legacyError } = await client().from("coach_messages").delete().eq("user_id", userId);
    if (legacyError) throw legacyError;
  }
}

export async function pushCloudSnapshot(userId: string, snapshot: CloudSnapshot) {
  const now = new Date().toISOString();
  await Promise.all([
    snapshot.profile ? upsertCloudProfile(userId, snapshot.profile) : Promise.resolve(),
    upsertInChunks("user_meals", snapshot.meals.map((meal) => ({
      user_id: userId,
      id: meal.id,
      data: meal,
      created_at: meal.createdAt,
      updated_at: now,
    }))),
    upsertInChunks("user_foods", snapshot.foods.filter((food) => food.source !== "seed" || food.lastUsedAt).map((food) => ({
      user_id: userId,
      id: food.id,
      data: food,
      updated_at: food.lastUsedAt || now,
    }))),
  ]);
}

export async function replaceCloudSnapshot(userId: string, snapshot: CloudSnapshot) {
  const results = await Promise.all([
    client().from("user_profiles").delete().eq("user_id", userId),
    client().from("user_meals").delete().eq("user_id", userId),
    client().from("user_foods").delete().eq("user_id", userId),
  ]);
  const failure = results.find((result) => result.error)?.error;
  if (failure) throw failure;
  await pushCloudSnapshot(userId, snapshot);
}

export function mergeSnapshots(local: CloudSnapshot, remote: CloudSnapshot): CloudSnapshot {
  const meals = new Map(local.meals.map((meal) => [meal.id, meal]));
  remote.meals.forEach((meal) => meals.set(meal.id, meal));

  const foods = new Map(local.foods.map((food) => [food.id, food]));
  remote.foods.forEach((food) => {
    const current = foods.get(food.id);
    if (!current || (food.lastUsedAt || "") >= (current.lastUsedAt || "")) foods.set(food.id, food);
  });

  return {
    profile: remote.profile || local.profile,
    meals: [...meals.values()],
    foods: [...foods.values()],
  };
}
