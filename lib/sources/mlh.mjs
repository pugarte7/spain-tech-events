// Major League Hacking's season page embeds its events as JSON.
function find(node, key) {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node[key])) return node[key];
  for (const value of Object.values(node)) {
    const found = find(value, key);
    if (found) return found;
  }
  return null;
}

export function parse(html) {
  const match = html.match(/<script data-page="app" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) throw new Error("mlh: no embedded page data");
  return (find(JSON.parse(match[1]), "upcomingEvents") ?? [])
    .filter((e) => e.venueAddress?.country === "ES" || /\bSpain$/.test(e.location ?? ""))
    .map((e) => ({
      source: "mlh", source_id: e.id, title: e.name, url: e.websiteUrl || `https://www.mlh.com${e.url}`,
      start: e.startsAt, end: e.endsAt ?? null, city: e.venueAddress?.city?.trim() ?? null, venue: null,
      online: e.formatType === "digital", organizer: e.organizationName ?? null, description: null,
      free: true, registration: null, fallback_type: "hackathon", trusted: true,
    }));
}
// A season is named for the year it ends in and starts in July.
export const season = (now) => now.getUTCFullYear() + (now.getUTCMonth() >= 6 ? 1 : 0);
export const crawl = async (http, now = new Date()) => parse(await http.text(`https://www.mlh.com/seasons/${season(now)}/events`));
