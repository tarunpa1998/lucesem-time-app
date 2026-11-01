import { Checks, Check, X } from "@phosphor-icons/react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import {
  AppCard,
  AppHeading,
  AppGroup,
  AppStack,
  AppButton,
  AppText,
  AppDataTable,
  notify,
  AppPageHeader,
} from "@/components/core";
import { useI18n } from "@/lib/i18n";
import { approvalQueueQuery } from "@/lib/session";
import { decideEntries, decideUnlock } from "@/backend/workflow.functions";

export function ApprovalsPage() {
  const { t, fmtDate } = useI18n();
  const qc = useQueryClient();
  const { data } = useSuspenseQuery(approvalQueueQuery);
  const refresh = () => qc.invalidateQueries({ queryKey: ["approvals"] });

  const entries = async (ids: string[], approve: boolean) => {
    await decideEntries({ data: { ids, approve } });
    notify.show({ color: "lucesem", message: approve ? "@entriesApproved" : "@entriesRejected" });
    refresh();
  };
  const unlock = async (id: string, approve: boolean) => {
    await decideUnlock({ data: { id, approve } });
    notify.show({ color: "lucesem", message: approve ? "@unlockApproved" : "@unlockRejected" });
    refresh();
  };

  return (
    <AppStack gap="var(--app-grid-gap)" maw={1280} mx="auto">
      <AppPageHeader icon={Checks} title={t("approvals")} subtitle={t("sub_approvals")} />
      <AppCard>
        <AppGroup justify="space-between" mb="sm">
          <AppText fw={700}>
            {t("pendingEntries")} ({data.entries.length})
          </AppText>
          {data.entries.length > 0 && (
            <AppButton
              size="xs"
              color="green"
              variant="light"
              leftSection={<Check size={13} weight="bold" />}
              onClick={() =>
                entries(
                  data.entries.map((e) => e.id),
                  true,
                )
              }
            >
              {t("approveAll")}
            </AppButton>
          )}
        </AppGroup>
        <AppDataTable
          rows={data.entries}
          rowKey={(r) => r.id}
          empty={t("nothingPending")}
          columns={[
            { key: "u", label: t("user"), render: (r) => r.user_name },
            { key: "d", label: t("date"), render: (r) => fmtDate(r.entry_date) },
            { key: "t", label: t("time"), render: (r) => `${r.from_time}–${r.to_time}` },
            {
              key: "p",
              label: t("project"),
              render: (r) => `${r.project_name} · ${r.customer_name}`,
            },
            { key: "n", label: t("notes"), render: (r) => r.work_notes },
            {
              key: "a",
              label: "",
              render: (r) => (
                <AppGroup gap={6} wrap="nowrap">
                  <AppButton
                    size="compact-xs"
                    color="green"
                    variant="light"
                    leftSection={<Check size={12} weight="bold" />}
                    onClick={() => entries([r.id], true)}
                  >
                    {t("approve")}
                  </AppButton>
                  <AppButton
                    size="compact-xs"
                    color="red"
                    variant="light"
                    leftSection={<X size={12} weight="bold" />}
                    onClick={() => entries([r.id], false)}
                  >
                    {t("reject")}
                  </AppButton>
                </AppGroup>
              ),
            },
          ]}
        />
      </AppCard>
      <AppCard>
        <AppText fw={700} mb="sm">
          {t("unlockRequests")} ({data.unlocks.length})
        </AppText>
        <AppDataTable
          rows={data.unlocks}
          rowKey={(r) => r.id}
          empty={t("nothingPending")}
          columns={[
            { key: "u", label: t("user"), render: (r) => r.user_name },
            { key: "d", label: t("date"), render: (r) => fmtDate(r.entry_date) },
            { key: "r", label: t("reason"), render: (r) => r.reason },
            {
              key: "a",
              label: "",
              render: (r) => (
                <AppGroup gap={6} wrap="nowrap">
                  <AppButton
                    size="compact-xs"
                    color="green"
                    variant="light"
                    leftSection={<Check size={12} weight="bold" />}
                    onClick={() => unlock(r.id, true)}
                  >
                    {t("approve")}
                  </AppButton>
                  <AppButton
                    size="compact-xs"
                    color="red"
                    variant="light"
                    leftSection={<X size={12} weight="bold" />}
                    onClick={() => unlock(r.id, false)}
                  >
                    {t("reject")}
                  </AppButton>
                </AppGroup>
              ),
            },
          ]}
        />
      </AppCard>
    </AppStack>
  );
}
