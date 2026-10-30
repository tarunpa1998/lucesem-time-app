import { notifications } from "@mantine/notifications";
import { addMyNotification } from "@/backend/org.functions";

const TEXT = {
  de: {
    success: "Erfolgreich",
    error: "Fehler",
    saved: "Erfolgreich gespeichert",
    entrySaved: "Arbeitszeit erfolgreich gespeichert",
    entryUpdated: "Arbeitszeit erfolgreich geändert",
    passwordChanged: "Passwort erfolgreich geändert",
    portalSaved: "Kundenportal erfolgreich gespeichert",
    lockAdded: "Zeitraum erfolgreich gesperrt",
    userSaved: "Benutzer erfolgreich gespeichert",
    vacationSet: "Urlaubstage für alle erfolgreich gesetzt",
    entriesApproved: "Arbeitszeiten genehmigt",
    entriesRejected: "Arbeitszeiten abgelehnt",
    unlockApproved: "Freischaltung genehmigt",
    unlockRejected: "Freischaltung abgelehnt",
    activitySaved: "Tätigkeit erfolgreich gespeichert",
    absenceApproved: "Abwesenheit genehmigt",
    absenceRejected: "Abwesenheit abgelehnt",
    teamSaved: "Team erfolgreich gespeichert",
    projectSaved: "Projekt erfolgreich gespeichert",
    customerSaved: "Kunde erfolgreich gespeichert",
    entryDeleted: "Arbeitszeit gelöscht",
  },
  en: {
    success: "Success",
    error: "Error",
    saved: "Saved successfully",
    entrySaved: "Working time saved successfully",
    entryUpdated: "Working time updated successfully",
    passwordChanged: "Password changed successfully",
    portalSaved: "Customer portal saved successfully",
    lockAdded: "Period locked successfully",
    userSaved: "User saved successfully",
    vacationSet: "Vacation days set for everyone",
    entriesApproved: "Working times approved",
    entriesRejected: "Working times rejected",
    unlockApproved: "Unlock request approved",
    unlockRejected: "Unlock request rejected",
    activitySaved: "Activity saved successfully",
    absenceApproved: "Absence approved",
    absenceRejected: "Absence rejected",
    teamSaved: "Team saved successfully",
    projectSaved: "Project saved successfully",
    customerSaved: "Customer saved successfully",
    entryDeleted: "Working time deleted",
  },
};
type Key = keyof (typeof TEXT)["de"];
const lang = () =>
  (typeof localStorage !== "undefined" && localStorage.getItem("lucesem-lang") === "en"
    ? "en"
    : "de") as keyof typeof TEXT;

export const NOTIFIED_EVENT = "app:notified";

/**
 * Pop-up with a DE/EN "Success"/"Error" title. Red = error, anything else = success.
 * Messages starting with "@" are looked up in the DE/EN dictionary above.
 * Each pop-up is also stored so it appears under the notification bell.
 */
function show(o: { color?: string; message: string; title?: string }) {
  const tx = TEXT[lang()];
  const kind = o.color === "red" ? "error" : "success";
  let message = o.message;
  if (!message || message === "✓") message = tx.saved;
  else if (message.startsWith("@")) message = tx[message.slice(1) as Key] ?? tx.saved;
  notifications.show({
    color: kind === "error" ? "red" : (o.color ?? "lucesem"),
    title: o.title ?? tx[kind],
    message,
  });
  addMyNotification({ data: { kind, message } })
    .then(() => window.dispatchEvent(new Event(NOTIFIED_EVENT)))
    .catch(() => {});
}

export const notify = {
  show,
  success: (message = "✓") => show({ message }),
  error: (message: string) => show({ color: "red", message }),
};
