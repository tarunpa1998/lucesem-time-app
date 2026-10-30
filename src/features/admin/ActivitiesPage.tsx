import { Tag } from "@phosphor-icons/react";
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
  AppModal,
  AppSelect,
  AppTextInput,
  AppSwitch,
  AppDataTable,
  notify,
  AppPageHeader,
} from "@/components/core";
import { useI18n } from "@/lib/i18n";
import { activitiesQuery, myProjectsQuery } from "@/lib/session";
import { saveActivity, type ActivityRow } from "@/backend/extra.functions";

interface Form {
  id?: string;
  projectId: string | null;
  name: string;
  isActive: boolean;
}

export function ActivitiesPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data } = useSuspenseQuery(activitiesQuery);
  const { data: projects = [] } = useQuery(myProjectsQuery);
  const [form, setForm] = useState<Form | null>(null);

  const submit = async () => {
    if (!form) return;
    await saveActivity({ data: form });
    notify.show({ color: "lucesem", message: "@activitySaved" });
    setForm(null);
    qc.invalidateQueries({ queryKey: ["activities"] });
  };

  return (
    <AppStack gap="var(--app-grid-gap)" maw={1280} mx="auto">
      <AppPageHeader
        icon={Tag}
        title={t("activities")}
        subtitle={t("sub_activities")}
        actions={
          <AppButton
            leftSection={<Plus weight="duotone" size={16} />}
            onClick={() => setForm({ projectId: null, name: "", isActive: true })}
          >
            {t("newItem")}
          </AppButton>
        }
      />
      <AppCard>
        <AppDataTable<ActivityRow>
          rows={data}
          rowKey={(r) => r.id}
          empty={t("noEntries")}
          columns={[
            { key: "n", label: t("name"), render: (r) => r.name },
            {
              key: "p",
              label: t("project"),
              render: (r) => r.project_name ?? t("allProjectsGlobal"),
            },
            {
              key: "s",
              label: t("status"),
              render: (r) =>
                r.is_active ? (
                  <AppBadge color="green" variant="light">
                    {t("enabled")}
                  </AppBadge>
                ) : (
                  <AppBadge color="gray" variant="light">
                    {t("archived")}
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
                  onClick={() =>
                    setForm({
                      id: r.id,
                      projectId: r.project_id,
                      name: r.name,
                      isActive: r.is_active,
                    })
                  }
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
            <AppTextInput
              label={t("name")}
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.currentTarget.value })}
            />
            <AppSelect
              label={t("project")}
              placeholder={t("allProjectsGlobal")}
              clearable
              value={form.projectId}
              onChange={(v) => setForm({ ...form, projectId: v })}
              data={projects.map((p) => ({ value: p.id, label: `${p.name} — ${p.customer_name}` }))}
            />
            <AppSwitch
              label={t("enabled")}
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.currentTarget.checked })}
            />
            <AppGroup justify="flex-end">
              <AppButton variant="default" onClick={() => setForm(null)}>
                {t("cancel")}
              </AppButton>
              <AppButton disabled={form.name.trim().length < 2} onClick={submit}>
                {t("save")}
              </AppButton>
            </AppGroup>
          </AppStack>
        )}
      </AppModal>
    </AppStack>
  );
}
