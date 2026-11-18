// Telegram is where many Spanish tech communities announce their next meeting
// and nowhere else. A *public* channel is readable without login at its web
// preview t.me/s/<handle>, which serves the recent posts as plain HTML: each
// <div class="tgme_widget_message"> carries the post id (data-post) and its
// <time datetime>. Private channels and invite links (t.me/+…) surface nothing,
// so they are left out.
//
// A post is an event when its text names a future date and it looks like an
// event; the reading of the date and the gate are shared with x.mjs in
// ./posts.mjs. Chat about photos or an aftermovie names no future date and is
// dropped. The directory only lists tech communities, but a community also
// posts about other things, so a post still has to read as tech; and a date
// read from prose can still be wrong.
import { channel, event, eventDates } from "./posts.mjs";
const DIRECTORY = "https://directory.communitybuilders.dev/data/communities.json";
// t.me paths that are not channels.
const NOT_A_HANDLE = new Set(["share", "addstickers", "proxy", "setlanguage", "login", "addtheme", "addemoji", "socks"]);

const decode = (s) => s
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&nbsp;/g, " ").replace(/&apos;/g, "'");

/** The text of one message, one line per <br>, with its links. */
const textOf = (html) => {
  const links = [...html.matchAll(/<a[^>]*href="([^"]+)"[^>]*>/gi)].map(([, href]) => href);
  const text = decode(html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, ""))
    .split("\n").map((line) => line.replace(/[ \t]+/g, " ").trim()).filter(Boolean).join("\n");
  return { text, links };
};

/** The public Telegram channels of the directory's active communities, one per handle. */
export function channels(directory) {
  const list = Array.isArray(directory) ? directory : Object.values(directory).find(Array.isArray) ?? [];
  const byHandle = new Map();
  for (const community of list) {
    if (community.status !== "active") continue;
    for (const [, rest] of JSON.stringify(community).matchAll(/(?:t\.me|telegram\.me|tg\.me)\/([^/?#"\s\\]+)/gi)) {
      const handle = rest.toLowerCase();
      if (!/^[a-z0-9_]{3,}$/.test(handle) || NOT_A_HANDLE.has(handle) || handle.startsWith("+") || byHandle.has(handle)) continue;
      byHandle.set(handle, channel(community, handle));
    }
  }
  return [...byHandle.values()];
}

/** Each message of one channel's preview page, the newest first as served. */
export function messages(html, handle) {
  const out = [];
  for (const section of html.split("tgme_widget_message_wrap").slice(1)) {
    const post = section.match(/data-post="([^"]+)"/)?.[1] ?? null;
    const date = section.match(/<time datetime="([^"]+)"/)?.[1] ?? null;
    const body = section.match(/<div class="tgme_widget_message_text[^"]*"[^>]*dir="auto">([\s\S]*?)<\/div>/)?.[1] ?? "";
    if (!post || !date) continue;
    const { text, links } = textOf(body);
    if (text) out.push({ post, url: `https://t.me/${handle}/${post.split("/").pop()}`, date, text, links });
  }
  return out;
}

/** One message's event when it names one future date and looks like an event, else null. */
export function record(message, channel, today) {
  return event({
    source: "telegram", source_id: message.post, url: message.url, text: message.text, date: message.date, links: message.links,
    organizer: channel.name, location: channel.location, lat: channel.lat, lon: channel.lon, subject: channel.subject,
    socials: { telegram: `https://t.me/${channel.handle}` },
  }, today);
}

export async function crawl(http, now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  const list = channels(await http.json(DIRECTORY));
  const out = [];
  let gone = 0;
  for (const channel of list) {
    try {
      const html = await http.text(`https://t.me/s/${channel.handle}`);
      for (const message of messages(html, channel.handle)) {
        const event = record(message, channel, today);
        if (event) out.push(event);
      }
    } catch { gone += 1; } // a private, deleted or deactivated channel
  }
  if (list.length && gone > list.length / 2) throw new Error(`telegram: ${gone} of ${list.length} unreadable`);
  return out;
}

export { eventDates };
