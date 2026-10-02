import { createContext, useContext } from "react";
import { dailyFocusAllocations } from "../sessionAllocation";
import { dailyTotals } from "./analytics";
import type { createAnalyticsSnapshot } from "./snapshot";

export const AnalyticsSnapshotContext = createContext<ReturnType<typeof createAnalyticsSnapshot>>({
  getDays: dailyFocusAllocations,
  getDailyTotals: dailyTotals,
});
export const useAnalyticsSnapshot = () => useContext(AnalyticsSnapshotContext);
