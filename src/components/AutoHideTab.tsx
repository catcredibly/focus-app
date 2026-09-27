import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSettings } from "../hooks/useSettings";
import { refreshTimerAutoHideTab } from "../native";

export function AutoHideTab() {
  const { t } = useTranslation();
  const { settings, loaded } = useSettings();
  const [edge, setEdge] = useState(settings.popoutAutoHideEdge);
  const revealing = useRef(false);
  const revealReset = useRef(0);
  const reveal = () => {
    if (revealing.current) return;
    revealing.current = true;
    void invoke("request_timer_reveal").finally(() => { revealReset.current = window.setTimeout(() => { revealing.current = false; }, 500); });
  };

  useEffect(() => {
    let stop: (() => void) | undefined;
    void getCurrentWindow().listen<string>("focus://auto-hide-tab-edge", ({ payload }) => setEdge(payload as typeof edge)).then((value) => { stop = value; });
    return () => stop?.();
  }, []);
  useEffect(() => {
    if (loaded) void refreshTimerAutoHideTab();
  }, [loaded, settings.popoutAutoHideTabSize]);
  useEffect(() => {
    const closed = () => { window.clearTimeout(revealReset.current); revealing.current = false; };
    const subscription = getCurrentWindow().listen("focus://popout-closed", closed);
    return () => { closed(); void subscription.then(stop => stop()); };
  }, []);

  return <main className="auto-hide-tab-window" data-accent={settings.accentColour} data-edge={edge} data-size={settings.popoutAutoHideTabSize}>
    <button aria-label={t("Open Shihen")} onPointerEnter={reveal} onClick={reveal}>{settings.popoutAutoHideShowAccent && <span/>}</button>
  </main>;
}
