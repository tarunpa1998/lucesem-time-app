import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AppModal,
  AppStack,
  AppSelect,
  AppTextInput,
  AppNumberInput,
  AppMultiSelect,
  AppSwitch,
  AppButton,
  AppGroup,
  AppGrid,
  AppText,
  AppAlert,
  notify,
} from "@/components/core";
import { useI18n } from "@/lib/i18n";
import { customersQuery, teamsQuery, usersQuery } from "@/lib/session";
import { saveProject, getProjectAssignments } from "@/backend/org.functions";
import type { ProjectRow } from "@/backend/types";

interface Props {
  opened: boolean;
  onClose: () => void;
  project?: ProjectRow | null;
  isAdmin: boolean;
}

const num = (v: string | null) => (v == null ? "" : Number(v));

export function ProjectForm({ opened, onClose, project, isAdmin }: Props) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data: customers = [] } = useQuery({ ...customersQuery, enabled: opened });
  const { data: teams = [] } = useQuery({ ...teamsQuery, enabled: opened && isAdmin });
  const { data: users = [] } = useQuery({ ...usersQuery, enabled: opened && isAdmin });
  const [f, setF] = useState({
    customerId: "",
    name: "",
    orderNumber: "",
    timeBudgetHours: "" as number | string,
    monetaryBudget: "" as number | string,
    hourlyRate: "" as number | string,
    isVisible: true,
    teamIds: [] as string[],
    userIds: [] as string[],
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!opened) return;
    setError(null);
    setF({
      customerId: project?.customer_id ?? "",
      name: project?.name ?? "",
      orderNumber: project?.order_number ?? "",
      timeBudgetHours: num(project?.time_budget_hours ?? null),
      monetaryBudget: num(project?.monetary_budget ?? null),
      hourlyRate: num(project?.hourly_rate ?? null),
      isVisible: project?.is_visible ?? true,
      teamIds: [],
      userIds: [],
    });
    let active = true;
    if (project && isAdmin) {
      getProjectAssignments({ data: { id: project.id } })
        .then((a) => {
          if (active) setF((s) => ({ ...s, ...a }));
        })
        .catch((err) => {
          if (active) console.error("Failed to load project assignments:", err);
        });
    }
    return () => {
      active = false;
    };
  }, [opened, project, isAdmin]);

  const n = (v: number | string) => (v === "" ? null : Number(v));
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await saveProject({
        data: {
          ...(project ? { id: project.id } : {}),
          customerId: f.customerId,
          name: f.name,
          orderNumber: f.orderNumber,
          color: "lucesem",
          timeBudgetHours: n(f.timeBudgetHours),
          monetaryBudget: n(f.monetaryBudget),
          hourlyRate: n(f.hourlyRate),
          isVisible: f.isVisible,
          teamIds: f.teamIds,
          userIds: f.userIds,
        },
      });
      await qc.invalidateQueries({ queryKey: ["projects"] });
      notify.show({ color: "lucesem", message: "@projectSaved" });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppModal opened={opened} onClose={onClose} title={project ? t("edit") : t("createProject")}>
      <AppStack>
        {!isAdmin && (
          <AppText fz="sm" c="var(--app-text-secondary)">
            {t("projectPendingHint")}
          </AppText>
        )}
        {error && <AppAlert color="red">{error}</AppAlert>}
        <AppSelect
          label={t("customer")}
          placeholder={t("selectCustomer")}
          required
          value={f.customerId || null}
          onChange={(v) => setF({ ...f, customerId: v ?? "" })}
          data={customers.map((c) => ({ value: c.id, label: c.name }))}
        />
        <AppTextInput
          label={t("name")}
          placeholder={t("projectName")}
          required
          value={f.name}
          onChange={(e) => setF({ ...f, name: e.currentTarget.value })}
        />
        <AppTextInput
          label={t("orderNumber")}
          value={f.orderNumber}
          onChange={(e) => setF({ ...f, orderNumber: e.currentTarget.value })}
        />
        <AppGrid cols={{ base: 1, sm: isAdmin ? 3 : 2 }}>
          <AppNumberInput
            label={t("timeBudget")}
            min={0}
            value={f.timeBudgetHours}
            onChange={(v) => setF({ ...f, timeBudgetHours: v })}
          />
          <AppNumberInput
            label={t("moneyBudget")}
            min={0}
            value={f.monetaryBudget}
            onChange={(v) => setF({ ...f, monetaryBudget: v })}
          />
          {isAdmin && (
            <AppNumberInput
              label={t("hourlyRate")}
              min={0}
              value={f.hourlyRate}
              onChange={(v) => setF({ ...f, hourlyRate: v })}
            />
          )}
        </AppGrid>
        {isAdmin && (
          <>
            <AppMultiSelect
              label={t("assignedTeams")}
              placeholder={t("selectTeams")}
              value={f.teamIds}
              onChange={(v) => setF({ ...f, teamIds: v })}
              data={teams.map((x) => ({ value: x.id, label: x.name }))}
            />
            <AppMultiSelect
              label={t("assignedUsers")}
              placeholder={t("selectUsers")}
              value={f.userIds}
              onChange={(v) => setF({ ...f, userIds: v })}
              data={users.map((x) => ({ value: x.id, label: x.display_name }))}
            />
            <AppSwitch
              label={t("visible")}
              checked={f.isVisible}
              onChange={(e) => setF({ ...f, isVisible: e.currentTarget.checked })}
            />
          </>
        )}
        <AppGroup justify="flex-end">
          <AppButton variant="default" onClick={onClose}>
            {t("cancel")}
          </AppButton>
          <AppButton
            loading={busy}
            onClick={submit}
            disabled={!f.customerId || f.name.trim().length < 2}
          >
            {t("save")}
          </AppButton>
        </AppGroup>
      </AppStack>
    </AppModal>
  );
}
