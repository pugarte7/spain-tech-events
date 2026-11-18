// X (Twitter) is where many Spanish tech communities announce their next
// meeting and nowhere else. The anonymous timeline has been closed since 2023,
// so the latest posts are read once a day by scripts/x-fetch.py (Scrapling)
// under a dedicated account and written to data/x-tweets.json:
//
//   [ { "handle": "rootedcon", "id": "123…", "url": "https://x.com/rootedcon/status/123…",
//       "text": "…", "posted_at": "2026-11-15T10:00:00.000Z", "links": ["https://lu.ma/x"] }, … ]
//
// This source turns each post into an event with the same prose-date reading as
// telegram.mjs (shared in ./posts.mjs): a future date read from the text, the
// year taken from the post's own when it is not stated. The directory only lists
// tech communities, but an account also posts about other things, so a post
// still has to read as tech; and a date read from prose can still be wrong.
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { channel, event } from "./posts.mjs";
const DIRECTORY = "https://directory.communitybuilders.dev/data/communities.json";
const DUMP = fileURLToPath(new URL("../../data/x-tweets.json", import.meta.url));
// x.com path segments that are not an account.
const NOT_A_HANDLE = new Set(["i", "home", "search", "hashtag", "explore", "intent", "settings", "messages", "notifications",
  "login", "signup", "share", "status", "tos", "privacy", "help", "about", "account", "safety", "download", "company",
  "community", "bookmarks", "lists", "topics", "compose", "verified", "jobs"]);

// Accounts the directory does not list, written as it would list them.
const EXTRA = [
  { status: "active", name: "Atlantin", location: "n/a", urls: [{ url: "https://x.com/atlantin_comn" }] },
];

/** The X accounts of the directory's active communities and of `extra`, one per handle. */
export function handles(directory, extra = EXTRA) {
  const list = [...(Array.isArray(directory) ? directory : Object.values(directory).find(Array.isArray) ?? []), ...extra];
  const byHandle = new Map();
  for (const community of list) {
    if (community.status !== "active") continue;
    for (const [, rest] of JSON.stringify(community).matchAll(/(?<![a-z0-9])(?:twitter\.com|x\.com)\/([^/?#"\s\\]+)/gi)) {
      const handle = rest.toLowerCase();
      if (!/^[a-z0-9_]{2,15}$/.test(handle) || NOT_A_HANDLE.has(handle) || byHandle.has(handle)) continue;
      byHandle.set(handle, channel(community, handle));
    }
  }
  return [...byHandle.values()];
}

/** One tweet as its event, when it names one future date and looks like one, else null. */
export function record(tweet, account, today) {
  return event({
    source: "x", source_id: String(tweet.id ?? tweet.url), url: tweet.url, text: tweet.text, date: tweet.posted_at,
    links: tweet.links ?? [], organizer: account.name, location: account.location, lat: account.lat, lon: account.lon, subject: account.subject,
    socials: { x: `https://x.com/${account.handle}` },
  }, today);
}

/** The events of one dump, each tweet matched to its directory account. */
export function eventsFrom(dump, directory, today) {
  const byHandle = new Map(handles(directory).map((account) => [account.handle, account]));
  const tweets = Array.isArray(dump) ? dump : (dump?.tweets ?? []);
  const out = [];
  for (const tweet of tweets) {
    const account = byHandle.get(String(tweet.handle ?? "").toLowerCase());
    const ev = account && tweet.text && tweet.posted_at && record(tweet, account, today);
    if (ev) out.push(ev);
  }
  return out;
}

export async function crawl(http, now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  // No dump: X was not read today. Where a read was expected (the daily run sets
  // X_EXPECTED once it has the login) that is a failure, and the crawl keeps
  // X's last known events; anywhere else the source is just not set up.
  if (!existsSync(DUMP)) {
    if (process.env.X_EXPECTED === "1") throw new Error("x: not read today, no data/x-tweets.json");
    return [];
  }
  const dump = JSON.parse(readFileSync(DUMP, "utf8"));
  return eventsFrom(dump, await http.json(DIRECTORY), today);
}
