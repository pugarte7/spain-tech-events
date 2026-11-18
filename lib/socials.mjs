// Where to follow whoever organises an event: the community's own accounts,
// never a person's. Two places know them. The source itself (a Luma calendar's
// handles, the channel a post came from), and Community Builders' directory,
// which lists every account of 600+ Spanish tech communities: an event is
// matched to its community by the organiser's name or by a link they share
// (the Meetup group, the Luma calendar, the conference's site).

// Network by host. A link to anything else is the community's website.
const NETWORKS = [
  ["x", /^(twitter|x)\.com$/], ["linkedin", /(^|\.)linkedin\.com$/], ["instagram", /^instagram\.com$/],
  ["youtube", /^(youtube\.com|youtu\.be)$/], ["telegram", /^(t|telegram|tg)\.me$/], ["github", /^github\.com$/],
  ["bluesky", /^bsky\.app$/], ["mastodon", /^(mastodon\.[a-z]+|fosstodon\.org|infosec\.exchange|hachyderm\.io|mas\.to|floss\.social)$/],
  ["discord", /^discord\.(gg|com)$/], ["twitch", /^twitch\.tv$/], ["tiktok", /^tiktok\.com$/], ["facebook", /^facebook\.com$/],
  ["meetup", /^meetup\.com$/], ["luma", /^(lu\.ma|luma\.com)$/], ["whatsapp", /^chat\.whatsapp\.com$/],
];
// Not an account to follow: link hubs, archives, encyclopedias, ticketing.
const SKIP = /^(linktr\.ee|web\.archive\.org|[a-z]+\.wikipedia\.org|eventbrite\.[a-z.]+|docs\.google\.com|forms\.gle|bit\.ly|goo\.gl|maps\.app\.goo\.gl|groups\.google\.com|eventos\.wiki|saraos\.tech)$/;
// A person's profile, not a community's.
const PERSONAL = /linkedin\.com\/in\//i;
export const NETWORK_NAMES = [...NETWORKS.map(([name]) => name), "website"];

const hostOf = (url) => { try { return new URL(url).host.toLowerCase().replace(/^www\./, "").replace(/^[a-z]{2}\.linkedin/, "linkedin"); } catch { return null; } };
/** The network a link belongs to, "website" for a site of its own, null for one not worth keeping. */
export function networkOf(url) {
  const host = hostOf(url);
  if (!host || SKIP.test(host) || PERSONAL.test(url)) return null;
  return NETWORKS.find(([, re]) => re.test(host))?.[0] ?? "website";
}

/** Links as { network: url }, the first of each network kept. */
export function socialsOf(urls) {
  const out = {};
  for (const url of urls) {
    const network = typeof url === "string" && /^https?:\/\//.test(url) ? networkOf(url) : null;
    if (network && !out[network]) out[network] = url.replace(/[?#].*$/, "");
  }
  return Object.keys(out).length ? out : null;
}

/** A Luma calendar's own accounts; a personal calendar is a person, so none. */
export function lumaSocials(calendar) {
  if (!calendar || calendar.is_personal || calendar.personal_user_api_id) return null;
  const handle = (base, value) => (value ? `${base}${String(value).replace(/^[@/]+/, "")}` : null);
  return socialsOf([
    calendar.website, handle("https://x.com/", calendar.twitter_handle), handle("https://www.instagram.com/", calendar.instagram_handle),
    calendar.linkedin_handle ? `https://www.linkedin.com/${String(calendar.linkedin_handle).replace(/^\/+/, "")}` : null,
    handle("https://www.youtube.com/@", calendar.youtube_handle), handle("https://www.tiktok.com/@", calendar.tiktok_handle),
    calendar.slug ? `https://luma.com/${calendar.slug}` : null,
  ].filter(Boolean));
}

const squash = (s) => String(s ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
/** What identifies a community in a link: "meetup:madrid-jug", "luma:claudecommunity", "site:lechazoconf.com". */
export function linkKeys(url) {
  const host = hostOf(url);
  if (!host) return [];
  const parts = (() => { try { return new URL(url).pathname.split("/").filter(Boolean); } catch { return []; } })();
  const first = parts.find((p) => !/^[a-z]{2}(-[a-z]{2})?$/i.test(p))?.toLowerCase();
  const network = NETWORKS.find(([, re]) => re.test(host))?.[0];
  if (network === "meetup" || network === "luma" || network === "telegram" || network === "x") return first ? [`${network}:${first}`] : [];
  if (/(^|\.)(gdg\.community\.dev|community\.cncf\.io|meetups\.mulesoft\.com)$/.test(host)) return first && first !== "events" ? [`bevy:${first}`] : [];
  return network || SKIP.test(host) ? [] : [`site:${host}`];
}

/** The directory as a lookup from a community's name or link to its accounts. */
export function communityIndex(directory) {
  const list = Array.isArray(directory) ? directory : Object.values(directory ?? {}).find(Array.isArray) ?? [];
  const index = new Map();
  // A host several communities give as their site is a platform they share, not anyone's own.
  const sites = new Map();
  for (const community of list) for (const key of linkKeys(community.communityUrl ?? "")) sites.set(key, (sites.get(key) ?? 0) + 1);
  // A community's name and its own address say whose event it is before a link
  // it merely lists does: HackBarna links the Meetup of AI Engineers Barcelona,
  // which is a community of its own. So own keys first, listed accounts after.
  const listed = [];
  for (const community of list) {
    if (community.status !== "active" || !community.name) continue;
    const { thumbnailUrl, ...rest } = community;
    const urls = [community.communityUrl, ...(JSON.stringify(rest).match(/https?:\/\/[^"\\\s]+/g) ?? [])].filter(Boolean);
    const socials = socialsOf(urls);
    if (!socials) continue;
    const entry = { name: String(community.name).replace(/\s+/g, " ").replace(/^[/#]+/, "").trim(), socials };
    const name = squash(entry.name);
    // A two-letter name is not a name to match on.
    const own = linkKeys(community.communityUrl ?? "").filter((key) => !key.startsWith("site:") || sites.get(key) === 1);
    const accounts = urls.flatMap(linkKeys).filter((key) => !key.startsWith("site:"));
    for (const key of [name.length >= 5 ? `name:${name}` : null, ...own].filter(Boolean))
      if (!index.has(key)) index.set(key, entry);
    listed.push([accounts, entry]);
  }
  for (const [accounts, entry] of listed) for (const key of accounts) if (!index.has(key)) index.set(key, entry);
  return index;
}

/** The community an event belongs to, by a link it shares or its organiser's name. */
export function communityOf(event, index) {
  const named = index.get(`name:${squash(event.organizer)}`);
  if (named) return named;
  for (const url of [event.url, event.register_url, ...(event.also ?? [])])
    for (const key of linkKeys(url ?? "")) if (index.has(key)) return index.get(key);
  return null;
}
