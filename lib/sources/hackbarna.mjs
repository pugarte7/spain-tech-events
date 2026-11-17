// HackBarna Digest's public iCal feed: curated in-person tech events in
// Barcelona. Its links are the digest's own event pages.
const FEED = "https://digest.hackbarna.com/calendar.ics";
const unescape = (s) => s.replace(/\\n/g, "\n").replace(/\\([,;\\])/g, "$1");

/** "20261116T150000" on Madrid's clock as an ISO date-time with its offset. */
export function madridIso(stamp) {
  const m = stamp?.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?/);
  if (!m) return null;
  if (!m[4]) return `${m[1]}-${m[2]}-${m[3]}`;
  const local = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`;
  const zone = new Intl.DateTimeFormat("en", { timeZone: "Europe/Madrid", timeZoneName: "longOffset" })
    .formatToParts(new Date(`${local}Z`)).find((p) => p.type === "timeZoneName").value;
  return local + (zone.match(/[+-]\d{2}:\d{2}/)?.[0] ?? "+00:00");
}

export function parse(ics) {
  const unfolded = ics.replace(/\r?\n[ \t]/g, "");
  return unfolded.split("BEGIN:VEVENT").slice(1).flatMap((block) => {
    const field = (name) => block.match(new RegExp(`^${name}(?:;[^:\\n]*)?:(.*)$`, "m"))?.[1]?.trim() ?? null;
    const url = field("URL")?.split("?")[0], start = madridIso(field("DTSTART"));
    if (!url || !start || field("STATUS") === "CANCELLED") return [];
    const description = unescape(field("DESCRIPTION") ?? "").replace(/^Organiser:.*\n+/, "").replace(/\s*https?:\/\/digest\.hackbarna\.com\S*\s*$/, "");
    return [{
      source: "hackbarna", source_id: field("UID") ?? url, title: unescape(field("SUMMARY") ?? ""), url, start,
      end: madridIso(field("DTEND")), city: "Barcelona", venue: unescape(field("LOCATION") ?? "").split(",")[0] || null,
      address: unescape(field("LOCATION") ?? "") || null, online: false,
      organizer: unescape(block.match(/^ORGANIZER;CN=([^:\n]*):/m)?.[1]?.trim() ?? "") || null,
      description, free: null, registration: null, trusted: true,
    }];
  });
}

export async function crawl(http, now = new Date()) {
  const day = (date) => date.toISOString().slice(0, 10);
  return parse(await http.text(`${FEED}?lang=es&from=${day(now)}&to=${day(new Date(now.getTime() + 365 * 86_400_000))}`));
}
