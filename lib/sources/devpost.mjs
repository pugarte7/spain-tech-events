// Devpost's hackathon search. It has no country filter, so a hackathon counts
// when its location names Spain or a Spanish city.
import { mentionsSpain } from "../classify.mjs";
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const SEARCHES = ["spain", "españa", "madrid", "barcelona", "valencia"];

/** "Nov 21, 2026", "Sep 06 - 07, 2019", "Nov 01 - Dec 26, 2026", "Dec 20, 2026 - Jan 05, 2027". */
export function dates(text) {
  const parts = String(text ?? "").split(" - ").map((p) => p.match(/^(?:([A-Za-z]{3}) )?(\d{1,2})(?:, (\d{4}))?$/));
  if (!parts.length || parts.length > 2 || parts.some((p) => !p)) return [null, null];
  const last = parts.at(-1), first = parts[0];
  const iso = (p) => {
    const month = MONTHS.indexOf((p[1] ?? first[1] ?? "").toLowerCase()), year = p[3] ?? last[3];
    return month < 0 || !year ? null : `${year}-${String(month + 1).padStart(2, "0")}-${p[2].padStart(2, "0")}`;
  };
  return [iso(first), iso(last)];
}

export function parse(payload) {
  return (payload.hackathons ?? []).filter((h) => h.open_state !== "ended" && mentionsSpain(h.displayed_location?.location)).map((h) => {
    const [start, end] = dates(h.submission_period_dates);
    return {
      source: "devpost", source_id: String(h.id), title: h.title, url: h.url, start, end,
      city: null, place_text: h.displayed_location.location, venue: h.displayed_location.location, online: false,
      organizer: h.organization_name ?? null, description: (h.themes ?? []).map((t) => t.name).join(", ") || null,
      free: true, registration: h.invite_only ? "invite_only" : "open", attendees: h.registrations_count || null,
      fallback_type: "hackathon", trusted: true,
    };
  });
}

export async function crawl(http) {
  const out = [];
  for (const search of SEARCHES)
    out.push(...parse(await http.json(`https://devpost.com/api/hackathons?search=${encodeURIComponent(search)}&status[]=upcoming&status[]=open`)));
  return out;
}
