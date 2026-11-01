import { modals } from "@mantine/modals";
import type { ReactNode } from "react";

/** Imperative confirmation modal helper using Mantine modals provider. */
export function openAppConfirmModal({
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  confirmColor = "red",
  zIndex = 400,
}: {
  title?: ReactNode;
  message?: ReactNode;
  confirmLabel?: ReactNode;
  cancelLabel?: ReactNode;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
  confirmColor?: string;
  zIndex?: number;
}) {
  return modals.openConfirmModal({
    title,
    children: message,
    labels: {
      confirm: (confirmLabel as string) || "Confirm",
      cancel: (cancelLabel as string) || "Cancel",
    },
    confirmProps: { color: confirmColor },
    centered: true,
    zIndex,
    overlayProps: {
      backgroundOpacity: 0.65,
      blur: 5,
    },
    styles: {
      content: {
        background: "var(--app-bg-surface)",
        borderTop: "4px solid var(--app-danger, #ef4444)",
        border: "1px solid var(--app-border-subtle)",
        boxShadow: "var(--app-shadow-floating)",
        borderRadius: "var(--app-radius-lg)",
      },
      header: {
        background: "var(--app-bg-surface)",
        borderBottom: "1px solid var(--app-border-subtle)",
      },
      body: {
        paddingTop: 16,
      },
    },
    onConfirm,
    ...(onCancel ? { onCancel } : {}),
  });
}
