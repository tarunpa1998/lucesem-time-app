import { Users } from "@phosphor-icons/react";
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
  AppModal,
  AppTextInput,
  AppPasswordInput,
  AppNumberInput,
  AppSelect,
  AppSwitch,
  AppChip,
  AppText,
  AppGrid,
  AppAlert,
  notify,
  AppPageHeader,
} from "@/components/core";
import { useI18n } from "@/lib/i18n";
import { usersQuery } from "@/lib/session";
import { saveUser, bulkSetVacation } from "@/backend/org.functions";
import type { RoleName, UserRow } from "@/backend/types";

interface Form {
  id?: string;
  email: string;
  displayName: string;
  password: string;
  role: RoleName;
  weeklyTargetHours: number | string;
  workDays: number[];
  vacationDaysPerYear: number | string;
  includeCarinthia: boolean;
  requiresTimesheetApproval: boolean;
  isActive: boolean;
}
const blank = (): Form => ({
  email: "",
  displayName: "",
  password: "",
  role: "user",
  weeklyTargetHours: 38.5,
  workDays: [1, 2, 3, 4, 5],
  vacationDaysPerYear: 25,
  includeCarinthia: true,
  requiresTimesheetApproval: false,
  isActive: true,
});

export function UsersPage() {
  const { t, lang, fmtHours } = useI18n();
  const qc = useQueryClient();
  const { data: users } = useSuspenseQuery(usersQuery);
  const [form, setForm] = useState<Form | null>(null);
  const [bulk, setBulk] = useState<number | string>(25);
  const [error, setError] = useState<string | null>(null);
  const days =
    lang === "de"
      ? ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"]
      : ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  const order = [1, 2, 3, 4, 5, 6, 0];

  const submit = async () => {
    if (!form) return;
    setError(null);
    try {
      await saveUser({
        data: {
          ...form,
          weeklyTargetHours: Number(form.weeklyTargetHours),
          vacationDaysPerYear: Number(form.vacationDaysPerYear),
        },
      });
      await qc.invalidateQueries({ queryKey: ["users"] });
      await qc.invalidateQueries({ queryKey: ["me"] });
      notify.show({ color: "lucesem", message: "@userSaved" });
      setForm(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error"));
    }
  };

  const perDay =
    form && form.workDays.length ? Number(form.weeklyTargetHours) / form.workDays.length : 0;

  return (
    <AppStack gap="var(--app-grid-gap)" maw={1280} mx="auto">
      <AppPageHeader
        icon={Users}
        title={t("users")}
        subtitle={t("sub_users")}
        actions={
          <AppButton
            leftSection={<Plus weight="duotone" size={16} />}
            onClick={() => {
              setError(null);
              setForm(blank());
            }}
          >
            {t("newItem")}
          </AppButton>
        }
      />
      <AppCard>
        <AppGroup align="flex-end">
          <AppNumberInput
            label={t("vacationDays")}
            min={0}
            max={60}
            w={160}
            value={bulk}
            onChange={setBulk}
          />
          <AppButton
            variant="light"
            onClick={async () => {
              await bulkSetVacation({ data: { days: Number(bulk) } });
              qc.invalidateQueries({ queryKey: ["users"] });
              notify.show({ color: "lucesem", message: "@vacationSet" });
            }}
          >
            {t("bulkVacation")}
          </AppButton>
        </AppGroup>
      </AppCard>
      <AppCard>
        <AppDataTable<UserRow>
          rows={users}
          rowKey={(r) => r.id}
          empty="—"
          columns={[
            { key: "n", label: t("name"), render: (r) => r.display_name },
            { key: "e", label: t("email"), render: (r) => r.email },
            {
              key: "r",
              label: t("role"),
              render: (r) => (
                <AppBadge color={r.roles.includes("admin") ? "lucesem" : "gray"}>
                  {r.roles.join(", ")}
                </AppBadge>
              ),
            },
            {
              key: "w",
              label: t("weeklyHours"),
              render: (r) => fmtHours(Number(r.weekly_target_hours)),
            },
            { key: "v", label: t("vacationDays"), render: (r) => r.vacation_days_per_year },
            {
              key: "s",
              label: t("status"),
              render: (r) => (
                <AppBadge color={r.is_active ? "green" : "gray"}>
                  {r.is_active ? t("active") : t("archived")}
                </AppBadge>
              ),
            },
            {
              key: "a",
              label: "",
              render: (r) => (
                <AppButton
                  size="compact-xs"
                  variant="default"
                  onClick={() => {
                    setError(null);
                    setForm({
                      id: r.id,
                      email: r.email,
                      displayName: r.display_name,
                      password: "",
                      role: r.roles[0] ?? "user",
                      weeklyTargetHours: Number(r.weekly_target_hours),
                      workDays: r.work_days,
                      vacationDaysPerYear: r.vacation_days_per_year,
                      includeCarinthia: r.include_carinthia,
                      requiresTimesheetApproval: r.requires_timesheet_approval,
                      isActive: r.is_active,
                    });
                  }}
                >
                  {t("edit")}
                </AppButton>
              ),
            },
          ]}
        />
      </AppCard>

      <AppModal
        opened={!!form}
        onClose={() => setForm(null)}
        title={form?.id ? t("edit") : t("newItem")}
      >
        {form && (
          <AppStack>
            {error && <AppAlert color="red">{error}</AppAlert>}
            <AppGrid cols={{ base: 1, sm: 2 }}>
              <AppTextInput
                label={t("displayName")}
                required
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.currentTarget.value })}
              />
              <AppTextInput
                label={t("email")}
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.currentTarget.value })}
              />
              <AppPasswordInput
                label={t("password")}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.currentTarget.value })}
              />
              <AppSelect
                label={t("role")}
                placeholder={t("selectRole")}
                allowDeselect={false}
                value={form.role}
                onChange={(v) => setForm({ ...form, role: (v ?? "user") as RoleName })}
                data={[
                  { value: "user", label: "User" },
                  { value: "team_lead", label: "Team Lead" },
                  { value: "admin", label: "Admin" },
                ]}
              />
              <AppNumberInput
                label={t("weeklyHours")}
                min={0}
                max={80}
                step={0.5}
                value={form.weeklyTargetHours}
                onChange={(v) => setForm({ ...form, weeklyTargetHours: v })}
              />
              <AppNumberInput
                label={t("vacationDays")}
                min={0}
                max={60}
                value={form.vacationDaysPerYear}
                onChange={(v) => setForm({ ...form, vacationDaysPerYear: v })}
              />
            </AppGrid>
            <div>
              <AppText fz="sm" fw={600} mb={6}>
                {t("workDays")}
              </AppText>
              <AppChip.Group
                multiple
                value={form.workDays.map(String)}
                onChange={(v) => setForm({ ...form, workDays: v.map(Number) })}
              >
                <AppGroup gap={6}>
                  {order.map((d) => (
                    <AppChip key={d} value={String(d)} size="sm">
                      {days[d]}
                    </AppChip>
                  ))}
                </AppGroup>
              </AppChip.Group>
              <AppText fz="xs" mt={6} c="var(--app-text-secondary)">
                = {fmtHours(perDay)} / {t("day")}
              </AppText>
            </div>
            <AppSwitch
              label={t("carinthia")}
              checked={form.includeCarinthia}
              onChange={(e) => setForm({ ...form, includeCarinthia: e.currentTarget.checked })}
            />
            <AppSwitch
              label={t("needsApproval")}
              checked={form.requiresTimesheetApproval}
              onChange={(e) =>
                setForm({ ...form, requiresTimesheetApproval: e.currentTarget.checked })
              }
            />
            <AppSwitch
              label={t("active")}
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.currentTarget.checked })}
            />
            <AppGroup justify="flex-end">
              <AppButton variant="default" onClick={() => setForm(null)}>
                {t("cancel")}
              </AppButton>
              <AppButton onClick={submit}>{t("save")}</AppButton>
            </AppGroup>
          </AppStack>
        )}
      </AppModal>
    </AppStack>
  );
}
