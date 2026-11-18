// data/events.json: upcoming tech events in Spain, from every source in
// lib/sources. Run daily; the MCP server (api/mcp.js) searches the file, which
// Vercel serves at /api/v1/events.json.
//
//     node scripts/events.mjs --out data/events.json   # crawl everything, as the daily workflow does
//     node scripts/events.mjs --only luma,mlh          # some sources, into _site/
//
// What is stored of an event is what a person needs to decide and sign up:
// what it is (type, topics, keywords read from its text as api/_classify.js
// reads a job posting), when, where, what it costs, how many people, and the
// link to register. Descriptions are cut short; nothing about any attendee.
//
// A source that fails never fails the run: its events still upcoming in the
// previous index (the --out file, or EVENTS_PREVIOUS_URL) are carried over
// and the source is reported as stale. A source that answers does not always
// list everything it has (Meetup's search returns a different sample each
// time), so an event it gave within the last GRACE_DAYS stays too. first_seen is the day an event first
// entered the index, carried from the previous one. No event at all exits 1.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { client } from "../lib/http.mjs";
import { REGIONS, dayOf, isTech, keywordsOf, knownScale, norm, regionIn, regionOf, sizeOf, topicsOf, typeOf } from "../lib/classify.mjs";
import { communityIndex, communityOf } from "../lib/socials.mjs";
import { SOURCES } from "../lib/sources/index.mjs";

export const VERSION = 2;
/** Days an upcoming event stays after its source last listed it. */
const GRACE_DAYS = 3;
const DESCRIPTION_MAX = 400;
const plain = (s) => String(s ?? "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const clip = (s) => {
  const text = plain(s);
  return !text ? null : text.length > DESCRIPTION_MAX ? `${text.slice(0, DESCRIPTION_MAX - 1)}…` : text;
};
const number = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** A source's record as the index stores it, or null when it is not a tech event. */
export function normalize(raw) {
  if (!raw.title || !raw.start || !raw.url) return null;
  const description = plain(raw.description);
  const text = `${raw.title} ${raw.organizer ?? ""} ${description} ${raw.keywords ?? ""}`;
  // Only a hand-curated list of tech events is trusted whole. Anywhere else,
  // a tech community's own calendar included (it also carries its dinners and
  // its causes), the title or organiser has to say tech, or the description
  // touch two topics: one stray "startup" in a blurb is not enough.
  if (!raw.trusted && !(isTech(`${raw.title} ${raw.organizer ?? ""}`) || (isTech(text) && topicsOf(text).length >= 2))) return null;
  const region = regionOf(raw.city, raw.region_hint) ?? regionIn(raw.place_text) ?? regionIn(raw.address);
  const attendees = number(raw.attendees), capacity = number(raw.capacity);
  const people = Math.max(attendees ?? 0, capacity ?? 0) || null;
  const price = number(raw.price_min);
  return {
    id: createHash("sha1").update(`${raw.source}:${raw.source_id}`).digest("hex").slice(0, 10),
    title: plain(raw.title), type: typeOf(raw.title, raw.fallback_type ?? "event"),
    topics: topicsOf(text), keywords: keywordsOf(raw.title, `${description} ${raw.keywords ?? ""}`),
    date: dayOf(raw.start), start: raw.start, end: raw.end ?? null,
    city: raw.city ?? null, region, region_name: REGIONS[region] ?? null,
    venue: raw.venue ?? null, address: raw.address ?? null, lat: number(raw.lat), lon: number(raw.lon),
    online: Boolean(raw.online), organizer: raw.organizer ?? null, description: clip(description),
    free: raw.free ?? (price ? false : null), price_min: price, currency: price ? raw.currency ?? "EUR" : null,
    // How many people: who has signed up so far and the room's limit, as the
    // source gives them; size is their order of magnitude, or a past edition's.
    attendees, capacity, size: sizeOf(people) ?? knownScale(raw.title), size_basis: people ? "source" : knownScale(raw.title) ? "past editions" : null,
    registration: raw.registration ?? null, approval: raw.approval ?? null, spots_left: number(raw.spots_left),
    account_required: raw.account ?? null,
    cfp_url: raw.cfp_url ?? null, cfp_end: raw.cfp_end ?? null,
    url: raw.url, register_url: raw.register_url ?? raw.url, via: null, last_seen: null,
    // Where to follow the organiser: the community's accounts, by network.
    community: null, socials: raw.socials && Object.keys(raw.socials).length ? raw.socials : null,
    source: raw.source, also: [], first_seen: null,
  };
}

/** One key for the spellings of a link: lu.ma and luma.com, www, a query, a slash. */
export const linkKey = (url) => (!url ? null : url.replace(/^https?:\/\/(www\.)?/, "").replace(/^lu\.ma\//, "luma.com/").replace(/[?#].*$/, "").replace(/\/$/, "").toLowerCase());

// "E-Show" and "X-Ops" are one word each, or "E-Show Madrid" reads as "Show Madrid".
const titleWords = (title) => new Set(norm(title).replace(/\b20\d\d\b/g, "").replace(/\b([a-z])-(?=[a-z])/g, "$1")
  .split(/[^a-z0-9]+/).filter((w) => w.length > 2));
/** Two titles naming one event: "HackEPS" and "HackEPS 2026", or the same words reordered. */
function sameTitle(a, b) {
  const [x, y] = [titleWords(a.title), titleWords(b.title)];
  const shared = [...x].filter((w) => y.has(w)).length;
  if (shared > 0 && shared / (x.size + y.size - shared) >= 0.6) return true;
  // A directory names a conference in two words ("Devfest Lleida"); the
  // organiser's own page adds a tagline. Between two organisers' pages the
  // longer title is another event, a talk at that conference.
  // The words two titles share that say which event it is: not the city, not "meetup".
  const place = new Set([...titleWords(a.city ?? ""), ...titleWords(b.city ?? "")]);
  const telling = [...x].filter((w) => y.has(w) && !place.has(w) && !COMMON.has(w));
  // A directory names a conference in two words ("Devfest Lleida") or spells it
  // its own way ("CDTM VLC Hacks"); the organiser's page adds a tagline. Between
  // two organisers' pages the longer title is another event, a talk at that conference.
  const directory = DIRECTORIES.has(a.source) || DIRECTORIES.has(b.source);
  if (directory && ((shared >= 2 && shared === Math.min(x.size, y.size)) || telling.length >= 2)) return true;
  // Starting the same minute in the same city, two titles that share a telling
  // word are one event listed twice, often once translated.
  const timed = a.start.includes("T") && b.start.includes("T") && Date.parse(a.start) === Date.parse(b.start);
  if (timed && a.city && b.city && shared >= 2 && telling.length >= 1) return true;
  // A post announces an event in its own words, and two channels announce the
  // same one differently: in one city on one day, one telling word in common
  // is enough. A post wrongly folded into an event costs only the post.
  if (!(POSTS.has(a.source) || POSTS.has(b.source)) || !a.city || !b.city) return false;
  return telling.some((w) => w.length >= 5);
}
const POSTS = new Set(["telegram", "x"]);
const COMMON = new Set(["meetup", "charla", "charlas", "taller", "talleres", "evento", "eventos", "workshop", "conference", "conferencia",
  "community", "comunidad", "proximo", "proxima", "noviembre", "diciembre", "enero", "febrero", "marzo", "abril", "junio", "julio",
  "agosto", "septiembre", "octubre", "jueves", "viernes", "sabado", "domingo", "lunes", "martes", "miercoles", "edicion", "online",
  "hackathon", "hackaton", "summit", "congreso", "congress", "jornadas", "conf", "day", "days", "tech", "europe", "spain", "espana",
  "global", "world", "international", "open", "edition", "networking", "session", "sesion", "the", "and", "con", "para", "for", "with",
  "del", "los", "las", "una", "how", "como"]);
/** One organiser, one starting minute: the same event under a translated title. */
const sameSlot = (a, b) => a.organizer && norm(a.organizer) === norm(b.organizer) && a.start.includes("T") && b.start.includes("T")
  && Date.parse(a.start) === Date.parse(b.start);
const DIRECTORIES = new Set(["developers.events", "confs.tech", "dev.events", "eventos.wiki", "hackathonhub", "mlh", "wordcamp", "conference-sites"]);

// What the first record of an event takes from a later one even when it has its
// own: the live figures of the place people sign up beat a directory's guess.
const FILL = ["description", "organizer", "venue", "address", "lat", "lon", "end", "free", "price_min", "currency", "attendees",
  "capacity", "registration", "approval", "spots_left", "account_required", "cfp_url", "cfp_end", "city", "region", "region_name"];

/** One record per event: same link or sign-up link, or the same day and city under one title.
 * The first seen wins (callers pass sources in precedence order) and takes
 * what it lacks from the others, whose links it keeps in `also`. */
export function dedupe(events) {
  const byUrl = new Map(), byDay = new Map(), out = [];
  for (const event of events) {
    const day = byDay.get(event.date) ?? byDay.set(event.date, []).get(event.date);
    const links = [event.url, event.register_url].map(linkKey).filter(Boolean);
    const first = links.map((k) => byUrl.get(k)).find(Boolean) ?? day.find((e) => (!e.city || !event.city || norm(e.city) === norm(event.city))
      && e.online === event.online && (sameTitle(e, event) || sameSlot(e, event)));
    if (!first) {
      out.push(event);
      day.push(event);
      links.forEach((k) => byUrl.set(k, event));
      continue;
    }
    links.forEach((k) => byUrl.has(k) || byUrl.set(k, first));
    if (![first.url, first.register_url, ...first.also].map(linkKey).includes(linkKey(event.url))) first.also.push(event.url);
    // A directory's page is not where one signs up: a later source's own link is.
    if (first.register_url === first.url && event.register_url && linkKey(event.register_url) !== linkKey(first.url)
        && first.source !== "luma" && first.source !== "meetup") first.register_url = event.register_url;
    for (const field of FILL) if (first[field] == null && event[field] != null) first[field] = event[field];
    for (const field of ["topics", "keywords"]) first[field] = [...new Set([...first[field], ...event[field]])];
    if (event.socials) first.socials = { ...event.socials, ...first.socials };
    if (first.type === "event" && event.type !== "event") first.type = event.type;
    const people = Math.max(first.attendees ?? 0, first.capacity ?? 0) || null;
    if (people) [first.size, first.size_basis] = [sizeOf(people), "source"];
    else if (!first.size && event.size) [first.size, first.size_basis] = [event.size, event.size_basis];
  }
  return out;
}

export const upcoming = (event, today) => dayOf(event.end ?? event.start) >= today;

async function previousIndex(out) {
  try {
    if (process.env.EVENTS_PREVIOUS_URL) return await (await fetch(process.env.EVENTS_PREVIOUS_URL)).json();
    if (existsSync(out)) return JSON.parse(readFileSync(out, "utf8"));
  } catch { /* no previous index: nothing to carry over */ }
  return null;
}

const DIRECTORY = "https://directory.communitybuilders.dev/data/communities.json";

/** `directory` is Community Builders' list, for each event's community and its accounts; read when not given. */
export async function build({ only = null, http = client(), now = new Date(), previous = null, sources = SOURCES, directory } = {}) {
  const today = dayOf(now.toISOString());
  const names = Object.keys(sources).filter((name) => !only || only.includes(name));
  const report = {};
  const results = await Promise.all(names.map(async (name) => {
    try {
      const raw = await sources[name].crawl(http, now);
      // `via` is the crawler that read it, which is not always its `source`
      // (a Meetup group's page and the Meetup search both give "meetup").
      const events = raw.map(normalize).filter((e) => e && upcoming(e, today)).map((e) => ({ ...e, via: name, last_seen: today }));
      const got = new Set(events.map((e) => e.id));
      const since = new Date(now.getTime() - GRACE_DAYS * 86_400_000).toISOString().slice(0, 10);
      const kept = (previous?.events ?? []).filter((e) => (e.via ?? e.source) === name && !got.has(e.id) && upcoming(e, today)
        && e.last_seen && e.last_seen >= since);
      report[name] = { read: raw.length, events: events.length, ...(kept.length ? { kept: kept.length } : {}) };
      return [...events, ...kept];
    } catch (error) {
      const stale = (previous?.events ?? []).filter((e) => (e.via ?? e.source) === name && upcoming(e, today));
      report[name] = { read: 0, events: stale.length, error: String(error.message ?? error), stale: true };
      return stale;
    }
  }));
  const seen = new Map((previous?.events ?? []).flatMap((e) => [[e.id, e.first_seen], [linkKey(e.url), e.first_seen]]));
  const events = dedupe(results.flat()).sort((a, b) => a.date.localeCompare(b.date) || Date.parse(a.start) - Date.parse(b.start));
  for (const event of events) event.first_seen = seen.get(event.id) ?? seen.get(linkKey(event.url)) ?? event.first_seen ?? today;
  // The accounts of each event's community. Without the directory the events
  // keep what their own source gave.
  let communities = new Map();
  try { communities = communityIndex(directory ?? await http.json(DIRECTORY)); } catch { /* the directory is down */ }
  for (const event of events) {
    const community = communityOf(event, communities);
    if (!community) continue;
    event.community = community.name;
    event.socials = { ...community.socials, ...event.socials };
  }
  return { version: VERSION, generated_at: now.toISOString(), count: events.length, sources: report, events };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = (flag) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : null);
  const out = arg("--out") ?? "_site/api/v1/events.json";
  const index = await build({ only: arg("--only")?.split(","), previous: await previousIndex(out) });
  console.table(index.sources);
  if (!index.count) {
    console.error("No events read: nothing written.");
    process.exit(1);
  }
  mkdirSync(dirname(out), { recursive: true });
  // One event per line: the daily commit's diff is the events that changed.
  writeFileSync(out, JSON.stringify(index).replace(/\{"id":/g, '\n{"id":') + "\n");
  console.log(`${index.count} events -> ${out}`);
}
