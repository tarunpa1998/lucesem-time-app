import { useState, type ReactNode } from "react";
import { Modal } from "@mantine/core";
import { Trash } from "@phosphor-icons/react";
import { AppButton, AppText, AppHeading, AppGroup, AppStack } from "./primitives";
import { useI18n } from "@/lib/i18n";

export interface AppConfirmModalProps {
  opened: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title?: ReactNode;
  message?: ReactNode;
  confirmLabel?: ReactNode;
  cancelLabel?: ReactNode;
  confirmColor?: string;
  icon?: ReactNode;
  loading?: boolean;
  zIndex?: number;
}

/** Theme-styled confirmation modal for deletions and dangerous actions. */
export function AppConfirmModal({
  opened,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  cancelLabel,
  confirmColor = "red",
  icon,
  loading: externalLoading,
  zIndex = 400,
}: AppConfirmModalProps) {
  const { t } = useI18n();
  const [internalLoading, setInternalLoading] = useState(false);
  const loading = externalLoading ?? internalLoading;

  const handleConfirm = async () => {
    try {
      setInternalLoading(true);
      await onConfirm();
    } finally {
      setInternalLoading(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      centered
      radius="lg"
      size="sm"
      zIndex={zIndex}
      withCloseButton={!loading}
      closeOnClickOutside={!loading}
      closeOnEscape={!loading}
      overlayProps={{
        backgroundOpacity: 0.65,
        blur: 5,
      }}
      styles={{
        content: {
          background: "var(--app-bg-surface)",
          borderTop: "4px solid var(--app-danger, #ef4444)",
          border: "1px solid var(--app-border-subtle)",
          boxShadow: "var(--app-shadow-floating)",
          borderRadius: "var(--app-radius-lg)",
          padding: 8,
        },
        header: {
          background: "var(--app-bg-surface)",
          borderBottom: "none",
          paddingBottom: 0,
        },
        body: {
          paddingTop: 8,
        },
      }}
    >
      <AppStack gap="md">
        <AppGroup align="flex-start" gap="md" wrap="nowrap">
          <div
            style={{
              width: 44,
              height: 44,
              minWidth: 44,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background:
                "color-mix(in srgb, var(--app-danger, #ef4444) 14%, var(--app-bg-surface))",
              color: "var(--app-danger, #ef4444)",
              border: "1px solid color-mix(in srgb, var(--app-danger, #ef4444) 25%, transparent)",
            }}
          >
            {icon ?? <Trash size={22} weight="duotone" />}
          </div>
          <AppStack gap={4} style={{ flex: 1 }}>
            <AppHeading order={4}>{title ?? t("deleteConfirmTitle")}</AppHeading>
            <AppText size="sm" c="var(--app-text-secondary)" style={{ lineHeight: 1.5 }}>
              {message ?? t("deleteConfirmMessage")}
            </AppText>
          </AppStack>
        </AppGroup>

        <AppGroup justify="flex-end" gap="xs" mt="sm">
          <AppButton variant="default" onClick={onClose} disabled={loading}>
            {cancelLabel ?? t("cancel")}
          </AppButton>
          <AppButton
            color={confirmColor}
            variant="filled"
            onClick={handleConfirm}
            loading={loading}
            leftSection={!loading ? <Trash size={16} /> : undefined}
          >
            {confirmLabel ?? t("delete")}
          </AppButton>
        </AppGroup>
      </AppStack>
    </Modal>
  );
}
