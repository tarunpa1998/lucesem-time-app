import { useState, useRef, useEffect, type ChangeEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  UserCircle,
  Key,
  UploadSimple,
  Trash,
  Check,
  Briefcase,
  EnvelopeSimple,
  Phone,
  Globe,
  UsersThree,
  Kanban,
  ShieldCheck,
  Clock,
  Sparkle,
} from "@phosphor-icons/react";
import {
  AppCard,
  AppHeading,
  AppGroup,
  AppStack,
  AppButton,
  AppBadge,
  AppTextInput,
  AppSelect,
  AppText,
  AppMono,
  AppGrid,
  AppPageHeader,
  AppAvatar,
  AppProgress,
  AppBox,
  AppChip,
  ChangePasswordModal,
  notify,
} from "@/components/core";
import { useI18n, type Lang } from "@/lib/i18n";
import { meQuery, myProjectsQuery, teamsQuery } from "@/lib/session";
import { updateMyProfile } from "@/backend/auth.functions";

export function ProfilePage() {
  const { t, lang, setLang, fmtHours } = useI18n();
  const qc = useQueryClient();
  const { data: me } = useQuery(meQuery);
  const { data: myProjects = [] } = useQuery(myProjectsQuery);
  const { data: allTeams = [] } = useQuery(teamsQuery);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pwModalOpened, setPwModalOpened] = useState(false);

  // Form states
  const [displayName, setDisplayName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Sync state when `me` loads or updates
  useEffect(() => {
    if (me) {
      setDisplayName(me.displayName ?? "");
      setJobTitle(me.jobTitle ?? "");
      setPhone(me.phone ?? "");
      setAvatarUrl(me.avatarUrl ?? null);
    }
  }, [me]);

  if (!me) return null;

  const initials = me.displayName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");

  const isDirty =
    displayName !== me.displayName ||
    (jobTitle || null) !== (me.jobTitle || null) ||
    (phone || null) !== (me.phone || null) ||
    (avatarUrl || null) !== (me.avatarUrl || null);

  // Filter user's teams
  const userTeams = allTeams.filter((team) => team.members.some((m) => m.userId === me.id));

  // Weekdays calculation
  const dayLabels =
    lang === "de"
      ? ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"]
      : ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  const weekOrder = [1, 2, 3, 4, 5, 6, 0];
  const workDaysCount = me.workDays?.length || 5;
  const hoursPerDay = workDaysCount > 0 ? me.weeklyTargetHours / workDaysCount : 0;

  // Handle avatar upload with canvas downscale
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      notify.error("File exceeds 5MB limit");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_DIM = 280;
        let w = img.width;
        let h = img.height;
        if (w > h) {
          if (w > MAX_DIM) {
            h = Math.round((h * MAX_DIM) / w);
            w = MAX_DIM;
          }
        } else {
          if (h > MAX_DIM) {
            w = Math.round((w * MAX_DIM) / h);
            h = MAX_DIM;
          }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
          setAvatarUrl(dataUrl);
        }
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);

    // Reset input so same file can be picked again if desired
    e.target.value = "";
  };

  const handleSaveProfile = async () => {
    if (!displayName.trim()) return;
    setSaving(true);
    try {
      await updateMyProfile({
        data: {
          displayName: displayName.trim(),
          jobTitle: jobTitle.trim() || null,
          phone: phone.trim() || null,
          avatarUrl: avatarUrl || null,
        },
      });

      // Update TanStack Query cache
      await qc.invalidateQueries({ queryKey: meQuery.queryKey });
      notify.success(t("profileUpdated"));
    } catch {
      notify.error(t("error"));
    } finally {
      setSaving(false);
    }
  };

  const roleLabel = me.isAdmin
    ? "Administrator"
    : me.roles.includes("team_lead")
      ? t("teamLeadBadge")
      : t("user");

  const roleDescription = me.isAdmin
    ? t("roleAdminDesc")
    : me.roles.includes("team_lead")
      ? t("roleTeamLeadDesc")
      : t("roleUserDesc");

  return (
    <AppStack gap="lg" style={{ maxWidth: 1200, margin: "0 auto", paddingBottom: 48 }}>
      <AppPageHeader icon={UserCircle} title={t("profile")} subtitle={t("sub_profile")} />

      {/* Hidden file input for picture upload */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/png,image/jpeg,image/webp,image/gif"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      <AppGrid cols={{ base: 1, md: 12 }}>
        {/* LEFT COLUMN: Hero Identity & Security */}
        <AppBox style={{ gridColumn: "span 4" }}>
          <AppStack gap="lg">
            {/* Identity Hero Card */}
            <AppCard p="xl">
              <AppStack align="center" gap="md" style={{ textAlign: "center" }}>
                <div style={{ position: "relative", display: "inline-block" }}>
                  <AppAvatar
                    src={avatarUrl}
                    size={110}
                    radius={110}
                    alt={me.displayName}
                    style={{
                      border: "3px solid var(--app-border-subtle)",
                      boxShadow: "var(--app-shadow-card)",
                      background: "color-mix(in srgb, var(--app-brand-primary) 15%, transparent)",
                      color: "var(--app-brand-primary)",
                      fontSize: 34,
                      fontWeight: 700,
                    }}
                  >
                    {initials}
                  </AppAvatar>
                </div>

                <div style={{ minWidth: 0, width: "100%" }}>
                  <AppHeading
                    order={3}
                    style={{
                      marginBottom: 2,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {displayName || me.displayName}
                  </AppHeading>
                  {jobTitle ? (
                    <AppText fz="sm" fw={500} c="var(--app-text-secondary)" truncate>
                      {jobTitle}
                    </AppText>
                  ) : null}
                  <AppText fz="xs" c="var(--app-text-muted)" truncate mt={2}>
                    {me.email}
                  </AppText>
                </div>

                <AppGroup gap="xs" justify="center">
                  <AppBadge withDot color="teal">
                    {t("active")}
                  </AppBadge>
                  <AppBadge
                    color={me.isAdmin ? "red" : me.roles.includes("team_lead") ? "blue" : "gray"}
                  >
                    {roleLabel}
                  </AppBadge>
                </AppGroup>

                {/* Avatar Actions */}
                <AppGroup gap="xs" justify="center" mt="xs" style={{ width: "100%" }}>
                  <AppButton
                    size="xs"
                    variant="light"
                    leftSection={<UploadSimple size={14} />}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {avatarUrl ? t("changePicture") : t("uploadPicture")}
                  </AppButton>
                  {avatarUrl && (
                    <AppButton
                      size="xs"
                      variant="subtle"
                      color="red"
                      leftSection={<Trash size={14} />}
                      onClick={() => setAvatarUrl(null)}
                    >
                      {t("removePicture")}
                    </AppButton>
                  )}
                </AppGroup>

                <AppText fz="xs" c="var(--app-text-muted)" style={{ lineHeight: 1.3 }}>
                  {t("dropPictureHint")}
                </AppText>
              </AppStack>
            </AppCard>

            {/* Security & Password Card */}
            <AppCard p="lg">
              <AppStack gap="md">
                <AppGroup justify="space-between" align="center">
                  <AppGroup gap="xs">
                    <ShieldCheck size={20} color="var(--app-brand-primary)" weight="duotone" />
                    <AppHeading order={4}>{t("securitySettings")}</AppHeading>
                  </AppGroup>
                </AppGroup>
                <AppText fz="xs" c="var(--app-text-secondary)">
                  {t("resetHint")}
                </AppText>
                <AppButton
                  variant="light"
                  leftSection={<Key size={16} />}
                  onClick={() => setPwModalOpened(true)}
                  style={{ width: "100%" }}
                >
                  {t("changePassword")}
                </AppButton>
              </AppStack>
            </AppCard>

            {/* My Teams Card */}
            <AppCard p="lg">
              <AppStack gap="md">
                <AppGroup justify="space-between" align="center">
                  <AppGroup gap="xs">
                    <UsersThree size={20} color="var(--app-brand-primary)" weight="duotone" />
                    <AppHeading order={4}>{t("myTeams")}</AppHeading>
                  </AppGroup>
                  <AppBadge size="sm" variant="subtle">
                    {userTeams.length}
                  </AppBadge>
                </AppGroup>

                {userTeams.length === 0 ? (
                  <AppText fz="xs" c="var(--app-text-muted)">
                    {t("noTeams")}
                  </AppText>
                ) : (
                  <AppStack gap="xs">
                    {userTeams.map((team) => {
                      const isLead = team.members.some((m) => m.userId === me.id && m.isLead);
                      return (
                        <AppBox
                          key={team.id}
                          p="xs"
                          style={{
                            borderRadius: "var(--app-radius-sm)",
                            background: "var(--app-bg-surface)",
                            border: "1px solid var(--app-border-subtle)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <AppGroup gap="xs">
                            <span
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: "50%",
                                background: "var(--app-brand-primary)",
                                display: "inline-block",
                              }}
                            />
                            <AppText fz="sm" fw={600}>
                              {team.name}
                            </AppText>
                          </AppGroup>
                          {isLead && (
                            <AppBadge size="xs" color="blue">
                              {t("teamLeadBadge")}
                            </AppBadge>
                          )}
                        </AppBox>
                      );
                    })}
                  </AppStack>
                )}
              </AppStack>
            </AppCard>
          </AppStack>
        </AppBox>

        {/* RIGHT COLUMN: Edit Form, Employment Details & Assigned Projects */}
        <AppBox style={{ gridColumn: "span 8" }}>
          <AppStack gap="lg">
            {/* Edit Personal Information Form */}
            <AppCard p="xl">
              <AppStack gap="md">
                <AppGroup justify="space-between" align="center">
                  <AppGroup gap="xs">
                    <Briefcase size={22} color="var(--app-brand-primary)" weight="duotone" />
                    <div>
                      <AppHeading order={4}>{t("personalDetails")}</AppHeading>
                      <AppText fz="xs" c="var(--app-text-secondary)">
                        {t("sub_profile")}
                      </AppText>
                    </div>
                  </AppGroup>
                  {isDirty && (
                    <AppBadge color="yellow" variant="light">
                      Ungespeichert / Unsaved
                    </AppBadge>
                  )}
                </AppGroup>

                <AppGrid cols={{ base: 1, sm: 2 }}>
                  <AppTextInput
                    label={t("displayName")}
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.currentTarget.value)}
                  />

                  <AppTextInput
                    label={t("jobTitle")}
                    placeholder={t("jobTitlePlaceholder")}
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.currentTarget.value)}
                  />

                  <AppTextInput
                    label={t("phone")}
                    placeholder={t("phonePlaceholder")}
                    leftSection={<Phone size={16} />}
                    value={phone}
                    onChange={(e) => setPhone(e.currentTarget.value)}
                  />

                  <AppTextInput
                    label={t("email")}
                    leftSection={<EnvelopeSimple size={16} />}
                    value={me.email}
                    disabled
                    description="Konto-ID / Account ID"
                  />

                  <AppSelect
                    label={t("preferredLanguage")}
                    leftSection={<Globe size={16} />}
                    value={lang}
                    onChange={(v) => {
                      if (v === "de" || v === "en") {
                        setLang(v as Lang);
                      }
                    }}
                    data={[
                      { value: "de", label: "Deutsch (Österreich)" },
                      { value: "en", label: "English (US)" },
                    ]}
                  />
                </AppGrid>

                <AppGroup justify="flex-end" mt="md">
                  <AppButton
                    color="lucesem"
                    leftSection={<Check size={16} />}
                    loading={saving}
                    disabled={!isDirty || !displayName.trim()}
                    onClick={handleSaveProfile}
                  >
                    {t("save")}
                  </AppButton>
                </AppGroup>
              </AppStack>
            </AppCard>

            {/* Employment & Contract Overview */}
            <AppCard p="xl">
              <AppStack gap="md">
                <AppGroup gap="xs">
                  <Clock size={22} color="var(--app-brand-primary)" weight="duotone" />
                  <div>
                    <AppHeading order={4}>{t("employmentDetails")}</AppHeading>
                    <AppText fz="xs" c="var(--app-text-secondary)">
                      {t("systemRole")} & {t("weeklyHours")}
                    </AppText>
                  </div>
                </AppGroup>

                {/* Role Description Box */}
                <AppBox
                  p="md"
                  style={{
                    background: "var(--app-bg-surface)",
                    borderRadius: "var(--app-radius-md)",
                    border: "1px solid var(--app-border-subtle)",
                  }}
                >
                  <AppGroup justify="space-between" align="flex-start" mb={4}>
                    <AppGroup gap="xs">
                      <Sparkle size={18} color="var(--app-brand-primary)" />
                      <AppText fz="sm" fw={700}>
                        {t("systemRole")}: {roleLabel}
                      </AppText>
                    </AppGroup>
                    <AppBadge
                      color={me.isAdmin ? "red" : me.roles.includes("team_lead") ? "blue" : "gray"}
                    >
                      {roleLabel}
                    </AppBadge>
                  </AppGroup>
                  <AppText fz="xs" c="var(--app-text-secondary)">
                    {roleDescription}
                  </AppText>
                </AppBox>

                {/* Contract Metrics Grid */}
                <AppGrid cols={{ base: 1, sm: 2, lg: 4 }}>
                  <AppBox
                    p="sm"
                    style={{
                      background: "var(--app-bg-surface)",
                      borderRadius: "var(--app-radius-sm)",
                      border: "1px solid var(--app-border-subtle)",
                    }}
                  >
                    <AppText fz="xs" c="var(--app-text-secondary)" mb={4}>
                      {t("weeklyTargetHours")}
                    </AppText>
                    <AppMono size="lg" fw={700}>
                      {me.weeklyTargetHours} h
                    </AppMono>
                    <AppText fz="xs" c="var(--app-text-muted)" mt={2}>
                      ~ {fmtHours(hoursPerDay)} / {t("day")}
                    </AppText>
                  </AppBox>

                  <AppBox
                    p="sm"
                    style={{
                      background: "var(--app-bg-surface)",
                      borderRadius: "var(--app-radius-sm)",
                      border: "1px solid var(--app-border-subtle)",
                    }}
                  >
                    <AppText fz="xs" c="var(--app-text-secondary)" mb={4}>
                      {t("vacationEntitlement")}
                    </AppText>
                    <AppMono size="lg" fw={700}>
                      {me.vacationDaysPerYear} {t("day")}
                    </AppMono>
                    <AppText fz="xs" c="var(--app-text-muted)" mt={2}>
                      {t("year")}
                    </AppText>
                  </AppBox>

                  <AppBox
                    p="sm"
                    style={{
                      background: "var(--app-bg-surface)",
                      borderRadius: "var(--app-radius-sm)",
                      border: "1px solid var(--app-border-subtle)",
                    }}
                  >
                    <AppText fz="xs" c="var(--app-text-secondary)" mb={4}>
                      {t("timesheetApprovalRequired")}
                    </AppText>
                    <AppBadge
                      size="sm"
                      color={me.requiresTimesheetApproval ? "blue" : "gray"}
                      mt={4}
                    >
                      {me.requiresTimesheetApproval
                        ? t("approvalRequired")
                        : t("approvalNotRequired")}
                    </AppBadge>
                  </AppBox>

                  <AppBox
                    p="sm"
                    style={{
                      background: "var(--app-bg-surface)",
                      borderRadius: "var(--app-radius-sm)",
                      border: "1px solid var(--app-border-subtle)",
                    }}
                  >
                    <AppText fz="xs" c="var(--app-text-secondary)" mb={4}>
                      {t("carinthianHoliday")}
                    </AppText>
                    <AppBadge size="sm" color={me.includeCarinthia ? "teal" : "gray"} mt={4}>
                      {me.includeCarinthia ? t("included") : t("notIncluded")}
                    </AppBadge>
                  </AppBox>
                </AppGrid>

                {/* Working Days Display */}
                <div>
                  <AppText fz="xs" fw={600} mb={6} c="var(--app-text-secondary)">
                    {t("workDays")}:
                  </AppText>
                  <AppGroup gap={6}>
                    {weekOrder.map((d) => {
                      const isActive = me.workDays?.includes(d);
                      return (
                        <AppChip key={d} checked={isActive} readOnly size="sm" color="lucesem">
                          {dayLabels[d]}
                        </AppChip>
                      );
                    })}
                  </AppGroup>
                </div>
              </AppStack>
            </AppCard>

            {/* Assigned Projects Section */}
            <AppCard p="xl">
              <AppStack gap="md">
                <AppGroup justify="space-between" align="center">
                  <AppGroup gap="xs">
                    <Kanban size={22} color="var(--app-brand-primary)" weight="duotone" />
                    <div>
                      <AppHeading order={4}>{t("assignedProjects")}</AppHeading>
                      <AppText fz="xs" c="var(--app-text-secondary)">
                        {myProjects.length}{" "}
                        {lang === "de" ? "verfügbare Projekte" : "accessible projects"}
                      </AppText>
                    </div>
                  </AppGroup>
                  <AppBadge size="sm" variant="light">
                    {myProjects.length}
                  </AppBadge>
                </AppGroup>

                {myProjects.length === 0 ? (
                  <AppBox
                    p="xl"
                    style={{
                      textAlign: "center",
                      borderRadius: "var(--app-radius-md)",
                      background: "var(--app-bg-surface)",
                      border: "1px dashed var(--app-border-subtle)",
                    }}
                  >
                    <AppText fz="sm" c="var(--app-text-muted)">
                      {t("noAssignedProjects")}
                    </AppText>
                  </AppBox>
                ) : (
                  <AppStack gap="xs">
                    {myProjects.map((proj) => {
                      const budgetHours = proj.time_budget_hours
                        ? parseFloat(proj.time_budget_hours)
                        : null;
                      const used = proj.used_hours || 0;
                      const pct = budgetHours ? Math.min(100, (used / budgetHours) * 100) : 0;

                      return (
                        <AppBox
                          key={proj.id}
                          p="sm"
                          style={{
                            borderRadius: "var(--app-radius-md)",
                            background: "var(--app-bg-surface)",
                            border: "1px solid var(--app-border-subtle)",
                            display: "flex",
                            flexDirection: "column",
                            gap: 8,
                          }}
                        >
                          <AppGroup justify="space-between" align="center">
                            <AppGroup gap="xs">
                              <span
                                style={{
                                  width: 10,
                                  height: 10,
                                  borderRadius: "50%",
                                  background: "var(--app-brand-primary)",
                                  display: "inline-block",
                                  flexShrink: 0,
                                }}
                              />
                              <div>
                                <AppText fz="sm" fw={600}>
                                  {proj.name}
                                </AppText>
                                <AppText fz="xs" c="var(--app-text-secondary)">
                                  {proj.customer_name}
                                  {proj.order_number ? ` · #${proj.order_number}` : ""}
                                </AppText>
                              </div>
                            </AppGroup>

                            <AppGroup gap="xs">
                              <AppBadge
                                size="xs"
                                color={proj.approval_state === "Approved" ? "teal" : "yellow"}
                              >
                                {proj.approval_state}
                              </AppBadge>
                              <AppMono size="xs" fw={600}>
                                {fmtHours(used)}
                                {budgetHours ? ` / ${fmtHours(budgetHours)}` : ""}
                              </AppMono>
                            </AppGroup>
                          </AppGroup>

                          {budgetHours && (
                            <AppProgress
                              value={pct}
                              size="xs"
                              color={pct > 90 ? "red" : pct > 75 ? "yellow" : "teal"}
                            />
                          )}
                        </AppBox>
                      );
                    })}
                  </AppStack>
                )}
              </AppStack>
            </AppCard>
          </AppStack>
        </AppBox>
      </AppGrid>

      {/* Change Password Modal */}
      <ChangePasswordModal opened={pwModalOpened} onClose={() => setPwModalOpened(false)} />
    </AppStack>
  );
}
