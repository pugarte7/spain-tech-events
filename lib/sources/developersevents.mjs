// developers.events (github.com/scraly/developers-conferences-agenda): a
// community-kept list of developer conferences worldwide, with calls for
// papers. Where the Spanish community conferences are, big and small.
const FEED = "https://developers.events/all-events.json";
const day = (ms) => (typeof ms === "number" ? new Date(ms).toISOString().slice(0, 10) : null);

export function parse(events) {
  return events.filter((e) => e.country === "Spain" && e.name && e.hyperlink && e.date?.length && e.status !== "canceled").map((e) => ({
    source: "developers.events", source_id: `${e.name}|${e.date[0]}`, title: e.name, url: e.hyperlink,
    start: day(e.date[0]), end: day(e.date.at(-1)), city: /online/i.test(e.city ?? "") ? null : e.city ?? null,
    venue: null, online: /online/i.test(e.location ?? ""), organizer: null, description: null,
    keywords: (e.tags ?? []).map((t) => t.value).join(" "), free: null, registration: null,
    cfp_url: e.cfp?.link ?? null, cfp_end: day(e.cfp?.untilDate) ?? null, fallback_type: "conference", trusted: true,
  }));
}
export const crawl = async (http) => parse(await http.json(FEED));
