import Dexie, { type Table } from "dexie";
import type { EntryMode } from "@/domain/rules";

export interface ActiveTimer {
  clientTimerId: string;
  userId: string;
  projectId: string;
  startTimeUtc: number;
  workNotes: string;
}
export interface LocalEntry {
  id: string;
  entryDate: string;
  fromTime: string;
  toTime: string;
  projectId: string | null;
  workNotes: string;
  entryMode: EntryMode;
  status: "pending" | "approved" | "rejected";
  createdAt: number;
  activityId?: string | null;
  taskId?: string | null;
  taskTitle?: string | null;
  taskNumber?: number | null;
  exported?: boolean;
}
export interface OutboxItem {
  id?: number;
  kind: "timer.start" | "timer.stop" | "entry.upsert" | "entry.delete";
  payload: unknown;
  userId?: string;
  createdAt: number;
}

class LucesemDB extends Dexie {
  activeTimers!: Table<ActiveTimer, string>;
  entries!: Table<LocalEntry, string>;
  syncOutbox!: Table<OutboxItem, number>;
  constructor() {
    super("lucesem");
    this.version(1).stores({
      activeTimers: "clientTimerId, userId",
      entries: "id, entryDate, projectId",
      syncOutbox: "++id, kind, createdAt",
    });
  }
}

let _db: LucesemDB | null = null;
/** Browser-only. Call inside effects / handlers. */
export const db = () => (_db ??= new LucesemDB());

export const uid = () => crypto.randomUUID();
