import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { FocusSession } from "../types";
import { dailyTotals, heatmapScale, heatmapLevel, localDayKey } from "../analytics/analytics";
import { formatDuration } from "../data";
import { localeCode } from "../i18n";
type HeatmapDay = { key: string; date: Date; seconds: number; count: number };
export function ActivityHeatmap({
  sessions,
  explainScale = false,
}: {
  sessions: FocusSession[];
  explainScale?: boolean;
}) {
  const { t } = useTranslation();
  const points = dailyTotals(sessions),
    scale = heatmapScale(sessions),
    scrollRef = useRef<HTMLDivElement>(null),
    [selected, setSelected] = useState<HeatmapDay>();
  const trackingStart = points[0]?.start ?? Date.now();
  const start = new Date(trackingStart),
    end = new Date();
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  end.setDate(end.getDate() + ((7 - end.getDay()) % 7));
  const totals = new Map(points.map((point) => [point.key, point])),
    weeks: HeatmapDay[][] = [];
  let week: HeatmapDay[] = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = localDayKey(d.getTime()),
      point = totals.get(key);
    week.push({
      key,
      date: new Date(d),
      seconds: point?.seconds ?? 0,
      count: point?.sessionCount ?? 0,
    });
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollLeft = node.scrollWidth;
  }, [weeks.length]);
  if (!points.length) return null;
  const markers = weeks
    .map((days, index) => {
      const date = days[0].date,
        previous = index ? weeks[index - 1][0].date : undefined;
      return !previous || date.getMonth() !== previous.getMonth()
        ? {
            index,
            label:
              date.getMonth() === 0 || !previous
                ? date.toLocaleDateString(localeCode(), {
                    month: "short",
                    year: "numeric",
                  })
                : date.toLocaleDateString(localeCode(), { month: "short" }),
          }
        : undefined;
    })
    .filter(Boolean) as { index: number; label: string }[];
  const selectedSessions = selected
      ? sessions.filter((session) => localDayKey(session.startTime) === selected.key)
      : [],
    breakdown = [
      ...selectedSessions.reduce(
        (map, session) =>
          map.set(session.subjectName, (map.get(session.subjectName) ?? 0) + session.focusedDurationSeconds),
        new Map<string, number>(),
      ),
    ].sort((a, b) => b[1] - a[1]);
  return (
    <>
      <div className="heatmap-shell">
        <div className="weekday-labels">
          <span>{t("Mon")}</span>
          <span>{t("Wed")}</span>
          <span>{t("Fri")}</span>
          <span>{t("Sun")}</span>
        </div>
        <div className="heatmap-scroll" ref={scrollRef}>
          <div className="heatmap-months" style={{ width: weeks.length * 14 }}>
            {markers.map((marker) => (
              <span key={`${marker.index}-${marker.label}`} style={{ left: marker.index * 14 }}>
                {marker.label}
              </span>
            ))}
          </div>
          <div className="heatmap-weeks">
            {weeks.map((days, index) => (
              <div className="heatmap-week" key={index}>
                {days.map((day) =>
                  day.date.getTime() < trackingStart || day.date.getTime() > Date.now() ? (
                    <span key={day.key} aria-hidden="true" />
                  ) : (
                    <button
                      aria-label={`${day.date.toLocaleDateString(localeCode())}, ${formatDuration(day.seconds)}, ${t("{{count}} sessions", { count: day.count })}`}
                      aria-pressed={selected?.key === day.key}
                      title={`${day.date.toLocaleDateString(localeCode(), { weekday: "short", day: "numeric", month: "short", year: "numeric" })}\n${formatDuration(day.seconds)}\n${t("{{count}} Sessions", { count: day.count })}`}
                      onClick={() => setSelected(day)}
                      onFocus={() => setSelected(day)}
                      key={day.key}
                      className={`heat-${heatmapLevel(day.seconds, scale.step)}`}
                    />
                  ),
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      {selected && (
        <div className="heatmap-detail" role="status">
          <strong>
            {selected.date.toLocaleDateString(localeCode(), {
              weekday: "short",
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </strong>
          <span>
            {formatDuration(selected.seconds)} · {t("{{count}} Sessions", { count: selected.count })}
          </span>
          {breakdown.slice(0, 3).map(([name, seconds]) => (
            <span key={name} title={name}>
              {name}: {formatDuration(seconds)}
            </span>
          ))}
          {breakdown.length > 3 && <span>{t("+{{count}} more", { count: breakdown.length - 3 })}</span>}
        </div>
      )}
      <div className="heatmap-legend">
        <span>
          <i className="heat-0" />
          {t("No study")}
        </span>
        {scale.thresholds.map((threshold, index) => (
          <span key={threshold}>
            <i className={`heat-${index + 1}`} />
            {index < 3 ? `≤ ${formatDuration(threshold)}` : `> ${formatDuration(scale.thresholds[2])}`}
          </span>
        ))}
      </div>
      {explainScale && (
        <p className="panel-foot">
          {t("90th percentile: {{percentile}} · Four intervals of {{interval}}", {
            percentile: formatDuration(scale.p90),
            interval: formatDuration(scale.step),
          })}
        </p>
      )}
    </>
  );
}
