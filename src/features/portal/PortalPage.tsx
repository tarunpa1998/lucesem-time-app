import { useState } from "react";
import { FileArrowDown } from "@phosphor-icons/react";
import {
  AppCard,
  AppCenter,
  AppStack,
  AppGroup,
  AppHeading,
  AppText,
  AppButton,
  AppPasswordInput,
  AppTextInput,
  AppDateInput,
  AppAlert,
  AppMono,
  AppDataTable,
  AppGrid,
  AppTooltip,
} from "@/components/core";
import { Logo } from "@/components/core/AppShellLayout";
import { useI18n } from "@/lib/i18n";
import { portalData, type PortalView } from "@/backend/workflow.functions";
import { exportPdf, exportCsv } from "@/lib/exporters";
import { formatHoursMinutes } from "@/domain/rules";

const monthStart = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 2, 1);
  return d.toISOString().slice(0, 10);
};

export function PortalPage({ token }: { token: string }) {
  const { t, fmtDate, fmtHours, lang, setLang } = useI18n();
  const [password, setPassword] = useState("");
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [view, setView] = useState<PortalView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await portalData({ data: { token, password, from, to } });
      if (!r) setError(t("wrongPassword"));
      setView(r);
    } catch {
      setError(t("wrongPassword"));
    } finally {
      setBusy(false);
    }
  };

  const total = view?.rows.reduce((s, r) => s + r.hours, 0) ?? 0;
  const table = () => ({
    title: `${t("portalTitle")} · ${view?.customerName ?? ""}`,
    subtitle: `${fmtDate(from)} – ${fmtDate(to)}`,
    headers: [t("date"), t("project"), t("user"), t("hours"), t("notes")],
    rows: (view?.rows ?? []).map((r) => [
      fmtDate(r.entry_date),
      r.project_name,
      r.user_name,
      r.hours.toFixed(2),
      r.work_notes,
    ]),
    totals: ["", "", t("totalHours"), total.toFixed(2), ""],
  });

  return (
    <AppCenter
      mih="100vh"
      p="md"
      style={{ background: "var(--app-bg-header)", alignItems: view ? "flex-start" : "center" }}
    >
      <AppStack w="100%" maw={view ? 1100 : 420} gap="lg">
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
          <AppStack>
            <AppHeading order={3}>
              {view ? `${t("portalTitle")} · ${view.customerName}` : t("portalTitle")}
            </AppHeading>
            {!view && (
              <AppText fz="sm" c="var(--app-text-secondary)">
                {t("portalHint")}
              </AppText>
            )}
            {error && <AppAlert color="red">{error}</AppAlert>}
            <AppGrid cols={{ base: 1, sm: view ? 4 : 1 }}>
              {!view && (
                <AppPasswordInput
                  label={t("password")}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.currentTarget.value)}
                />
              )}
              <AppDateInput
                label={t("fromDate")}
                placeholder="DD.MM.YYYY"
                value={from}
                onChange={(val) => setFrom(val)}
                clearable={false}
              />
              <AppDateInput
                label={t("toDate")}
                placeholder="DD.MM.YYYY"
                value={to}
                onChange={(val) => setTo(val)}
                clearable={false}
              />
              <AppButton mt={view ? 24 : 0} loading={busy} disabled={!password} onClick={load}>
                {t("open")}
              </AppButton>
            </AppGrid>
          </AppStack>
        </AppCard>
        {view && (
          <AppCard>
            <AppGroup justify="space-between" mb="sm">
              <AppTooltip
                label={
                  <div style={{ lineHeight: 1.4, fontSize: 12 }}>
                    <div style={{ fontWeight: 600 }}>{formatHoursMinutes(total)}</div>
                    <div style={{ opacity: 0.85 }}>{fmtHours(total)}</div>
                  </div>
                }
                withArrow
              >
                <div style={{ cursor: "default", display: "inline-block" }}>
                  <AppMono size="20px">{formatHoursMinutes(total)}</AppMono>
                </div>
              </AppTooltip>
              <AppGroup gap="xs">
                <AppButton
                  size="xs"
                  variant="light"
                  leftSection={<FileArrowDown weight="duotone" size={14} />}
                  onClick={() => exportPdf(table(), "lucesem-hours")}
                >
                  PDF
                </AppButton>
                <AppButton
                  size="xs"
                  variant="light"
                  leftSection={<FileArrowDown weight="duotone" size={14} />}
                  onClick={() => exportCsv(table(), "lucesem-hours")}
                >
                  CSV
                </AppButton>
              </AppGroup>
            </AppGroup>
            <AppDataTable
              rows={view.rows}
              rowKey={(r) =>
                `${r.entry_date}-${r.project_name}-${r.user_name}-${r.hours}-${r.work_notes}`
              }
              empty={t("noEntries")}
              columns={[
                { key: "d", label: t("date"), render: (r) => fmtDate(r.entry_date) },
                { key: "p", label: t("project"), render: (r) => r.project_name },
                { key: "u", label: t("user"), render: (r) => r.user_name },
                {
                  key: "h",
                  label: t("hours"),
                  render: (r) => (
                    <AppTooltip
                      label={
                        <div style={{ lineHeight: 1.4, fontSize: 12 }}>
                          <div style={{ fontWeight: 600 }}>{formatHoursMinutes(r.hours)}</div>
                          <div style={{ opacity: 0.85 }}>{fmtHours(r.hours)}</div>
                        </div>
                      }
                      withArrow
                      position="top-start"
                    >
                      <div style={{ cursor: "default", display: "inline-block" }}>
                        <AppMono size="sm" fw={600}>
                          {formatHoursMinutes(r.hours)}
                        </AppMono>
                      </div>
                    </AppTooltip>
                  ),
                },
                { key: "n", label: t("notes"), render: (r) => r.work_notes },
              ]}
            />
          </AppCard>
        )}
      </AppStack>
    </AppCenter>
  );
}
