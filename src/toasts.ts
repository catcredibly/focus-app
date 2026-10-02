export type ToastMessage =
  | "Unable to change color. Please try again."
  | "Unable to synchronize launch at startup"
  | "Backup exported successfully"
  | "CSV exported successfully"
  | "Daily goal completed"
  | "Weekly goal completed";
export type Toast = { id: string; message: ToastMessage; kind: "error" | "success" | "daily" | "weekly" };
const listeners = new Set<() => void>();
let queue: Toast[] = [];
let channel: BroadcastChannel | undefined;
function receive(toast: Toast) {
  if (queue.some((item) => item.id === toast.id)) return;
  queue = [...queue, toast];
  listeners.forEach((listener) => listener());
}
function connect() {
  if (!channel && typeof BroadcastChannel !== "undefined") {
    channel = new BroadcastChannel("focus.toasts");
    channel.onmessage = (event) => receive(event.data as Toast);
  }
}
/** The main-window host queues timer events received from either webview. */
export function showToast(message: ToastMessage, kind: Toast["kind"] = "success") {
  connect();
  const toast = { id: crypto.randomUUID(), message, kind };
  receive(toast);
  channel?.postMessage(toast);
}
export const toastStore = {
  subscribe(listener: () => void) {
    connect();
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  snapshot: () => queue[0],
  dismiss(id: string) {
    queue = queue.filter((toast) => toast.id !== id);
    listeners.forEach((listener) => listener());
  },
};
