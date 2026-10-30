import { Island } from "@phosphor-icons/react";
import { useState } from "react";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import {
  AppCard,
  AppHeading,
  AppGroup,
  AppStack,
  AppButton,
  AppBadge,
  AppText,
  AppIconButton,
  AppDataTable,
  notify,
  AppPageHeader,
} from "@/components/core";
import { useI18n, type TKey } from "@/lib/i18n";
import { meQuery } from "@/lib/session";
import { absenceOverview, decideAbsence, type AbsenceEntry } from "@/backend/extra.functions";

export function AbsencesPage() {
  const { t, fmtDate } = useI18n();
  const { data: me } = useSuspenseQuery(meQuery);
  const isAdmin = !!me?.isAdmin;
  const [year, setYear] = useState(() => new Date().getFullYear());
  const q = useQuery({
    queryKey: ["absences", year],
    queryFn: () => absenceOverview({ data: { year } }),
  });
  const summary = q.data?.summary ?? [];
  const entries = q.data?.entries ?? [];

  const decide = async (id: string, approve: boolean) => {
    await decideAbsence({ data: { id, approve } });
    notify.show({ color: "lucesem", message: approve ? "@absenceApproved" : "@absenceRejected" });
    q.refetch();
  };

  const statusBadge = (s: string) => (
    <AppBadge
      color={s === "approved" ? "green" : s === "rejected" ? "red" : "orange"}
      variant="light"
    >
      {s === "approved" ? t("approved") : s === "rejected" ? t("reject") : t("pendingApproval")}
    </AppBadge>
  );

  return (
    <AppStack gap="var(--app-grid-gap)" maw={1280} mx="auto">
      <AppPageHeader
        icon={Island}
        title={t("absences")}
        subtitle={t("sub_absences")}
        actions={
          <AppGroup gap="xs" align="center">
            <AppIconButton variant="default" onClick={() => setYear(year - 1)} aria-label="prev">
              <CaretLeft weight="duotone" size={16} />
            </AppIconButton>
            <AppText fw={700} fz="sm">
              {year}
            </AppText>
            <AppIconButton variant="default" onClick={() => setYear(year + 1)} aria-label="next">
              <CaretRight weight="duotone" size={16} />
            </AppIconButton>
          </AppGroup>
        }
      />
      <AppCard>
        <AppDataTable
          rows={summary}
          rowKey={(r) => r.user_id}
          empty={q.isLoading ? "…" : t("noEntries")}
          columns={[
            { key: "u", label: t("user"), render: (r) => r.user_name },
            { key: "a", label: t("allowance"), render: (r) => `${r.allowance} ${t("days")}` },
            { key: "v", label: t("vacationUsed"), render: (r) => r.vacation_days },
            { key: "p", label: t("vacationPendingL"), render: (r) => r.vacation_pending },
            {
              key: "l",
              label: t("left"),
              render: (r) => {
                const left = r.allowance - r.vacation_days;
                return (
                  <AppText c={left < 0 ? "red" : "var(--app-text-primary)"} fw={700}>
                    {left}
                  </AppText>
                );
              },
            },
            { key: "s", label: t("sickDays"), render: (r) => r.sick_days },
            { key: "c", label: t("compDays"), render: (r) => r.comp_days },
          ]}
        />
      </AppCard>
      <AppCard>
        <AppDataTable<AbsenceEntry>
          rows={entries}
          rowKey={(r) => r.id}
          empty={t("noEntries")}
          columns={[
            ...(isAdmin
              ? [{ key: "u", label: t("user"), render: (r: AbsenceEntry) => r.user_name }]
              : []),
            { key: "d", label: t("date"), render: (r) => fmtDate(r.entry_date) },
            { key: "m", label: t("mode"), render: (r) => t(r.entry_mode as TKey) },
            { key: "s", label: t("status"), render: (r) => statusBadge(r.status) },
            ...(isAdmin
              ? [
                  {
                    key: "a",
                    label: "",
                    render: (r: AbsenceEntry) =>
                      r.status === "pending" ? (
                        <AppGroup gap={4} wrap="nowrap">
                          <AppButton size="compact-xs" onClick={() => decide(r.id, true)}>
                            {t("approve")}
                          </AppButton>
                          <AppButton
                            size="compact-xs"
                            color="red"
                            variant="light"
                            onClick={() => decide(r.id, false)}
                          >
                            {t("reject")}
                          </AppButton>
                        </AppGroup>
                      ) : null,
                  },
                ]
              : []),
          ]}
        />
      </AppCard>
    </AppStack>
  );
}
