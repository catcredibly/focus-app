import { useEffect, useState } from "react";
import { startOfLocalDay } from "../analytics/analytics";
/** Align refreshes with minutes/midnight and catch up immediately after suspension. */
export function useAnalyticsClock() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      clearTimeout(timer);
      const stamp = Date.now();
      setNow(stamp);
      const midnight = new Date(stamp);
      midnight.setHours(24, 0, 0, 0);
      timer = setTimeout(refresh, Math.max(1, Math.min(60_000 - (stamp % 60_000), midnight.getTime() - stamp)));
    };
    const visible = () => {
      if (!document.hidden) refresh();
    };
    refresh();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);
  return { now, today: startOfLocalDay(now) };
}
