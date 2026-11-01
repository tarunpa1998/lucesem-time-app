import { Globe } from "@phosphor-icons/react";
import { useState } from "react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import {
  AppCard,
  AppHeading,
  AppGroup,
  AppStack,
  AppButton,
  AppText,
  AppSwitch,
  AppPasswordInput,
  AppModal,
  AppDataTable,
  AppBadge,
  AppAlert,
  notify,
  AppPageHeader,
} from "@/components/core";
import { useI18n } from "@/lib/i18n";
import { portalsQuery } from "@/lib/session";
import { savePortal, type PortalRow } from "@/backend/workflow.functions";

export function PortalsPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data } = useSuspenseQuery(portalsQuery);
  const [edit, setEdit] = useState<PortalRow | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const link = (token: string) => `${window.location.origin}/portal/${token}`;
  const refresh = () => qc.invalidateQueries({ queryKey: ["portals"] });

  const save = async () => {
    if (!edit) return;
    try {
      await savePortal({ data: { customerId: edit.customer_id, password, enabled: true } });
      setEdit(null);
      refresh();
      notify.show({ color: "lucesem", message: "@portalSaved" });
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error"));
    }
  };

  return (
    <AppStack gap="var(--app-grid-gap)" maw={1280} mx="auto">
      <AppPageHeader icon={Globe} title={t("portal")} subtitle={t("sub_portal")} />
      <AppCard>
        <div className="app-folder-tabs-row" style={{ marginBottom: 16 }}>
          <div className="app-section-heading">
            <AppHeading order={4}>
              {t("portal")} ({data.length})
            </AppHeading>
          </div>
        </div>
        <AppDataTable
          rows={data}
          rowKey={(r) => r.customer_id}
          empty={t("noEntries")}
          columns={[
            { key: "c", label: t("customer"), render: (r) => r.customer_name },
            {
              key: "s",
              label: t("status"),
              render: (r) =>
                r.token ? (
                  <AppSwitch
                    label={t("enabled")}
                    checked={!!r.enabled}
                    onChange={async (e) => {
                      await savePortal({
                        data: { customerId: r.customer_id, enabled: e.currentTarget.checked },
                      });
                      refresh();
                    }}
                  />
                ) : (
                  <AppBadge color="gray" variant="light">
                    {t("notConfigured")}
                  </AppBadge>
                ),
            },
            {
              key: "a",
              label: "",
              render: (r) => (
                <AppGroup gap={4} wrap="nowrap">
                  {r.token && (
                    <AppButton
                      size="compact-xs"
                      variant="default"
                      onClick={async () => {
                        await navigator.clipboard.writeText(link(r.token!));
                        notify.show({ color: "lucesem", message: t("copied") });
                      }}
                    >
                      {t("copyLink")}
                    </AppButton>
                  )}
                  <AppButton
                    size="compact-xs"
                    onClick={() => {
                      setError(null);
                      setPassword("");
                      setEdit(r);
                    }}
                  >
                    {t("setPassword")}
                  </AppButton>
                </AppGroup>
              ),
            },
          ]}
        />
      </AppCard>
      <AppModal
        opened={!!edit}
        onClose={() => setEdit(null)}
        title={`${t("portal")} · ${edit?.customer_name ?? ""}`}
      >
        <AppStack>
          {error && <AppAlert color="red">{error}</AppAlert>}
          <AppText fz="sm" c="var(--app-text-secondary)">
            min. 8
          </AppText>
          <AppPasswordInput
            label={t("setPassword")}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
          />
          <AppGroup justify="flex-end">
            <AppButton variant="default" onClick={() => setEdit(null)}>
              {t("cancel")}
            </AppButton>
            <AppButton disabled={password.length < 8} onClick={save}>
              {t("save")}
            </AppButton>
          </AppGroup>
        </AppStack>
      </AppModal>
    </AppStack>
  );
}
