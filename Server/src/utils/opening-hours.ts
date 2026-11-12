import type { OpeningHours, WeekDay } from "../types/restaurant.types";

const DAY_KEYS: WeekDay[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

const toMinutes = (time: string): number => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

// Weekday and minutes-since-midnight of `date` as seen in the branch's timezone.
function zonedParts(date: Date, timeZone: string): { weekday: WeekDay; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";

  return {
    weekday: get("weekday").toLowerCase().slice(0, 3) as WeekDay,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

// True when the branch is open at `date`. Handles hours that run past midnight
// (e.g. Friday 18:00–02:00 covers early Saturday). Branches without saved hours are treated as open.
export function isOpenAt(hours: unknown, timeZone: string, date: Date): boolean {
  if (!hours || typeof hours !== "object") return true;

  const schedule = hours as OpeningHours;
  const { weekday, minutes } = zonedParts(date, timeZone);

  const today = schedule[weekday];
  if (today && !today.closed) {
    const open = toMinutes(today.open);
    const close = toMinutes(today.close);
    if (close > open ? minutes >= open && minutes < close : minutes >= open) return true;
  }

  const previous = schedule[DAY_KEYS[(DAY_KEYS.indexOf(weekday) + 6) % 7]];
  if (previous && !previous.closed) {
    const open = toMinutes(previous.open);
    const close = toMinutes(previous.close);
    if (close < open && minutes < close) return true;
  }

  return false;
}
