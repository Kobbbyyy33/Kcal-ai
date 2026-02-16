import type { DraftItem } from "@/components/DraftMealEditor";
import type { MealType } from "@/types";

type OfflineMealPayload = {
  date: string;
  meal_type: MealType;
  meal_name: string;
  items: DraftItem[];
  image_url?: string | null;
  queued_at: string;
};

const OFFLINE_MEAL_QUEUE_KEY = "kcal-ai:offline-meal-queue:v1";

function readQueue(): OfflineMealPayload[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(OFFLINE_MEAL_QUEUE_KEY);
    const parsed = raw ? (JSON.parse(raw) as OfflineMealPayload[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: OfflineMealPayload[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(OFFLINE_MEAL_QUEUE_KEY, JSON.stringify(queue));
}

export function enqueueOfflineMeal(payload: Omit<OfflineMealPayload, "queued_at">) {
  const queue = readQueue();
  queue.push({ ...payload, queued_at: new Date().toISOString() });
  writeQueue(queue);
}

export async function flushOfflineMealQueue(
  saveMeal: (payload: OfflineMealPayload) => Promise<void>
): Promise<number> {
  const queue = readQueue();
  if (queue.length === 0) return 0;
  const failed: OfflineMealPayload[] = [];
  let synced = 0;

  for (const item of queue) {
    try {
      await saveMeal(item);
      synced += 1;
    } catch {
      failed.push(item);
    }
  }

  writeQueue(failed);
  return synced;
}

export function getOfflineQueueSize() {
  return readQueue().length;
}

