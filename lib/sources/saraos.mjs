// Saraos hosts Spanish tech communities. It has no directory, so the
// communities are the ones its home page links, and each one's events page
// lists its events. Attendee names and avatars in the page are never read.
const SITE = "https://saraos.tech";
const text = (html) => html.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();

export const communities = (home) => [...new Set([...home.matchAll(/href="\/@([a-z0-9-]+)"/g)].map(([, slug]) => slug))];

export function parse(html, slug) {
  const name = text(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? slug);
  const place = text(html.match(/lucide-map-pin[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? "") || null;
  const item = /<a class="[^"]*" href="(\/@[^"]+\/events\/[^"]+)">[\s\S]*?<time dateTime="([^"]+)">[\s\S]*?<\/time><\/p><p[^>]*>([\s\S]*?)<\/p>/g;
  return [...html.matchAll(item)].map(([, path, start, title]) => ({
    source: "saraos", source_id: path, title: text(title), url: SITE + path, start, end: null,
    city: place, region_hint: place, venue: null, online: false, organizer: name, description: null,
    free: null, registration: null, fallback_type: "meetup", trusted: true,
  }));
}

export async function crawl(http) {
  const out = [];
  for (const slug of communities(await http.text(SITE)))
    out.push(...parse(await http.text(`${SITE}/%40${slug}/events`), slug));
  return out;
}
