import { UsersThree } from "@phosphor-icons/react";
import { useState } from "react";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Plus } from "@phosphor-icons/react";
import {
  AppCard,
  AppHeading,
  AppGroup,
  AppStack,
  AppButton,
  AppText,
  AppGrid,
  AppModal,
  AppTextInput,
  AppMultiSelect,
  AppBadge,
  AppAlert,
  notify,
  AppPageHeader,
} from "@/components/core";
import { useI18n } from "@/lib/i18n";
import { teamsQuery, usersQuery } from "@/lib/session";
import { saveTeam } from "@/backend/org.functions";

interface Form {
  id?: string;
  name: string;
  memberIds: string[];
  leadIds: string[];
}

export function TeamsPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data: teams } = useSuspenseQuery(teamsQuery);
  const { data: users = [] } = useQuery(usersQuery);
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState<string | null>(null);
  const nameOf = (id: string) => users.find((u) => u.id === id)?.display_name ?? "…";
  const userOptions = users.map((u) => ({ value: u.id, label: u.display_name }));

  const submit = async () => {
    if (!form) return;
    try {
      await saveTeam({ data: { ...form, color: "lucesem" } });
      await qc.invalidateQueries({ queryKey: ["teams"] });
      notify.show({ color: "lucesem", message: "@teamSaved" });
      setForm(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error"));
    }
  };

  return (
    <AppStack gap="var(--app-grid-gap)" maw={1280} mx="auto">
      <AppPageHeader
        icon={UsersThree}
        title={t("teams")}
        subtitle={t("sub_teams")}
        actions={
          <AppButton
            leftSection={<Plus weight="duotone" size={16} />}
            onClick={() => {
              setError(null);
              setForm({ name: "", memberIds: [], leadIds: [] });
            }}
          >
            {t("newItem")}
          </AppButton>
        }
      />
      <AppGrid cols={{ base: 1, sm: 2, lg: 3 }}>
        {teams.map((team) => (
          <AppCard key={team.id}>
            <div className="app-folder-tabs-row" style={{ marginBottom: 16 }}>
              <div className="app-section-heading">
                <AppHeading order={4}>{team.name}</AppHeading>
              </div>
              <AppButton
                size="compact-xs"
                variant="default"
                onClick={() => {
                  setError(null);
                  setForm({
                    id: team.id,
                    name: team.name,
                    memberIds: team.members.filter((m) => !m.isLead).map((m) => m.userId),
                    leadIds: team.members.filter((m) => m.isLead).map((m) => m.userId),
                  });
                }}
              >
                {t("edit")}
              </AppButton>
            </div>
            <AppGroup gap={4}>
              {team.members.length === 0 && (
                <AppText fz="sm" c="var(--app-text-secondary)">
                  —
                </AppText>
              )}
              {team.members.map((m) => (
                <AppBadge
                  key={m.userId}
                  color={m.isLead ? "lucesem" : "gray"}
                  variant={m.isLead ? "filled" : "light"}
                >
                  {nameOf(m.userId)}
                </AppBadge>
              ))}
            </AppGroup>
          </AppCard>
        ))}
      </AppGrid>

      <AppModal
        opened={!!form}
        onClose={() => setForm(null)}
        title={form?.id ? t("edit") : t("newItem")}
      >
        {form && (
          <AppStack>
            {error && <AppAlert color="red">{error}</AppAlert>}
            <AppTextInput
              label={t("name")}
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.currentTarget.value })}
            />
            <AppMultiSelect
              label={t("leads")}
              placeholder={t("selectUsers")}
              value={form.leadIds}
              onChange={(v) => setForm({ ...form, leadIds: v })}
              data={userOptions}
            />
            <AppMultiSelect
              label={t("members")}
              placeholder={t("selectUsers")}
              value={form.memberIds}
              onChange={(v) => setForm({ ...form, memberIds: v })}
              data={userOptions}
            />
            <AppGroup justify="flex-end">
              <AppButton variant="default" onClick={() => setForm(null)}>
                {t("cancel")}
              </AppButton>
              <AppButton onClick={submit} disabled={form.name.trim().length < 2}>
                {t("save")}
              </AppButton>
            </AppGroup>
          </AppStack>
        )}
      </AppModal>
    </AppStack>
  );
}
