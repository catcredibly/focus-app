import { useEffect, useSyncExternalStore } from "react";
import { Check, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toastStore } from "../toasts";

export function ToastHost() {
  const toast = useSyncExternalStore(toastStore.subscribe, toastStore.snapshot);
  const { t } = useTranslation();
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => toastStore.dismiss(toast.id), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);
  return (
    <div className="toast-host" role="status" aria-live="polite" aria-atomic="true">
      {toast && (
        <div className={`focus-toast focus-toast--${toast.kind}`}>
          <Check size={18} />
          <span>{t(toast.message)}</span>
          <button aria-label={t("Dismiss")} onClick={() => toastStore.dismiss(toast.id)}>
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
