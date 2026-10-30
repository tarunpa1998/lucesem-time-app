import { LockSimple } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import {
  AppCard,
  AppHeading,
  AppGroup,
  AppStack,
  AppButton,
  AppText,
  AppGrid,
  AppSelect,
  AppTextInput,
  AppDateInput,
  AppDataTable,
  AppMono,
  AppTabs,
  formatDuration,
  notify,
  AppPageHeader,
} from "@/components/core";
import { useI18n } from "@/lib/i18n";
import { locksQuery, liveQuery, auditQuery, usersQuery } from "@/lib/session";
import { addLock, removeLock } from "@/backend/workflow.functions";

export function ControlPage() {
  const { t, fmtDate } = useI18n();
  const qc = useQueryClient();
  const { data: locks } = useSuspenseQuery(locksQuery);
  const { data: live = [] } = useQuery(liveQuery);
  const { data: audit = [] } = useQuery(auditQuery);
  const { data: users = [] } = useQuery(usersQuery);
  const [form, setForm] = useState({
    userId: null as string | null,
    fromDate: "",
    toDate: "",
    note: "",
  });
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  const valid =
    /^\d{4}-\d{2}-\d{2}$/.test(form.fromDate) &&
    /^\d{4}-\d{2}-\d{2}$/.test(form.toDate) &&
    form.fromDate <= form.toDate;
  const add = async () => {
    await addLock({ data: form });
    notify.show({ color: "lucesem", message: "@lockAdded" });
    setForm({ userId: null, fromDate: "", toDate: "", note: "" });
    qc.invalidateQueries({ queryKey: ["locks"] });
  };

  return (
    <AppStack gap="var(--app-grid-gap)" maw={1280} mx="auto">
      <AppPageHeader icon={LockSimple} title={t("control")} subtitle={t("sub_control")} />
      <AppTabs defaultValue="live">
        <AppTabs.List mb="md">
          <AppTabs.Tab value="live">
            {t("liveBoard")} ({live.length})
          </AppTabs.Tab>
          <AppTabs.Tab value="locks">{t("periodLocks")}</AppTabs.Tab>
          <AppTabs.Tab value="audit">{t("auditLog")}</AppTabs.Tab>
        </AppTabs.List>

        <AppTabs.Panel value="live">
          <AppCard>
            <AppDataTable
              rows={live}
              rowKey={(r) => r.user_id}
              empty={t("nobodyRunning")}
              columns={[
                { key: "u", label: t("user"), render: (r) => r.user_name },
                { key: "p", label: t("project"), render: (r) => r.project_name ?? "—" },
                { key: "n", label: t("notes"), render: (r) => r.work_notes || "—" },
                {
                  key: "d",
                  label: t("duration"),
                  render: (r) => (
                    <AppMono>
                      {formatDuration(
                        Math.max(0, Math.floor((now - Date.parse(r.started_at)) / 1000)),
                      )}
                    </AppMono>
                  ),
                },
              ]}
            />
          </AppCard>
        </AppTabs.Panel>

        <AppTabs.Panel value="locks">
          <AppStack>
            <AppCard>
              <AppText fw={700} mb="sm">
                {t("addLock")}
              </AppText>
              <AppGrid cols={{ base: 1, sm: 2, lg: 5 }}>
                <AppSelect
                  label={t("user")}
                  placeholder={t("everyone")}
                  clearable
                  value={form.userId}
                  onChange={(v) => setForm({ ...form, userId: v })}
                  data={users.map((u) => ({ value: u.id, label: u.display_name }))}
                />
                <AppDateInput
                  label={t("fromDate")}
                  placeholder="DD.MM.YYYY"
                  value={form.fromDate}
                  onChange={(val) => setForm({ ...form, fromDate: val })}
                />
                <AppDateInput
                  label={t("toDate")}
                  placeholder="DD.MM.YYYY"
                  value={form.toDate}
                  onChange={(val) => setForm({ ...form, toDate: val })}
                />
                <AppTextInput
                  label={t("note")}
                  placeholder={t("notes")}
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.currentTarget.value })}
                />
                <AppButton mt={24} disabled={!valid} onClick={add}>
                  {t("addLock")}
                </AppButton>
              </AppGrid>
            </AppCard>
            <AppCard>
              <AppDataTable
                rows={locks}
                rowKey={(r) => r.id}
                empty="—"
                columns={[
                  { key: "u", label: t("user"), render: (r) => r.user_name ?? t("everyone") },
                  { key: "f", label: t("fromDate"), render: (r) => fmtDate(r.from_date) },
                  { key: "t", label: t("toDate"), render: (r) => fmtDate(r.to_date) },
                  { key: "n", label: t("note"), render: (r) => r.note || "—" },
                  {
                    key: "a",
                    label: "",
                    render: (r) => (
                      <AppButton
                        size="compact-xs"
                        color="red"
                        variant="light"
                        onClick={async () => {
                          await removeLock({ data: { id: r.id } });
                          qc.invalidateQueries({ queryKey: ["locks"] });
                        }}
                      >
                        {t("remove")}
                      </AppButton>
                    ),
                  },
                ]}
              />
            </AppCard>
          </AppStack>
        </AppTabs.Panel>

        <AppTabs.Panel value="audit">
          <AppCard>
            <AppDataTable
              rows={audit}
              rowKey={(r) => r.id}
              empty="—"
              columns={[
                { key: "t", label: t("time"), render: (r) => r.created_at },
                { key: "u", label: t("user"), render: (r) => r.actor ?? "—" },
                { key: "a", label: t("action"), render: (r) => r.action },
                { key: "e", label: "", render: (r) => r.entity },
              ]}
            />
          </AppCard>
        </AppTabs.Panel>
      </AppTabs>
      <AppGroup />
    </AppStack>
  );
}
