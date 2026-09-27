import { ArrowRight, Check, GraduationCap, Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSettings } from "../hooks/useSettings";
import type { Locale } from "../settings";

export function TimerSetup({ step, onNavigate }: { step: 1 | 2; onNavigate: (page: string) => void }) {
  const { t } = useTranslation();
  const { settings, setSetting } = useSettings();
  const themeLabel = t(settings.theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
  const steps = [
    ["Create an Academic Year", "Example names: 2026–27 · First Year · Self-study"],
    ["Add a Subject", "Example names: Linear Algebra · Organic Chemistry · Guitar Practice"],
    ["Start your first Session", ""],
  ];
  return (
    <section className="timer-setup" aria-labelledby="setup-title">
      <div className="setup-preferences">
        <label>
          {t("Language")}
          <select
            value={settings.language}
            onChange={(event) => void setSetting("language", event.target.value as Locale)}
          >
            <option value="en">English</option>
            <option value="zh-CN">简体中文</option>
            <option value="zh-TW">繁體中文</option>
            <option value="ja">日本語</option>
          </select>
        </label>
        <button
          className="icon-button"
          title={themeLabel}
          aria-label={themeLabel}
          onClick={() => void setSetting("theme", settings.theme === "dark" ? "light" : "dark")}
        >
          {settings.theme === "dark" ? <Moon /> : <Sun />}
        </button>
      </div>
      <GraduationCap className="setup-illustration" aria-hidden="true" />
      <h1 id="setup-title">{t("Set up Shihen")}</h1>
      <p>{t("Create an Academic Year and a Subject before starting your first Session.")}</p>
      <ol className="setup-steps">
        {steps.map(([title, hint], index) => (
          <li
            key={title}
            className={index + 1 === step ? "active" : index + 1 < step ? "completed" : "upcoming"}
            aria-current={index + 1 === step ? "step" : undefined}
          >
            <span className="setup-step-number" aria-hidden="true">
              {index + 1 < step ? <Check size={18} /> : index + 1}
            </span>
            <div>
              <strong>{t(title)}</strong>
              {hint && <p>{t(hint)}</p>}
            </div>
          </li>
        ))}
      </ol>
      <button className="primary-action" onClick={() => onNavigate(step === 1 ? "Academic Years" : "Subjects")}>
        {t(step === 1 ? "Set up Academic Year" : "Add a Subject")}
        <ArrowRight size={18} />
      </button>
    </section>
  );
}
