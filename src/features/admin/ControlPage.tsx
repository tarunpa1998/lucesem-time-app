import { Broadcast, ClockCounterClockwise, LockSimple, Trash } from "@phosphor-icons/react";
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
  AppFolderTabs,
  formatDuration,
  notify,
  AppPageHeader,
  AppConfirmModal,
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
  const [lockToDelete, setLockToDelete] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("live");
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

      {/* Centered Folder Tabs matching theme with blue indicator */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          width: "100%",
          marginBottom: 8,
        }}
      >
        <AppFolderTabs
          value={activeTab}
          onChange={setActiveTab}
          items={[
            {
              value: "live",
              label: `${t("liveBoard")} (${live.length})`,
              icon: <Broadcast size={15} weight="duotone" />,
            },
            {
              value: "locks",
              label: t("periodLocks"),
              icon: <LockSimple size={15} weight="duotone" />,
            },
            {
              value: "audit",
              label: t("auditLog"),
              icon: <ClockCounterClockwise size={15} weight="duotone" />,
            },
          ]}
        />
      </div>

      {activeTab === "live" && (
        <AppCard>
          <div className="app-folder-tabs-row" style={{ marginBottom: 16 }}>
            <div className="app-section-heading">
              <AppHeading order={4}>
                {t("liveBoard")} ({live.length})
              </AppHeading>
            </div>
          </div>
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
      )}

      {activeTab === "locks" && (
        <AppStack>
          <AppCard>
            <div className="app-folder-tabs-row" style={{ marginBottom: 16 }}>
              <div className="app-section-heading">
                <AppHeading order={4}>{t("addLock")}</AppHeading>
              </div>
            </div>
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
            <div className="app-folder-tabs-row" style={{ marginBottom: 16 }}>
              <div className="app-section-heading">
                <AppHeading order={4}>
                  {t("periodLocks")} ({locks.length})
                </AppHeading>
              </div>
            </div>
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
                      leftSection={<Trash size={12} weight="duotone" />}
                      onClick={() => setLockToDelete(r.id)}
                    >
                      {t("remove")}
                    </AppButton>
                  ),
                },
              ]}
            />
          </AppCard>

          <AppConfirmModal
            opened={!!lockToDelete}
            onClose={() => setLockToDelete(null)}
            onConfirm={async () => {
              if (!lockToDelete) return;
              await removeLock({ data: { id: lockToDelete } });
              setLockToDelete(null);
              qc.invalidateQueries({ queryKey: ["locks"] });
            }}
            title={t("periodLocks")}
            message={t("deleteConfirm")}
          />
        </AppStack>
      )}

      {activeTab === "audit" && (
        <AppCard>
          <div className="app-folder-tabs-row" style={{ marginBottom: 16 }}>
            <div className="app-section-heading">
              <AppHeading order={4}>
                {t("auditLog")} ({audit.length})
              </AppHeading>
            </div>
          </div>
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
      )}
    </AppStack>
  );
}
