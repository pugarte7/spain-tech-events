// OpenTechEvents feeds (opentechevents.org): one JSON format several Spanish
// community sites publish. Times are local to each event's `timezone`.
import { localIso } from "../classify.mjs";

export function parse(feed, source) {
  return (feed.events ?? []).filter((e) => e.name && e.startDate && e.status !== "cancelled").map((e) => {
    const address = e.location?.address ?? {}, zone = e.timezone ?? "Europe/Madrid";
    const page = e.url ?? e.id, original = e.source?.url ?? null;
    return {
      source, source_id: e.id ?? page, title: e.name, url: page, register_url: original !== page ? original : null,
      start: localIso(e.startDate, zone), end: localIso(e.endDate, zone),
      city: address.city ?? address.locality ?? null, region_hint: address.region ?? null, place_text: address.street ?? null,
      venue: e.attendanceMode === "online" ? null : e.location?.venue ?? null, online: e.attendanceMode === "online",
      organizer: e.organizers?.[0]?.name ?? feed.organizers?.[0]?.name ?? null, description: e.description ?? null,
      keywords: (e.tags ?? []).join(" "), free: null, registration: null,
      cfp_url: e.cfp?.url ?? null, cfp_end: (e.cfp?.endDate ?? e.cfp?.deadline ?? null)?.slice(0, 10) ?? null, trusted: true,
    };
  });
}
/** A source module for one feed. */
export const feed = (source, url) => ({ crawl: async (http) => parse(await http.json(url), source) });
