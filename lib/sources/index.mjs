// The order is the precedence when two sources list the same event: the place
// people register first, directories last. Sarao leads because its licence
// asks for its page to be the event's first link; it carries the sign-up link too.
import * as luma from "./luma.mjs";
import * as meetup from "./meetup.mjs";
import * as eventbrite from "./eventbrite.mjs";
import * as mlh from "./mlh.mjs";
import * as devpost from "./devpost.mjs";
import * as confstech from "./confstech.mjs";
import * as devevents from "./devevents.mjs";
import * as exponential from "./exponential.mjs";
import * as hackathonhub from "./hackathonhub.mjs";
import * as hackbarna from "./hackbarna.mjs";
import * as sarao from "./sarao.mjs";
import * as saraos from "./saraos.mjs";
import { feed } from "./ote.mjs";

export const SOURCES = {
  sarao, luma, meetup, exponential, saraos, eventbrite,
  "eventos.wiki": feed("eventos.wiki", "https://eventos.wiki/events.json"),
  hackbarna,
  communitybuilders: feed("communitybuilders", "https://communitybuilders.dev/events/feed.json"),
  mlh, devpost, hackathonhub, "confs.tech": confstech, "dev.events": devevents,
};
