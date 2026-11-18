// The community conferences of Community Builders' directory (LechazoConf,
// BilboStack, RootedCON, DevBcn...) announce their next edition on their own
// home page and often nowhere else. Each active one's page is read for its
// date: schema.org data when it has it, else the date its text states.
//
// A date read from text is a guess held to a rule: every future date the page
// names must be the same one, or one must be named at least twice as often as
// any other. A page that names several is left out.
const DIRECTORY = "https://directory.communitybuilders.dev/data/communities.json";
// University hackathons are in no directory or listing: they announce on their
// own site. Kept by hand; one with no date published yet is read every day
// and comes in when it has one.
const HACKATHONS = [
  ["HackUDC", "https://hackudc.com/", "A Coruña"], ["HackAsturIAs", "https://hackasturias.com/", "Oviedo"], ["HackOn", "https://hackon.es/", "Móstoles"],
  ["HackUPC", "https://hackupc.com/", "Barcelona"], ["HackEPS", "https://lleidahack.dev/", "Lleida"],
  ["Datathon FME", "https://datathon.cat/", "Barcelona"], ["UAB The Hack!", "https://uabthehack.cat/", "Cerdanyola del Vallès"],
  ["BitsxLaMarató", "https://bitsxlamarato.fib.upc.edu/", "Barcelona"],
].map(([name, communityUrl, location]) => ({ name, communityUrl, location, kind: "hackathon" }));
export const MONTHS = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9,
  octubre: 10, noviembre: 11, diciembre: 12, january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8,
  september: 9, october: 10, november: 11, december: 12, gener: 1, febrer: 2, "març": 3, maig: 5, juny: 6, juliol: 7, agost: 8,
  setembre: 9, novembre: 11, desembre: 12 };
const MONTH = Object.keys(MONTHS).join("|");
const JOIN = "\\s*(?:-|–|—|a|al|y|i|and|to|&)\\s*";
// "30 de enero de 2027", "4 a 6 de Marzo 2027", "6-7 July 2027", "27 -28 OCTUBRE 2027", then "May 5–6, 2027".
const DAY_FIRST = new RegExp(`\\b(\\d{1,2})(?:${JOIN}(\\d{1,2}))?\\s*(?:de\\s+|of\\s+)?(${MONTH})(?:\\s+de|,)?\\s+(20\\d\\d)\\b`, "gi");
const MONTH_FIRST = new RegExp(`\\b(${MONTH})\\s+(\\d{1,2})(?:${JOIN}(\\d{1,2}))?,?\\s+(20\\d\\d)\\b`, "gi");
const iso = (year, month, day) => `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
const textOf = (html) => html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/\s+/g, " ");

/** The dates a page gives for its next edition, [start, end], or null. */
export function nextEdition(html, today) {
  const limit = `${Number(today.slice(0, 4)) + 2}${today.slice(4)}`;
  const ahead = (day) => day >= today && day <= limit;
  const structured = [...html.matchAll(/"startDate"\s*:\s*"(20\d\d-\d\d-\d\d)[^"]*"(?:[\s\S]{0,300}?"endDate"\s*:\s*"(20\d\d-\d\d-\d\d))?/g)]
    .map(([, start, end]) => [start, end ?? start]).filter(([start]) => ahead(start));
  if (structured.length) return structured.sort()[0];
  const text = textOf(html), found = new Map();
  const add = (year, month, first, last) => {
    const start = iso(year, MONTHS[month.toLowerCase()], first), end = iso(year, MONTHS[month.toLowerCase()], last ?? first);
    if (Number(first) <= 31 && ahead(start) && end >= start) found.set(start, { end, count: (found.get(start)?.count ?? 0) + 1 });
  };
  for (const [, first, last, month, year] of text.matchAll(DAY_FIRST)) add(year, month, first, last);
  for (const [, month, first, last, year] of text.matchAll(MONTH_FIRST)) add(year, month, first, last);
  const ranked = [...found].sort(([, a], [, b]) => b.count - a.count);
  if (!ranked.length || (ranked.length > 1 && ranked[0][1].count < 2 * ranked[1][1].count)) return null;
  return [ranked[0][0], ranked[0][1].end];
}

/** The directory's active conferences that have a site. */
export function conferences(directory) {
  const list = Array.isArray(directory) ? directory : Object.values(directory).find(Array.isArray) ?? [];
  return list.filter((c) => c.communityType === "conference" && c.status === "active" && /^https?:\/\//.test(c.communityUrl ?? ""));
}

export function record(conference, html, today) {
  const dates = nextEdition(html, today);
  if (!dates) return null;
  const name = String(conference.name).replace(/\s+/g, " ").replace(/^[/#]+/, "").trim();
  const place = String(conference.location ?? "").replace(/\s*\(.*\)\s*/g, " ").split(",")[0].trim();
  return {
    source: "conference-sites", source_id: `${conference.communityUrl}|${dates[0].slice(0, 4)}`,
    title: /20\d\d/.test(name) ? name : `${name} ${dates[0].slice(0, 4)}`, url: conference.communityUrl, start: dates[0], end: dates[1],
    city: /itinerante|n\/a|online/i.test(place) || !place ? null : place, place_text: conference.location ?? null, venue: null, online: false,
    organizer: name, description: null, keywords: [conference.topics, ...(conference.tags ?? [])].filter(Boolean).join(" "),
    free: null, registration: null, fallback_type: conference.kind ?? "conference", trusted: true,
  };
}

export async function crawl(http, now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  const list = [...conferences(await http.json(DIRECTORY)), ...HACKATHONS];
  // Each conference is its own host, so they are read side by side; one that
  // is down or gone is just not listed today.
  const pages = await Promise.all(list.map((c) => http.text(c.communityUrl).then((html) => record(c, html, today), () => null)));
  return pages.filter(Boolean);
}
