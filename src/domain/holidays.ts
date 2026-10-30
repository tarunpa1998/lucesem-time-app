/** Austrian public holidays (13 national) + optional Carinthian 10 Oct. Dates as YYYY-MM-DD. */
export interface Holiday {
  date: string;
  de: string;
  en: string;
  regional?: boolean;
}

const pad = (n: number) => String(n).padStart(2, "0");
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Anonymous Gregorian algorithm (Meeus/Jones/Butcher). */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

export function austrianHolidays(year: number, includeCarinthia = false): Holiday[] {
  const e = easterSunday(year);
  const f = (m: number, d: number) => `${year}-${pad(m)}-${pad(d)}`;
  const list: Holiday[] = [
    { date: f(1, 1), de: "Neujahr", en: "New Year's Day" },
    { date: f(1, 6), de: "Heilige Drei Könige", en: "Epiphany" },
    { date: ymd(addDays(e, 1)), de: "Ostermontag", en: "Easter Monday" },
    { date: f(5, 1), de: "Staatsfeiertag", en: "Labour Day" },
    { date: ymd(addDays(e, 39)), de: "Christi Himmelfahrt", en: "Ascension Day" },
    { date: ymd(addDays(e, 50)), de: "Pfingstmontag", en: "Whit Monday" },
    { date: ymd(addDays(e, 60)), de: "Fronleichnam", en: "Corpus Christi" },
    { date: f(8, 15), de: "Mariä Himmelfahrt", en: "Assumption Day" },
    { date: f(10, 26), de: "Nationalfeiertag", en: "National Day" },
    { date: f(11, 1), de: "Allerheiligen", en: "All Saints' Day" },
    { date: f(12, 8), de: "Mariä Empfängnis", en: "Immaculate Conception" },
    { date: f(12, 25), de: "Christtag", en: "Christmas Day" },
    { date: f(12, 26), de: "Stefanitag", en: "St. Stephen's Day" },
  ];
  if (includeCarinthia)
    list.push({
      date: f(10, 10),
      de: "Tag der Volksabstimmung",
      en: "Carinthian Plebiscite Day",
      regional: true,
    });
  return list.sort((a, b) => a.date.localeCompare(b.date));
}
