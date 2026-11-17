# spain-tech-events

Upcoming tech events in Spain (meetups, hackathons, conferences, workshops, talks) in one
index, with an MCP server so an agent can search them and sign you up.

Connect your agent to `https://spaintechevents.com/mcp`. Nothing to install, no account.

    node scripts/events.mjs --out data/events.json   # crawl every source
    npm test
    node scripts/mcp-stdio.mjs                       # the MCP server over stdio, reading that file

`.github/workflows/daily.yml` crawls every morning and commits `data/events.json`. Vercel
deploys each push to `main` and serves the file at `/api/v1/events.json`, with the MCP
server at `/mcp` (`api/mcp.js`). Tools: `find_events` and `list_filters`.

Eventbrite and dev.events refuse GitHub's runners. Run the crawl from a home connection
and push to refresh them; in between, the daily run keeps their events from the last
committed index.

## Sources

One file each in `lib/sources/`, all public pages or feeds, no login.

| Source | What it reads |
|---|---|
| Luma | discover API: tech and AI categories around 10 cities, plus the Madrid and Barcelona feeds |
| Meetup | search pages for 7 cities: the technology category and three keywords, first page |
| Eventbrite | search pages (JSON-LD), two pages per search |
| Exponential Fellowship | its events page, each event resolved on Luma |
| Saraos | the events page of every community its home page links |
| HackBarna Digest | its public iCal feed: curated Barcelona events |
| Hackathon Hub | `llms-full.txt`, events in Spain |
| MLH | the season page |
| Devpost | hackathon search, kept when the location names Spain |
| confs.tech | its open data on GitHub, with calls for papers |
| dev.events | the Spain page (JSON-LD) |

To add one: a module exporting `crawl(http)` that returns records like the others', listed
in `lib/sources/index.mjs`. Feeds that are not tech-only set `trusted: false` and go through
the keyword filter in `lib/classify.mjs`.

No attendee data is stored: pages that show who is going are read for the event only.
