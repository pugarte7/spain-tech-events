// The reading of an announcement post turned into an event, shared by the
// Telegram and X sources. A post is an event when its text names a future date;
// the day and month are almost always given but the year usually is not, so it
// is read from the post's own date — the same meeting is next year when the
// named month has already passed. A post is kept when it also looks like an
// event (meetup, charla, inscripción, plazas… or a link to a registration
// platform), a call for papers is dropped, and a post that names two separate
// events (a bilingual multi-city announcement, a season's schedule) is left out
// rather than guessed.
import { norm, typeOf } from "../classify.mjs";
import { MONTHS } from "./confsites.mjs";

// What a sign-up link looks like, so the record keeps the place people register
// rather than the post itself.
export const SIGNUP = /(^|\.)(lu\.ma|luma\.com|meetup\.com|eventbrite\.(com|es|co\.uk|com\.ar)|tito\.io|universe\.com|entradium\.com|eventix\.io|pretix\.eu|sessionize\.com|ticketea\.com|feverup\.com)$/i;
export const EVENTISH = /\b(meetup|charla|taller|workshop|conferencia|conferencias|congreso|evento|hackathon|hackat[oó]n|registro|inscri[bc]i[oó]n(?:es)?|inscr[ií]bete|entradas|plazas|quedada|reuni[oó]n(?:es)?|agenda|ag[eé]ndalo|ap[uú]ntate|streaming|en vivo|os esperamos|te esperamos|nos vemos|join us|see you|register|registration|tickets)\b/i;
export const CFP = /\b(cfp|call for (papers|talks|proposals|speakers))\b/i;
// A line that only says what language follows, not a title.
export const LABEL = /^(español|english(?: below)?|catal[àa]|castellano|galego|euskera|français|francais|es|en|ca|below|over)$/i;

const MONTH = Object.keys(MONTHS).join("|");
const DAY_SEP = "(?:\\s*[-–—,]\\s*|\\s+(?:y|i|e|a|al|and|to)\\s+)";
// A day-first date: "12 de noviembre", "5 al 7 de marzo de 2027", "19–20–21 de
// noviembre de 2026", "1, 2 y 3 de marzo". The year is optional.
const ES_DATE = new RegExp(`\\b(\\d{1,2}(?:${DAY_SEP}\\d{1,2}){0,2})\\s*de\\s+(${MONTH})\\b(?:\\s+(?:de\\s+)?(20\\d{2}))?`, "gi");
// A month-first date: "May 5–6, 2027", "November 19–20–21, 2026". Year required.
const EN_DATE = new RegExp(`\\b(${MONTH})\\s+(\\d{1,2}(?:${DAY_SEP}\\d{1,2}){0,2}),?\\s+(20\\d{2})\\b`, "gi");
const iso = (year, month, day) => `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

/** The one event a post names: a single future date or an adjacent span, else null. */
export function eventDates(text, postDate, today) {
  const post = postDate.slice(0, 10), postYear = Number(post.slice(0, 4));
  const limit = `${Number(today.slice(0, 4)) + 2}${today.slice(4)}`;
  const found = new Map(); // start -> last day
  const add = (year, month, first, last) => {
    const names = MONTHS[month.toLowerCase()];
    const start = iso(year, names, first), end = iso(year, names, last);
    if (start >= today && start <= limit && (!found.has(start) || end > found.get(start))) found.set(start, end);
  };
  const days = (s) => [...s.matchAll(/\d{1,2}/g)].map((m) => Number(m[0]));
  for (const [, list, month, year] of text.matchAll(ES_DATE)) {
    const nums = days(list ?? "");
    if (!nums.length) continue;
    const y = year ?? (iso(postYear, MONTHS[month.toLowerCase()], nums[0]) < post ? postYear + 1 : postYear);
    add(y, month, nums[0], nums[nums.length - 1]);
  }
  for (const [, month, list, year] of text.matchAll(EN_DATE)) {
    const nums = days(list ?? "");
    if (nums.length) add(Number(year), month, nums[0], nums[nums.length - 1]);
  }
  if (!found.size) return null;
  const spans = [...found].map(([start, end]) => [start, end === start ? null : end]).sort((a, b) => a[0].localeCompare(b[0]));
  let [start, end] = spans[0];
  for (const [s, e] of spans.slice(1)) {
    if (s > new Date(Date.parse(end ?? start) + 86400000).toISOString().slice(0, 10)) return null; // a second, separate event
    if (e && (!end || e > end)) end = e;
  }
  return [start, end ?? null];
}

const URL_IN_TEXT = /https?:\/\/[^\s"'<>()]+/gi;
/** A registration link, from the post's links or any URL written in its text. */
export function signupUrl(text, links) {
  const candidates = [...(links ?? []), ...(text.match(URL_IN_TEXT) ?? [])];
  return candidates.find((href) => { try { return SIGNUP.test(new URL(href).hostname.replace(/^www\./, "")); } catch { return false; } }) ?? null;
}

/** The first line of a post worth using as a title, else null. */
export function titleOf(text) {
  return text.split("\n").map((line) => line.trim()).find((line) => line.length > 3 && !CFP.test(line) && !LABEL.test(line))
    ?.replace(/^[^\p{L}\p{N}]+/u, "").slice(0,90) ?? null;
}

/** One directory community as its channel, its name and place cleaned. `subject`
 * is what the directory says it is about: a post rarely says ("ya tenemos fecha"). */
export function channel(community, handle) {
  return {
    handle,
    name: String(community.name ?? handle).replace(/\s+/g, " ").replace(/^[/#]+/, "").trim(),
    location: community.location ?? null, lat: community.latLon?.lat ?? null, lon: community.latLon?.lon ?? null,
    subject: [...(community.tags ?? []), community.topics ?? ""].join(" ").replace(/-/g, " ").trim() || null,
  };
}

/** One announcing post as its event, when it names one future date and looks like one. */
export function event({ source, source_id, url, text, date, links, organizer, location, lat, lon, subject = null, socials = null }, today) {
  const dates = eventDates(text, date, today);
  if (!dates) return null;
  const signup = signupUrl(text, links);
  if (CFP.test(text) && !signup) return null;
  if (!signup && !EVENTISH.test(text)) return null;
  // A post's first line is written for people who already follow the channel
  // ("Madrid, ya tenemos fechas!"): it only says what the event is beside who says it.
  const squash = (t) => norm(t).replace(/[^a-z0-9]/g, "");
  const line = titleOf(text);
  const title = !line ? `${organizer} ${dates[0].slice(0, 4)}` : squash(line).includes(squash(organizer)) ? line : `${organizer}: ${line}`;
  const place = String(location ?? "").replace(/\s*\(.*\)\s*/g, " ").split(",")[0].trim();
  return {
    source, source_id, title, url, register_url: signup,
    start: dates[0], end: dates[1],
    city: /itinerante|n\/a|online/i.test(place) || !place ? null : place, place_text: location ?? null,
    lat: lat ?? null, lon: lon ?? null, online: false,
    organizer, description: text, keywords: subject,
    free: null, registration: null, socials, fallback_type: typeOf(text, "meetup"), trusted: false,
  };
}
