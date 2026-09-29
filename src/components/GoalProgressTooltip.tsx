import { useTranslation } from "react-i18next";
import type { GoalPoint } from "../analytics/goalAchievement";
import { formatDuration } from "../data";
import { localeCode } from "../i18n";

export function GoalProgressTooltip({ point }: { point?: GoalPoint & { label: string } }) {
  const { t } = useTranslation();
  if (!point) return null;
  const percentage = (point.goalPercent / 100).toLocaleString(localeCode(), {
    style: "percent",
    maximumFractionDigits: 1,
  });
  const goalLabel = point.mode === "daily" && point.grouping !== "daily"
    ? "Daily Goal: {{duration}}"
    : point.mode === "weekly" && point.grouping === "monthly"
      ? "Weekly Goal: {{duration}}"
      : "Goal: {{duration}}";
  return (
    <div className="chart-tooltip">
      <strong>{point.label}</strong>
      <p>{percentage}</p>
      <p>{t("Focus time: {{duration}}", { duration: point.seconds === 0 ? "0" : formatDuration(point.seconds) })}</p>
      <p>{t(goalLabel, { duration: formatDuration(point.goalSeconds) })}</p>

    </div>
  );
}
