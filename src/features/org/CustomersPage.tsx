import { Buildings } from "@phosphor-icons/react";
import { useState } from "react";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
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
  AppNumberInput,
  AppSelect,
  AppMultiSelect,
  AppSwitch,
  AppTextarea,
  AppGrid,
  AppAlert,
  notify,
  AppPageHeader,
} from "@/components/core";
import { useI18n, type TKey } from "@/lib/i18n";
import { customersQuery, teamsQuery } from "@/lib/session";
import { saveCustomer } from "@/backend/org.functions";
import type { CustomerRow } from "@/backend/types";

const TEXT_FIELDS: [keyof CustomerRow, TKey][] = [
  ["company_number", "companyNumber"],
  ["vat_id", "vatId"],
  ["street", "street"],
  ["postal_code", "postalCode"],
  ["city", "city"],
  ["country", "country"],
  ["contact_person", "contactPerson"],
  ["email", "email"],
  ["phone", "phone"],
  ["mobile", "mobile"],
  ["fax", "fax"],
  ["website", "website"],
  ["currency", "currency"],
];
const camel = (s: string) => s.replace(/_(\w)/g, (_, c: string) => c.toUpperCase());

type Form = { [K in keyof CustomerRow]?: CustomerRow[K] | number | string | null };
const blank = (): Form => ({
  name: "",
  country: "AT",
  currency: "EUR",
  budget_type: "Total",
  is_visible: true,
  team_ids: [],
});

export function CustomersPage() {
  const { t, fmtHours } = useI18n();
  const qc = useQueryClient();
  const { data: customers } = useSuspenseQuery(customersQuery);
  const { data: teams = [] } = useQuery(teamsQuery);
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof CustomerRow, v: unknown) => setForm((f) => ({ ...f!, [k]: v }));
  const numOrNull = (v: unknown) => (v === "" || v == null ? null : Number(v));

  const submit = async () => {
    if (!form) return;
    setBusy(true);
    setError(null);
    try {
      const data: Record<string, unknown> = {
        name: form.name,
        color: "lucesem",
        timezone: "Europe/Vienna",
        budgetType: form.budget_type,
        isVisible: form.is_visible,
        teamIds: form.team_ids,
        internalComment: form.internal_comment ?? null,
        timeBudgetHours: numOrNull(form.time_budget_hours),
        monetaryBudget: numOrNull(form.monetary_budget),
      };
      if (form.id) data["id"] = form.id;
      for (const [k] of TEXT_FIELDS)
        data[camel(k)] = form[k] || (k === "country" ? "AT" : k === "currency" ? "EUR" : null);
      await saveCustomer({ data: data as never });
      await qc.invalidateQueries({ queryKey: ["customers"] });
      notify.show({ color: "lucesem", message: "@customerSaved" });
      setForm(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppStack gap="var(--app-grid-gap)" maw={1280} mx="auto">
      <AppPageHeader
        icon={Buildings}
        title={t("customers")}
        subtitle={t("sub_customers")}
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
        <div className="app-folder-tabs-row" style={{ marginBottom: 16 }}>
          <div className="app-section-heading">
            <AppHeading order={4}>
              {t("customers")} ({customers.length})
            </AppHeading>
          </div>
        </div>
        <AppDataTable<CustomerRow>
          rows={customers}
          rowKey={(r) => r.id}
          empty="—"
          columns={[
            { key: "n", label: t("name"), render: (r) => r.name },
            { key: "v", label: t("vatId"), render: (r) => r.vat_id ?? "—" },
            {
              key: "c",
              label: t("city"),
              render: (r) => [r.postal_code, r.city].filter(Boolean).join(" ") || "—",
            },
            {
              key: "b",
              label: t("timeBudget"),
              render: (r) => (r.time_budget_hours ? fmtHours(Number(r.time_budget_hours)) : "—"),
            },
            {
              key: "s",
              label: t("status"),
              render: (r) => (
                <AppBadge color={r.is_visible ? "green" : "gray"}>
                  {r.is_visible ? t("visible") : t("archived")}
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
                    setForm({ ...(r as unknown as Form) });
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
        size="xl"
      >
        {form && (
          <AppStack>
            {error && <AppAlert color="red">{error}</AppAlert>}
            <AppTextInput
              label={t("name")}
              required
              value={String(form.name ?? "")}
              onChange={(e) => set("name", e.currentTarget.value)}
            />
            <AppGrid cols={{ base: 1, sm: 2, md: 3 }}>
              {TEXT_FIELDS.map(([k, label]) => (
                <AppTextInput
                  key={k}
                  label={t(label)}
                  value={String(form[k] ?? "")}
                  onChange={(e) => set(k, e.currentTarget.value)}
                />
              ))}
            </AppGrid>
            <AppGrid cols={{ base: 1, sm: 3 }}>
              <AppNumberInput
                label={t("timeBudget")}
                min={0}
                value={(form.time_budget_hours as number | string) ?? ""}
                onChange={(v) => set("time_budget_hours", v)}
              />
              <AppNumberInput
                label={t("moneyBudget")}
                min={0}
                value={(form.monetary_budget as number | string) ?? ""}
                onChange={(v) => set("monetary_budget", v)}
              />
              <AppSelect
                label={t("budgetType")}
                placeholder={t("selectBudgetType")}
                allowDeselect={false}
                value={String(form.budget_type)}
                onChange={(v) => set("budget_type", v)}
                data={[
                  { value: "Total", label: t("total") },
                  { value: "Monthly", label: t("monthly") },
                ]}
              />
            </AppGrid>
            <AppMultiSelect
              label={t("assignedTeams")}
              placeholder={t("selectTeams")}
              value={(form.team_ids as string[]) ?? []}
              onChange={(v) => set("team_ids", v)}
              data={teams.map((x) => ({ value: x.id, label: x.name }))}
            />
            <AppTextarea
              label={t("comment")}
              placeholder={t("notes")}
              value={String(form.internal_comment ?? "")}
              onChange={(e) => set("internal_comment", e.currentTarget.value)}
            />
            <AppSwitch
              label={t("visible")}
              checked={!!form.is_visible}
              onChange={(e) => set("is_visible", e.currentTarget.checked)}
            />
            <AppGroup justify="flex-end">
              <AppButton variant="default" onClick={() => setForm(null)}>
                {t("cancel")}
              </AppButton>
              <AppButton loading={busy} onClick={submit}>
                {t("save")}
              </AppButton>
            </AppGroup>
          </AppStack>
        )}
      </AppModal>
    </AppStack>
  );
}
