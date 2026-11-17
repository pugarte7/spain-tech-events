// Community Builders' directory lists 600+ Spanish tech communities (CC0). Each
// active one with a Meetup group has that group's events page read: the long
// tail the city searches miss, from user groups to the Meetup of a conference.
import { parse as meetupEvents } from "./meetup.mjs";
const DIRECTORY = "https://directory.communitybuilders.dev/data/communities.json";
const NOT_A_GROUP = new Set(["pro", "topics", "find", "cities", "es", "es-es", "en", "en-us", "home", "members", "apps"]);

/** The Meetup group names of the directory's active communities. */
export function groups(directory) {
  const list = Array.isArray(directory) ? directory : Object.values(directory).find(Array.isArray) ?? [];
  const names = new Set();
  for (const community of list) {
    if (community.status !== "active") continue;
    // Its links are kept in more than one shape: every Meetup address anywhere in the entry.
    for (const [, rest] of JSON.stringify(community).matchAll(/meetup\.com\/([^"?#\s\\]+)/gi)) {
      const name = rest.split("/").filter(Boolean).find((part) => !/^[a-z]{2}(-[a-z]{2})?$/i.test(part));
      if (name && !NOT_A_GROUP.has(name.toLowerCase())) names.add(name.toLowerCase());
    }
  }
  return [...names];
}

export async function crawl(http) {
  const names = groups(await http.json(DIRECTORY));
  const out = [];
  let gone = 0;
  for (const name of names) {
    try {
      // The directory also lists Spanish-speaking communities abroad: Spain only.
      out.push(...meetupEvents(await http.text(`https://www.meetup.com/${name}/events/`), { trusted: true })
        .filter((e) => e.country === "es"));
    } catch { gone += 1; } // a group that closed or went private
  }
  if (names.length && gone > names.length / 2) throw new Error(`meetup groups: ${gone} of ${names.length} unreadable`);
  return out;
}
