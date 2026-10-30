import { Kanban } from "@phosphor-icons/react";
import { useState } from "react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Plus } from "@phosphor-icons/react";
import {
  AppCard,
  AppHeading,
  AppGroup,
  AppStack,
  AppButton,
  AppBadge,
  AppDataTable,
  AppText,
  notify,
  AppPageHeader,
} from "@/components/core";
import { useI18n } from "@/lib/i18n";
import { meQuery, myProjectsQuery } from "@/lib/session";
import { reviewProject } from "@/backend/org.functions";
import type { ApprovalState, ProjectRow } from "@/backend/types";
import { ProjectForm } from "./ProjectForm";
import { budgetLevel, budgetRatio } from "@/domain/budget";

function BudgetCell({ r }: { r: ProjectRow }) {
  const { t, fmtHours } = useI18n();
  const hb = r.time_budget_hours ? Number(r.time_budget_hours) : null;
  const mb = r.monetary_budget ? Number(r.monetary_budget) : null;
  const rate = r.hourly_rate ? Number(r.hourly_rate) : 0;
  const input = {
    timeBudgetHours: hb,
    monetaryBudget: mb,
    usedHours: r.used_hours,
    usedMoney: r.used_hours * rate,
  };
  const ratio = budgetRatio(input);
  if (ratio === null)
    return (
      <AppText fz="sm" c="var(--app-text-secondary)">
        {fmtHours(r.used_hours)} · {t("noBudget")}
      </AppText>
    );
  const level = budgetLevel(input);
  return (
    <AppGroup gap={6} wrap="nowrap">
      <AppText fz="sm">
        {fmtHours(r.used_hours)}
        {hb ? ` / ${fmtHours(hb)}` : ""} · {Math.round(ratio * 100)} %
      </AppText>
      {level === 2 && <AppBadge color="red">{t("budgetOver")}</AppBadge>}
      {level === 1 && <AppBadge color="orange">{t("budgetWarn")}</AppBadge>}
    </AppGroup>
  );
}

export function StateBadge({ state }: { state: ApprovalState }) {
  const { t } = useI18n();
  if (state === "Pending_Admin_Review")
    return <AppBadge color="orange">{t("pendingApproval")}</AppBadge>;
  if (state === "Rejected") return <AppBadge color="red">{t("rejected")}</AppBadge>;
  return <AppBadge color="green">{t("approved")}</AppBadge>;
}

/** admin=true: full management with approve/reject. */
export function ProjectsPage({ admin = false }: { admin?: boolean }) {
  const { t, fmtHours } = useI18n();
  const qc = useQueryClient();
  const { data: me } = useSuspenseQuery(meQuery);
  const { data: projects } = useSuspenseQuery(myProjectsQuery);
  const [editing, setEditing] = useState<ProjectRow | null>(null);
  const [open, setOpen] = useState(false);
  const isAdmin = !!me?.isAdmin;

  const review = async (id: string, approve: boolean) => {
    await reviewProject({ data: { id, approve } });
    notify.show({
      color: approve ? "green" : "orange",
      message: approve ? t("approved") : t("rejected"),
    });
    qc.invalidateQueries({ queryKey: ["projects"] });
  };

  const rows = admin
    ? [...projects].sort(
        (a, b) =>
          Number(b.approval_state === "Pending_Admin_Review") -
          Number(a.approval_state === "Pending_Admin_Review"),
      )
    : projects;

  return (
    <AppStack gap="var(--app-grid-gap)" maw={1280} mx="auto">
      <AppPageHeader
        icon={Kanban}
        title={admin ? t("projects") : t("myProjects")}
        subtitle={t("sub_projects")}
        actions={
          <AppButton
            leftSection={<Plus weight="duotone" size={16} />}
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            {t("createProject")}
          </AppButton>
        }
      />
      <AppCard>
        <AppDataTable<ProjectRow>
          rows={rows}
          rowKey={(r) => r.id}
          empty={t("noProjects")}
          columns={[
            { key: "n", label: t("name"), render: (r) => r.name },
            { key: "c", label: t("customer"), render: (r) => r.customer_name },
            { key: "o", label: t("orderNumber"), render: (r) => r.order_number ?? "—" },
            {
              key: "b",
              label: t("budget"),
              render: (r) => <BudgetCell r={r} />,
            },
            {
              key: "s",
              label: t("status"),
              render: (r) => (
                <AppGroup gap={4} justify="flex-end" wrap="nowrap">
                  <StateBadge state={r.approval_state} />
                  {!r.is_visible && <AppBadge color="gray">{t("archived")}</AppBadge>}
                </AppGroup>
              ),
            },
            ...(admin && isAdmin
              ? [
                  {
                    key: "a",
                    label: "",
                    render: (r: ProjectRow) => (
                      <AppGroup gap={4} wrap="nowrap" justify="flex-end">
                        {r.approval_state === "Pending_Admin_Review" && (
                          <>
                            <AppButton
                              size="compact-xs"
                              color="green"
                              onClick={() => review(r.id, true)}
                            >
                              {t("approve")}
                            </AppButton>
                            <AppButton
                              size="compact-xs"
                              color="red"
                              variant="light"
                              onClick={() => review(r.id, false)}
                            >
                              {t("reject")}
                            </AppButton>
                          </>
                        )}
                        <AppButton
                          size="compact-xs"
                          variant="default"
                          onClick={() => {
                            setEditing(r);
                            setOpen(true);
                          }}
                        >
                          {t("edit")}
                        </AppButton>
                      </AppGroup>
                    ),
                  },
                ]
              : []),
          ]}
        />
      </AppCard>
      <ProjectForm
        opened={open}
        onClose={() => setOpen(false)}
        project={editing}
        isAdmin={isAdmin}
      />
    </AppStack>
  );
}
