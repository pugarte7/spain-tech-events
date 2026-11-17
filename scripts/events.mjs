// /api/v1/events.json: upcoming tech events in Spain, from every source in
// lib/sources. Run daily; the MCP server (api/mcp.js) searches the file.
//
//     node scripts/events.mjs --out data/events.json   # crawl everything, as the daily workflow does
//     node scripts/events.mjs --only luma,mlh          # some sources, into _site/
//
// A source that fails never fails the run: its events still upcoming in the
// previous index (the --out file, or EVENTS_PREVIOUS_URL) are carried over
// and the source is reported as stale. No event at all exits 1.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { client } from "../lib/http.mjs";
import { REGIONS, dayOf, isTech, norm, regionIn, regionOf, topicsOf, typeOf } from "../lib/classify.mjs";
import { SOURCES } from "../lib/sources/index.mjs";

export const VERSION = 1;
const DESCRIPTION_MAX = 300;
const clip = (s) => {
  const text = String(s ?? "").replace(/\s+/g, " ").trim();
  return !text ? null : text.length > DESCRIPTION_MAX ? `${text.slice(0, DESCRIPTION_MAX - 1)}…` : text;
};

/** A source's record as the index stores it, or null when it is not a tech event. */
export function normalize(raw) {
  if (!raw.title || !raw.start || !raw.url) return null;
  const text = `${raw.title} ${raw.organizer ?? ""} ${raw.description ?? ""}`;
  // An unfiltered feed's event is tech when its title or organiser says so, or
  // its description touches two topics: one stray "startup" in a blurb is not enough.
  if (!raw.trusted && !(isTech(`${raw.title} ${raw.organizer ?? ""}`) || (isTech(text) && topicsOf(text).length >= 2))) return null;
  const region = regionOf(raw.city, raw.region_hint) ?? regionIn(raw.place_text);
  return {
    id: createHash("sha1").update(`${raw.source}:${raw.source_id}`).digest("hex").slice(0, 10),
    title: raw.title.trim(), type: typeOf(raw.title, raw.fallback_type ?? "event"), topics: topicsOf(text),
    date: dayOf(raw.start), start: raw.start, end: raw.end ?? null,
    city: raw.city ?? null, region, region_name: REGIONS[region] ?? null, venue: raw.venue ?? null,
    online: Boolean(raw.online), organizer: raw.organizer ?? null, description: clip(raw.description),
    free: raw.free ?? null, registration: raw.registration ?? null, approval: raw.approval ?? null,
    spots_left: raw.spots_left ?? null, attendees: raw.attendees ?? null,
    cfp_url: raw.cfp_url ?? null, cfp_end: raw.cfp_end ?? null,
    url: raw.url, source: raw.source, also: [],
  };
}

const titleWords = (title) => new Set(norm(title).replace(/\b20\d\d\b/g, "").split(/[^a-z0-9]+/).filter((w) => w.length > 2));
/** Two titles naming one event: "HackEPS" and "HackEPS 2026", or the same words reordered. */
function sameTitle(a, b) {
  const [x, y] = [titleWords(a), titleWords(b)];
  const shared = [...x].filter((w) => y.has(w)).length;
  return shared > 0 && shared / (x.size + y.size - shared) >= 0.6;
}

/** One record per event: same link, or the same day and city under one title.
 * The first seen wins (callers pass sources in precedence order) and takes
 * what it lacks from the others, whose links it keeps in `also`. */
export function dedupe(events) {
  const byUrl = new Map(), byDay = new Map(), out = [];
  for (const event of events) {
    const day = byDay.get(event.date) ?? byDay.set(event.date, []).get(event.date);
    const first = byUrl.get(event.url) ?? day.find((e) => (!e.city || !event.city || norm(e.city) === norm(event.city))
      && e.online === event.online && sameTitle(e.title, event.title));
    if (!first) {
      out.push(event);
      day.push(event);
      byUrl.set(event.url, event);
      continue;
    }
    if (event.url !== first.url && !first.also.includes(event.url)) first.also.push(event.url);
    for (const [field, value] of Object.entries(event))
      if (first[field] == null && value != null) first[field] = value;
    if (!first.topics.length) first.topics = event.topics;
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

export async function build({ only = null, http = client(), now = new Date(), previous = null } = {}) {
  const today = dayOf(now.toISOString());
  const names = Object.keys(SOURCES).filter((name) => !only || only.includes(name));
  const report = {};
  const results = await Promise.all(names.map(async (name) => {
    try {
      const raw = await SOURCES[name].crawl(http, now);
      const events = raw.map(normalize).filter((e) => e && upcoming(e, today));
      report[name] = { read: raw.length, events: events.length };
      return events;
    } catch (error) {
      const stale = (previous?.events ?? []).filter((e) => e.source === name && upcoming(e, today));
      report[name] = { read: 0, events: stale.length, error: String(error.message ?? error), stale: true };
      return stale;
    }
  }));
  const events = dedupe(results.flat()).sort((a, b) => a.date.localeCompare(b.date) || Date.parse(a.start) - Date.parse(b.start));
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
