# spain-tech-events

Every tech event in Spain in one index, from KubeCon to a user group's monthly meetup,
with an MCP server so an agent can search them and sign you up.

Connect your agent to `https://spaintechevents.com/mcp`. Nothing to install, no account.

    node scripts/events.mjs --out data/events.json   # crawl every source
    npm test
    node scripts/mcp-stdio.mjs                       # the MCP server over stdio, reading that file

`.github/workflows/daily.yml` crawls every morning and commits `data/events.json`. Vercel
deploys each push to `main` and serves the file at `/api/v1/events.json`, with the MCP
server at `/mcp` (`api/mcp.js`).

## What an event holds

What it is (type, topics, and keywords read from its text), when (dates in Spain), where
(city, region, venue, address, coordinates), what it costs (free, or the lowest price),
how many people (signed up so far, capacity, and a size from small to massive), the
registration state at crawl time, where it comes from and the link to sign up. Nothing
about any attendee: pages that show who is going are read for the event only.

## Tools

| Tool | What it does |
|---|---|
| `find_events` | Search by text, type, topic, place, dates, price, size, online, new since a day |
| `event_registration` | One event's sign-up, read live: for Luma, the form's questions and who answers each |
| `report_registration` | How a sign-up went, with nothing about the person |
| `registration_guide` | The procedure and the notes an agent keeps for the person |
| `list_filters` | Valid types, topics, regions and sizes, with counts |

The agent signs the person up with its own browser, after they say yes. The server stores
nothing about them.

## Sources

One file each in `lib/sources/`, all public pages or feeds, no login. The order in
`lib/sources/index.mjs` is the precedence when two list the same event.

| Source | What it reads |
|---|---|
| Sarao | open JSON feed of in-person AI meetups (CC BY 4.0) |
| Luma | discover API: tech and AI categories around 10 cities, plus the Madrid and Barcelona feeds |
| Luma calendars | the whole calendar of each community the directory links on Luma |
| Meetup | search pages for 7 cities: the technology category and three keywords, first page |
| Meetup groups | the events page of every active community in Community Builders' directory (CC0) |
| Bevy | Google Developer Groups, CNCF, Atlassian, Salesforce, MuleSoft and other vendor community sites |
| Exponential Fellowship | its events page, each event resolved on Luma |
| Saraos | the events page of every community its home page links |
| Eventbrite | search pages (JSON-LD), two pages per search |
| eventos.wiki | OpenTechEvents feed (CC BY 4.0) |
| HackBarna Digest | its public iCal feed: curated Barcelona events |
| Community Builders | OpenTechEvents feed of its own online meetups (CC0) |
| MLH | the season page |
| Devpost | hackathon search, kept when the location names Spain |
| Hackathon Hub | `llms-full.txt`, events in Spain |
| WordCamp Central | its public API: WordCamps in Spain, with expected attendance |
| Conference sites | the home page of each active conference in Community Builders' directory, read for its next date |
| developers.events | its open list of developer conferences, with calls for papers |
| confs.tech | its open data on GitHub, with calls for papers |
| dev.events | the Spain page (JSON-LD) |

To add one: a module exporting `crawl(http)` that returns records like the others', listed
in `lib/sources/index.mjs`. Feeds that are not tech-only set `trusted: false` and go through
the keyword filter in `api/_events.js`.

Sarao and eventos.wiki publish under CC BY 4.0: each event keeps its `source` and links their
page, and the MCP tells agents to name the source.

dev.events refuses GitHub's runners, and Eventbrite sometimes does. Run the crawl from a
home connection and push to refresh them; in between, the daily run keeps their events from
the last committed index.

## Shared with spanish-top-tech-companies

`api/_classify.js` (place names and the keyword vocabulary) and `api/_track.js` (PostHog
events) are copied from that repository; change them there first. The protocol handling,
the analytics and the sign-up procedure in `api/mcp.js` follow its server.

Analytics go to PostHog only in production and only when `POSTHOG_PROJECT_TOKEN` is set on
Vercel: MCP handshakes, tool lists and tool calls, with filters and event ids, no IP, no
cookie and no person profile.
