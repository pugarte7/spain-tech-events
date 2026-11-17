// dev.events' Spain page: developer conferences, as schema.org JSON-LD.
import { jsonLd } from "../http.mjs";

export function parse(html) {
  return jsonLd(html).filter((d) => /Event$/.test(d["@type"] ?? "") && d.location?.address).map((d) => ({
    source: "dev.events", source_id: d.url, title: d.name, url: d.url, start: d.startDate?.slice(0, 10),
    end: d.endDate?.slice(0, 10) ?? null, city: d.location.address.addressLocality ?? null,
    venue: null, online: false, organizer: d.organizer?.name ?? null, description: d.description ?? null,
    free: null, registration: null, fallback_type: "conference", trusted: true,
  }));
}
// Conferences and meetups are two pages.
export const crawl = async (http) => [...parse(await http.text("https://dev.events/EU/ES")),
  ...parse(await http.text("https://dev.events/meetups/EU/ES"))];
