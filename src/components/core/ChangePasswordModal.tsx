import { useState } from "react";
import { Modal, Stack, PasswordInput, Group, Button, Alert } from "@mantine/core";
import { notify } from "./notify";
import { useI18n } from "@/lib/i18n";
import { changePassword } from "@/backend/extra.functions";

export function ChangePasswordModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const close = () => {
    setCurrent("");
    setNext("");
    setRepeat("");
    setError(null);
    onClose();
  };
  const submit = async () => {
    if (next !== repeat) return setError(t("passwordMismatch"));
    setBusy(true);
    try {
      const r = await changePassword({ data: { current, next } });
      if (!r.ok) return setError(t("wrongCurrent"));
      notify.show({ color: "lucesem", message: "@passwordChanged" });
      close();
    } catch {
      setError(t("error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal opened={opened} onClose={close} title={t("changePassword")} centered>
      <Stack>
        {error && <Alert color="red">{error}</Alert>}
        <PasswordInput
          label={t("currentPassword")}
          placeholder="••••••••"
          value={current}
          onChange={(e) => setCurrent(e.currentTarget.value)}
        />
        <PasswordInput
          label={t("newPassword")}
          placeholder="••••••••"
          value={next}
          onChange={(e) => setNext(e.currentTarget.value)}
        />
        <PasswordInput
          label={t("repeatPassword")}
          placeholder="••••••••"
          value={repeat}
          onChange={(e) => setRepeat(e.currentTarget.value)}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={close}>
            {t("cancel")}
          </Button>
          <Button
            color="lucesem"
            loading={busy}
            disabled={!current || next.length < 10}
            onClick={submit}
          >
            {t("save")}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
