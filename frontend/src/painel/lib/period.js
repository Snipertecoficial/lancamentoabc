// Period filter -> created_at range. Days are Sao Paulo calendar days; instants are UTC ISO strings.
const TZ = "America/Sao_Paulo";
const ymdFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const wallFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hourCycle: "h23",
});

export const PERIODS = [
  { value: "hoje", label: "Hoje" },
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "custom", label: "Personalizado" },
];

export function todaySP(now = new Date()) {
  return ymdFmt.format(now);
}

export function addDays(ymd, n) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

// Offset (ms) of Sao Paulo wall-clock time vs UTC at instant t, from the tz database.
function offsetAt(t) {
  const p = {};
  wallFmt.formatToParts(new Date(t)).forEach(({ type, value }) => { p[type] = Number(value); });
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - t;
}

// First instant of a Sao Paulo calendar day. Handles offset changes (historic DST), including
// days whose midnight did not exist (the day then starts at 01:00 local).
export function spMidnightIso(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  const wall = Date.UTC(y, m - 1, d);
  const off1 = offsetAt(wall);
  const t1 = wall - off1;
  const off2 = offsetAt(t1);
  if (off2 === off1) return new Date(t1).toISOString();
  const t2 = wall - off2;
  return new Date(offsetAt(t2) === off2 ? t2 : t1).toISOString();
}

const VALID_DAY = /^\d{4}-\d{2}-\d{2}$/;

export function periodRange({ period, from, to } = {}, now = new Date()) {
  const today = todaySP(now);
  let fromDay = today;
  let toDay = today;
  if (period === "7d") fromDay = addDays(today, -6);
  else if (period === "30d") fromDay = addDays(today, -29);
  else if (period === "custom") {
    const f = VALID_DAY.test(from || "") ? from : null;
    const t = VALID_DAY.test(to || "") ? to : null;
    fromDay = f || t || today;
    toDay = t || f || today;
    if (fromDay > toDay) [fromDay, toDay] = [toDay, fromDay];
  }
  return { fromDay, toDay, fromIso: spMidnightIso(fromDay), toIso: spMidnightIso(addDays(toDay, 1)) };
}
