import { invoke, isTauri } from "@tauri-apps/api/core";
import { activePopoutSession, synchronizePopoutSession } from "./popoutLifecycle";
import { db } from "./db";
import { loadSettings, saveSetting, type DockCorner, type DockEdge, type FocusSettings } from "./settings";
import {
  cornerPosition,
  defaultEdgeForCorner,
  dockEdgeOffset,
  edgeOffset,
  nearestEdge,
  type WorkArea,
} from "./popoutPlacement";

export type TimerGeometry = {
  positioningSupported?: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
  visible: boolean;
  tabVisible: boolean;
  requested: boolean;
  generation: number;
  workArea: WorkArea;
};
export const timerGeometry = (monitorId = "current") => invoke<TimerGeometry>("get_timer_geometry", { monitorId });
let lastFloatingEdge: DockEdge | undefined;
export function resetPopoutTransientState() {
  lastFloatingEdge = undefined;
}

// Serialize native + persistence transitions across webviews. Read fresh settings
// inside the lock so stale React effects cannot undo an explicit Dock command.
export function withPopoutGeometry<T>(operation: () => Promise<T>): Promise<T> {
  return navigator.locks.request("focus.popout.geometry", operation);
}
async function persist(values: Partial<FocusSettings>) {
  await db.transaction("rw", db.settings, async () => {
    for (const [key, value] of Object.entries(values)) await saveSetting(key as keyof FocusSettings, value);
  });
}
async function placeDocked(settings: FocusSettings) {
  const target = await timerGeometry(settings.popoutDockMonitor);
  if (target.positioningSupported === false) {
    await invoke("set_timer_size", { size: settings.popoutSize, layout: settings.popoutLayout });
    return;
  }
  // Enter the target display before sizing in its logical pixels.
  if (settings.popoutDockMonitor !== "current")
    await invoke("set_timer_position_unchecked", { x: target.workArea.x + 24, y: target.workArea.y + 24 });
  await invoke("set_timer_size", { size: settings.popoutSize, layout: settings.popoutLayout });
  const geometry = await timerGeometry(settings.popoutDockMonitor);
  const position = cornerPosition(geometry.workArea, geometry, settings.popoutDockCorner, 12 * geometry.scale);
  await invoke("set_timer_position", { x: Math.round(position.x), y: Math.round(position.y) });
}
export async function setPopoutDocked(docked: boolean, corner?: DockCorner) {
  return withPopoutGeometry(async () => {
    const settings = await loadSettings();
    const next = {
      ...settings,
      popoutDocked: docked,
      popoutDockingEnabled: docked,
      popoutDockCorner: corner ?? settings.popoutDockCorner,
    };
    next.popoutAutoHideEdge = defaultEdgeForCorner(next.popoutDockCorner, settings.popoutAutoHideEdge);
    if (next.popoutDockCorner !== settings.popoutDockCorner)
      next.popoutAutoHideOffset = dockEdgeOffset(next.popoutDockCorner, next.popoutAutoHideEdge);
    const changes: Partial<FocusSettings> = {
      popoutDocked: docked,
      popoutDockingEnabled: docked,
      popoutDockCorner: next.popoutDockCorner,
      ...(docked
        ? { popoutAutoHideEdge: next.popoutAutoHideEdge, popoutAutoHideOffset: next.popoutAutoHideOffset }
        : {}),
    };
    if (!isTauri()) {
      await persist(changes);
      return;
    }
    await synchronizePopoutSession();
    const previous = await timerGeometry();
    if (docked && previous.positioningSupported === false)
      throw new Error("Docking is unavailable on this display backend.");
    // Configuration never requests visibility. Closed windows are configured only
    // in storage, and hidden windows remain hidden throughout repositioning.
    if (!previous.requested) {
      await persist(changes);
      return;
    }
    const wasDocked = settings.popoutDockingEnabled && settings.popoutDocked;
    try {
      if (docked) await placeDocked(next);
      else if (wasDocked && settings.popoutPositionX !== null && settings.popoutPositionY !== null) {
        await invoke("restore_timer_bounds", {
          x: settings.popoutPositionX,
          y: settings.popoutPositionY,
          width: settings.popoutFloatingWidth ?? previous.width,
          height: settings.popoutFloatingHeight ?? previous.height,
        });
      }
      if (docked && !wasDocked)
        Object.assign(changes, {
          popoutPositionX: previous.x,
          popoutPositionY: previous.y,
          popoutFloatingWidth: previous.width,
          popoutFloatingHeight: previous.height,
        });
      await persist(changes);
      if (previous.tabVisible) await hide(next, await timerGeometry(), previous.generation);
    } catch (error) {
      await invoke("restore_timer_bounds", {
        x: previous.x,
        y: previous.y,
        width: previous.width,
        height: previous.height,
      }).catch(() => undefined);
      throw error;
    }
  });
}
export async function syncPopoutLayout(resize = false) {
  if (!isTauri()) return;
  return withPopoutGeometry(async () => {
    await synchronizePopoutSession();
    const settings = await loadSettings(),
      geometry = await timerGeometry();
    if (!geometry.requested) return;
    await invoke("set_timer_always_on_top", { enabled: settings.popoutAlwaysOnTop });
    await invoke("set_timer_taskbar", { visible: settings.popoutShowInTaskbar });
    if (settings.popoutDockingEnabled && settings.popoutDocked) await placeDocked(settings);
    else if (resize) await invoke("set_timer_size", { size: settings.popoutSize, layout: settings.popoutLayout });
    if (geometry.tabVisible) {
      if (settings.popoutDockAutoHide) await hide(settings, await timerGeometry(), geometry.generation);
      else await invoke("cancel_timer_auto_hide", { generation: geometry.generation });
    }
  });
}
export async function openTimerPopout(_settings?: FocusSettings) {
  if (!isTauri()) return;
  const intendedSession = activePopoutSession();
  // Capture Close's generation before entering the geometry queue. An explicit
  // Close during placement invalidates this request, even while its timer runs.
  const ticket = invoke<number>("prepare_timer_popout", {
    sessionId: intendedSession?.sessionId ?? null,
    deadline: intendedSession?.deadline ?? null,
  });
  return withPopoutGeometry(async () => {
    const generation = await ticket;
    const session = await synchronizePopoutSession();
    if (!session || session.sessionId !== intendedSession?.sessionId) return;
    const settings = await loadSettings();
    await invoke("set_timer_always_on_top", { enabled: settings.popoutAlwaysOnTop });
    await invoke("set_timer_taskbar", { visible: settings.popoutShowInTaskbar });
    if (settings.popoutDockingEnabled && settings.popoutDocked) await placeDocked(settings);
    else {
      await invoke("set_timer_size", { size: settings.popoutSize, layout: settings.popoutLayout });
      if (settings.popoutRememberPosition && settings.popoutPositionX !== null && settings.popoutPositionY !== null)
        await invoke("set_timer_position", { x: settings.popoutPositionX, y: settings.popoutPositionY });
    }
    const latest = await synchronizePopoutSession();
    if (latest?.sessionId === session.sessionId)
      await invoke("open_timer_popout", { sessionId: session.sessionId, generation });
  });
}
async function hide(settings: FocusSettings, geometry: TimerGeometry, generation = geometry.generation) {
  if (geometry.positioningSupported === false) return;
  if (
    (!settings.popoutDockAutoHide && !geometry.tabVisible) ||
    !geometry.requested ||
    (!geometry.visible && !geometry.tabVisible)
  )
    return;
  const docked = settings.popoutDockingEnabled && settings.popoutDocked;
  const edge = docked
    ? settings.popoutAutoHideEdge
    : nearestEdge(geometry, geometry.workArea, geometry, lastFloatingEdge, geometry.scale);
  if (!docked) lastFloatingEdge = edge;
  if (import.meta.env.DEV)
    console.debug("[popout geometry]", {
      bounds: { x: geometry.x, y: geometry.y, width: geometry.width, height: geometry.height },
      scale: geometry.scale,
      workArea: geometry.workArea,
      corner: docked ? settings.popoutDockCorner : null,
      edge,
      generation,
    });
  const offset = docked ? settings.popoutAutoHideOffset : edgeOffset(geometry, geometry.workArea, geometry, edge);
  await invoke("show_timer_auto_hide_tab", { edge, offset, tabSize: settings.popoutAutoHideTabSize, generation });
}
export async function hideTimerAutomatically() {
  if (!isTauri()) return;
  return withPopoutGeometry(async () => {
    // Re-read inside the queue: a timeout scheduled before Disable is obsolete.
    const settings = await loadSettings();
    if (!settings.popoutDockAutoHide) return;
    await synchronizePopoutSession();
    await hide(settings, await timerGeometry());
  });
}
export async function revealTimerAutomatically() {
  return withPopoutGeometry(async () => {
    await synchronizePopoutSession();
    const geometry = await timerGeometry();
    if (geometry.requested && geometry.tabVisible)
      await invoke("cancel_timer_auto_hide", { generation: geometry.generation });
  });
}
export async function refreshTimerAutoHideTab() {
  if (!isTauri()) return;
  return withPopoutGeometry(async () => {
    await synchronizePopoutSession();
    const geometry = await timerGeometry();
    if (geometry.requested && geometry.tabVisible) {
      const settings = await loadSettings();
      if (settings.popoutDockAutoHide) await hide(settings, geometry);
      else await invoke("cancel_timer_auto_hide", { generation: geometry.generation });
    }
  });
}
export async function toggleTimerAutoHide() {
  return withPopoutGeometry(async () => {
    const settings = await loadSettings(),
      geometry = await timerGeometry();
    if (
      geometry.positioningSupported === false ||
      !settings.popoutDockAutoHide ||
      !geometry.requested ||
      !activePopoutSession()
    )
      return;
    if (geometry.tabVisible) {
      await invoke("cancel_timer_auto_hide", { generation: geometry.generation });
      return "revealed" as const;
    }
    await hide(settings, geometry);
    return "hidden" as const;
  });
}
export async function rememberFloatingPosition() {
  return withPopoutGeometry(async () => {
    const settings = await loadSettings();
    if (settings.popoutDocked && settings.popoutDockingEnabled) return;
    const geometry = await timerGeometry();
    if (geometry.positioningSupported === false) return;
    await persist({
      popoutPositionX: geometry.x,
      popoutPositionY: geometry.y,
      popoutFloatingWidth: geometry.width,
      popoutFloatingHeight: geometry.height,
    });
  });
}

/** A settings change may reveal an already requested window, never open a closed one. */
export async function reconcileAutoHideSetting() {
  if (!isTauri()) return;
  return withPopoutGeometry(async () => {
    if ((await loadSettings()).popoutDockAutoHide) return;
    await synchronizePopoutSession();
    const geometry = await timerGeometry();
    if (geometry.requested && geometry.tabVisible)
      await invoke("cancel_timer_auto_hide", { generation: geometry.generation });
  });
}

/** Explicit user shortcut: reveal idempotently, or open for an active session. */
export async function revealTimerFromShortcut() {
  if (!isTauri() || !activePopoutSession()) return;
  const shouldOpen = await withPopoutGeometry(async () => {
    await synchronizePopoutSession();
    const geometry = await timerGeometry();
    if (!geometry.requested) return true;
    if (geometry.tabVisible || !geometry.visible)
      await invoke("cancel_timer_auto_hide", { generation: geometry.generation });
    return false;
  });
  if (shouldOpen) await openTimerPopout();
}
