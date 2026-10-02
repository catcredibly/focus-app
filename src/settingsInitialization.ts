import { synchronizeStartup } from "./autostart";
import { db, type FocusDatabase } from "./db";
import { loadSettings } from "./settings";
/** One initialization per webview; failures can be retried by a subsequent mount. */
export function createSettingsInitializer(database: FocusDatabase = db) {
  let pending: Promise<void> | undefined;
  return () => {
    if (!pending) {
      pending = loadSettings(database)
        .then(async () => {
          try {
            await synchronizeStartup(database);
          } catch (error) {
            pending = undefined;
            console.error(error);
          }
        })
        .catch((error) => {
          pending = undefined;
          throw error;
        });
    }
    return pending;
  };
}
export const initializeSettings = createSettingsInitializer();
