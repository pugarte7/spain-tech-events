// WordCamp Central's public API: every scheduled WordCamp and WordPress
// community event, with the attendance its organisers expect.
const API = "https://central.wordcamp.org/wp-json/wp/v2/wordcamps?per_page=100&status=wcpt-scheduled";
const day = (seconds) => (Number(seconds) ? new Date(Number(seconds) * 1000).toISOString().slice(0, 10) : null);

export function parse(camps) {
  return camps.filter((c) => /\bSpain\b|España/.test(c.Location ?? "") && c["Start Date (YYYY-mm-dd)"]).map((c) => ({
    source: "wordcamp", source_id: String(c.id), title: c.title?.rendered ?? "", url: c.URL || c.link,
    start: day(c["Start Date (YYYY-mm-dd)"]), end: day(c["End Date (YYYY-mm-dd)"]) ?? day(c["Start Date (YYYY-mm-dd)"]),
    city: String(c.Location).split(",")[0].trim(), venue: null, online: false, organizer: "WordPress community",
    description: null, keywords: "WordPress PHP", capacity: Number(c["Number of Anticipated Attendees"]) || null,
    free: null, registration: null, fallback_type: "conference", trusted: true,
  }));
}
export const crawl = async (http) => parse(await http.json(API));
