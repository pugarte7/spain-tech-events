// The order is the precedence when two sources list the same event: the place
// people register first, directories last.
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
import * as saraos from "./saraos.mjs";

export const SOURCES = { luma, meetup, exponential, saraos, eventbrite, hackbarna, mlh, devpost, hackathonhub,
  "confs.tech": confstech, "dev.events": devevents };
