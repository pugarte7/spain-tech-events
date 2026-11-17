// Communities that publish on Luma have a calendar there. The ones Community
// Builders' directory links are read whole, whatever category Luma files
// their events under. More calendars: add their slug to EXTRA.
import { record } from "./luma.mjs";
const DIRECTORY = "https://directory.communitybuilders.dev/data/communities.json";
const EXTRA = [];
const NOT_A_CALENDAR = new Set(["user", "event", "calendar", "discover", "home", "signin"]);

/** The Luma slugs the directory's active communities link. */
export function slugs(directory) {
  const list = Array.isArray(directory) ? directory : Object.values(directory).find(Array.isArray) ?? [];
  const found = new Set(EXTRA);
  for (const community of list.filter((c) => c.status === "active"))
    for (const [, slug] of JSON.stringify(community).matchAll(/(?:lu\.ma|luma\.com)\/([A-Za-z0-9_.-]+)/g))
      if (!NOT_A_CALENDAR.has(slug.toLowerCase())) found.add(slug);
  return [...found];
}

export async function crawl(http) {
  const out = [];
  for (const slug of slugs(await http.json(DIRECTORY))) {
    try {
      const { kind, data } = await http.json(`https://api.lu.ma/url?url=${encodeURIComponent(slug)}`);
      if (kind === "event") out.push(record(data, true));
      if (kind !== "calendar" || !data?.calendar?.api_id) continue;
      const items = await http.json(`https://api.lu.ma/calendar/get-items?calendar_api_id=${data.calendar.api_id}&period=future&pagination_limit=50`);
      out.push(...(items.entries ?? []).map((entry) => record({ ...entry, calendar: entry.calendar ?? data.calendar }, true)));
    } catch { /* a calendar that was renamed or removed */ }
  }
  return out.filter(Boolean).map((event) => ({ ...event, source: "luma" }));
}
