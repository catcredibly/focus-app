import { validSessions } from "./sessionValidity";
import { noteMetrics } from "./notes";
import { db, type FocusDatabase } from "./db";
import { goalProgress, localDayBounds, localWeekBounds } from "./goals";
import { loadSettings } from "./settings";
import type { FocusSession } from "./types";
import type { ToastMessage } from "./toasts";

/** Claim notifications in the save transaction so concurrent timer webviews cannot
 * celebrate the same session twice. Recovery/import/edit callers never opt in. */
export async function saveFocusSession(
  session: FocusSession,
  live = false,
  database: FocusDatabase = db,
  now = Date.now(),
) {
  if (!noteMetrics(session.note ?? "").valid) throw new Error("Note exceeds the allowed limits.");
  return database.transaction("rw", database.sessions, database.settings, database.academicYears, async () => {
    const messages: { message: ToastMessage; kind: "daily" | "weekly" }[] = [];
    if (await database.sessions.get(session.id)) return messages;
    if (live) {
      const settings = await loadSettings(database, false);
      const years = await database.academicYears.toArray();
      const sessions = validSessions(await database.sessions.toArray(), years);
      const before = goalProgress(sessions, now),
        after = goalProgress(validSessions([...sessions, session], years), now);
      for (const kind of ["daily", "weekly"] as const) {
        const target = settings[`${kind}GoalSeconds`];
        const period = kind === "daily" ? localDayBounds(now) : localWeekBounds(now);
        const key = `goalCompletion.${kind}`;
        if (
          settings[`${kind}GoalEnabled`] &&
          target > 0 &&
          before[`${kind}Seconds`] < target &&
          after[`${kind}Seconds`] >= target &&
          (await database.settings.get(key))?.value !== String(period.start)
        ) {
          await database.settings.put({ key, value: String(period.start) });
          messages.push({ message: kind === "daily" ? "Daily goal completed" : "Weekly goal completed", kind });
        }
      }
    }
    await database.sessions.add(session);
    return messages;
  });
}
