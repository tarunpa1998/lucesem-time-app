import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  AppCard,
  AppStack,
  AppTextInput,
  AppPasswordInput,
  AppButton,
  AppHeading,
  AppText,
  AppAlert,
  AppCenter,
  AppGroup,
} from "@/components/core";
import { Logo } from "@/components/core/AppShellLayout";
import { useI18n } from "@/lib/i18n";
import { BRAND } from "@/theme/tokens";
import { login } from "@/backend/auth.functions";

export function LoginPage() {
  const { t, lang, setLang } = useI18n();
  const router = useRouter();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await login({ data: { email, password } });
      if (!r.ok) {
        setError(t("loginFailed"));
        return;
      }
      await qc.invalidateQueries();
      await router.navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppCenter mih="100vh" p="md" style={{ background: "var(--app-bg-header)" }}>
      <AppStack w="100%" maw={420} gap="lg">
        <AppGroup justify="space-between">
          <Logo />
          <AppButton
            variant="subtle"
            size="xs"
            onClick={() => setLang(lang === "de" ? "en" : "de")}
          >
            {lang === "de" ? "EN" : "DE"}
          </AppButton>
        </AppGroup>
        <AppCard p="xl">
          <form onSubmit={submit}>
            <AppStack>
              <AppHeading order={3}>{t("signIn")}</AppHeading>
              {error && <AppAlert color="red">{error}</AppAlert>}
              <AppTextInput
                label={t("email")}
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.currentTarget.value)}
              />
              <AppPasswordInput
                label={t("password")}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
              />
              <AppButton type="submit" loading={busy} fullWidth size="md">
                {t("signIn")}
              </AppButton>
            </AppStack>
            <AppText fz="xs" mt="sm" c="var(--app-text-secondary)">
              {t("resetHint")}
            </AppText>
          </form>
        </AppCard>
        <AppText fz="xs" ta="center" c="var(--app-text-secondary)">
          {BRAND.legalName} · {BRAND.address}
        </AppText>
      </AppStack>
    </AppCenter>
  );
}
