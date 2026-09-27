import { expect, it, vi } from "vitest";
import { captureShortcut, isRevealShortcut, shortcutLabel, listenForShortcut } from "./shortcuts";
const input = { ctrlKey: true, altKey: true, shiftKey: false, metaKey: false };
it("normalizes allowed combinations and rejects unsafe main keys", () => {
  expect(captureShortcut({ ...input, code: "KeyF" })).toBe("Ctrl+Alt+KeyF");
  expect(shortcutLabel("Ctrl+Shift+Slash")).toBe("Ctrl + Shift + /");
  for (const code of [
    "F0",
    "F13",
    "Space",
    "Numpad7",
    "ArrowLeft",
    "Enter",
    "ControlLeft",
    "MetaLeft",
    "Tab",
    "Escape",
    "AudioVolumeUp",
  ])
    expect(captureShortcut({ ...input, code })).toBeUndefined();
  expect(captureShortcut({ ...input, altKey: false, code: "KeyF" })).toBe("Ctrl+KeyF");
  expect(captureShortcut({ ...input, ctrlKey: false, altKey: false, code: "KeyF" })).toBeUndefined();
  expect(captureShortcut({ ...input, metaKey: true, code: "KeyF" })).toBeUndefined();
  expect(captureShortcut({ ...input, ctrlKey: false, shiftKey: true, code: "Digit7" })).toBe("Alt+Shift+Digit7");
});

it("rejects F1-F12 with every modifier combination", () => {
  for (let key = 1; key <= 12; key++)
    for (let mask = 0; mask < 8; mask++) {
      const shortcut = captureShortcut({
        code: `F${key}`,
        ctrlKey: Boolean(mask & 1),
        altKey: Boolean(mask & 2),
        shiftKey: Boolean(mask & 4),
        metaKey: false,
      });
      expect(shortcut).toBeUndefined();
      expect(isRevealShortcut(`${mask ? "Ctrl+" : ""}F${key}`)).toBe(false);
    }
  expect(shortcutLabel("Ctrl+Alt+Shift+F7")).toBe("Ctrl + Alt + Shift + F7");
});

it("captures and labels Alt+Backquote canonically", () => {
  expect(captureShortcut({ ...input, ctrlKey: false, code: "Backquote" })).toBe("Alt+Backquote");
  expect(shortcutLabel("Alt+Backquote")).toBe("Alt + " + String.fromCharCode(96));
});

it("records on the window across blur, ignores invalid/repeated keys, and cleans up", () => {
  const target = new EventTarget();
  const captured = vi.fn(),
    cancelled = vi.fn();
  const stop = listenForShortcut(captured, cancelled, target as unknown as Window);
  const dispatch = (key: string, code: string, repeat = false) => {
    const event = Object.assign(new Event("keydown", { cancelable: true }), {
      key,
      code,
      repeat,
      altKey: true,
      ctrlKey: false,
      shiftKey: false,
      metaKey: false,
    });
    target.dispatchEvent(event);
    return event;
  };
  target.dispatchEvent(new Event("blur"));
  dispatch("a", "Numpad7");
  dispatch("x", "KeyX", true);
  expect(captured).not.toHaveBeenCalled();
  expect(dispatch(String.fromCharCode(96), "Backquote").defaultPrevented).toBe(true);
  expect(captured).toHaveBeenCalledWith("Alt+Backquote");
  expect(dispatch("F8", "F8").defaultPrevented).toBe(false);
  stop();
  expect(cancelled).not.toHaveBeenCalled();
});
it.each(["Escape", "Tab"])("cancels recording with %s and releases the listener", (key) => {
  const target = new EventTarget(),
    cancelled = vi.fn(),
    captured = vi.fn();
  listenForShortcut(captured, cancelled, target as unknown as Window);
  const event = Object.assign(new Event("keydown", { cancelable: true }), { key });
  target.dispatchEvent(event);
  expect(cancelled).toHaveBeenCalledTimes(1);
  expect(event.defaultPrevented).toBe(key === "Escape");
  expect(captured).not.toHaveBeenCalled();
});
it("removes recording input on cleanup for disable or unmount", () => {
  const target = new EventTarget(),
    captured = vi.fn();
  const stop = listenForShortcut(captured, () => {}, target as unknown as Window);
  stop();
  target.dispatchEvent(
    Object.assign(new Event("keydown", { cancelable: true }), { key: "F12", code: "F12", repeat: false }),
  );
  expect(captured).not.toHaveBeenCalled();
});
