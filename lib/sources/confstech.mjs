// confs.tech's open data (github.com/tech-conferences/conference-data, MIT):
// one file per topic and year, each conference with its call for papers.
import { socialsOf } from "../socials.mjs";
const RAW = "https://raw.githubusercontent.com/tech-conferences/conference-data/main/conferences";
const LIST = "https://api.github.com/repos/tech-conferences/conference-data/contents/conferences";

export function parse(conferences) {
  return conferences.filter((c) => c.country === "Spain").map((c) => ({
    source: "confs.tech", source_id: `${c.name}|${c.startDate}`, title: c.name, url: c.url,
    start: c.startDate, end: c.endDate ?? null, city: c.city ?? null, venue: null, online: Boolean(c.online),
    organizer: null, description: null, free: null, registration: null,
    cfp_url: c.cfpUrl ?? null, cfp_end: c.cfpEndDate ?? null,
    socials: socialsOf([c.twitter && `https://x.com/${String(c.twitter).replace(/^@/, "")}`, c.bluesky && `https://bsky.app/profile/${c.bluesky}`].filter(Boolean)),
    fallback_type: "conference", trusted: true,
  }));
}

export async function crawl(http, now = new Date()) {
  const out = [];
  for (const year of [now.getUTCFullYear(), now.getUTCFullYear() + 1]) {
    // A year nobody has opened yet is a 404, not a failure. Anything else is:
    // GitHub's API refuses shared addresses without a token (60 calls an hour).
    const auth = process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {};
    const files = await http.json(`${LIST}/${year}`, auth).catch((error) => {
      if (error.status === 404) return [];
      throw error;
    });
    for (const file of files)
      if (file.name?.endsWith(".json")) out.push(...parse(await http.json(`${RAW}/${year}/${file.name}`)));
  }
  return out;
}
