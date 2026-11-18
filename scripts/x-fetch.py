#!/usr/bin/env python3
"""Read the latest posts of the directory's X accounts into data/x-tweets.json.

The directory's communities that announce only on X have no anonymous timeline
(since the 2023 API lockdown), so the read runs under a *dedicated* X account
and a stealth browser, logged in once:

    python scripts/x-fetch.py --login   # opens a real browser: log in, then press Enter here

The login (cookies/localStorage) is saved to data/x-state.json (gitignored) and,
for the GitHub daily run, the same state is held in the X_STORAGE_STATE secret.

    python scripts/x-fetch.py            # headless read of every account

The dump this writes is read by lib/sources/x.mjs, one object per tweet:

    { "handle": "rootedcon", "id": "123…", "url": "https://x.com/rootedcon/status/123…",
      "text": "…", "posted_at": "2026-11-15T10:00:00.000Z", "links": ["…"] }
"""
import json
import os
import subprocess
import sys
import tempfile
import time
from pathlib import Path

from scrapling.fetchers import StealthySession

DIRECTORY = "https://directory.communitybuilders.dev/data/communities.json"
ROOT = Path(__file__).resolve().parent.parent
STATE = ROOT / "data" / "x-state.json"
DUMP = ROOT / "data" / "x-tweets.json"
# The accounts are the ones lib/sources/x.mjs reads: asked of it, so the two never disagree.
HANDLES_JS = ("import { handles } from './lib/sources/x.mjs';"
              f"const directory = await (await fetch('{DIRECTORY}')).json();"
              "console.log(JSON.stringify(handles(directory).map((account) => account.handle)));")


def handles():
    out = subprocess.run(["node", "--input-type=module", "-e", HANDLES_JS], cwd=ROOT, capture_output=True, text=True, timeout=60)
    if out.returncode != 0:
        raise SystemExit(f"could not list the X accounts: {out.stderr.strip()[:300]}")
    return json.loads(out.stdout)


def login():
    with StealthySession(headless=False) as session:
        session.fetch("https://x.com/i/flow/login", timeout=60000)
        input("Log in in the opened browser, then press Enter here to save the session and exit... ")
        STATE.parent.mkdir(parents=True, exist_ok=True)
        session.save_state(STATE)
        print(f"saved login to {STATE.relative_to(ROOT)}")


def load_state_path():
    secret = os.environ.get("X_STORAGE_STATE", "").strip()
    if secret:
        handle = tempfile.NamedTemporaryFile("w", suffix=".json", delete=False)
        handle.write(secret)
        handle.close()
        return Path(handle.name)
    if STATE.exists():
        return STATE
    return None


def scroll(page, *_):
    for _ in range(3):
        page.mouse.wheel(0, 2000)
        page.wait_for_timeout(350)


def tweet_of(article):
    text = " ".join(article.css('[data-testid="tweetText"]::text').getall()).strip()
    link = article.css('a[href*="/status/"]::attr(href)').get()
    posted = article.css("time::attr(datetime)").get()
    if not (text and link and posted):
        return None
    piece = link.split("/status/")[-1].split("/")[0]
    handle = link.strip("/").split("/")[0].lstrip("@")
    links = [a for a in article.css("a::attr(href)").getall() if a and a.startswith("http") and "t.co/" not in a]
    return {"handle": handle.lower(), "id": piece, "url": f"https://x.com/{handle}/status/{piece}",
            "text": text, "posted_at": posted, "links": links}


def crawl():
    accounts = handles()
    if not accounts:
        raise SystemExit("the directory lists no X accounts")
    state = load_state_path()
    if state is None:
        print("no X login state: skipping (run `x-fetch.py --login`, or set the X_STORAGE_STATE secret)")
        return

    tweets, failed = [], 0
    with StealthySession(headless=True, disable_resources=True) as session:
        session.load_state(state)
        for index, handle in enumerate(accounts, 1):
            try:
                page = session.fetch(f"https://x.com/{handle}", wait_selector="article", page_action=scroll, timeout=45000)
                tweets.extend([t for t in (tweet_of(article) for article in page.css("article")) if t][:6])
            except Exception as error:  # a suspended account, or the login expired
                failed += 1
                if failed <= 5:
                    print(f"  {handle}: {error}", file=sys.stderr)
            if index % 20 == 0:
                print(f"{index}/{len(accounts)}", file=sys.stderr)
            time.sleep(1.2)

    if str(state) != str(STATE) and state.exists():
        state.unlink()
    if accounts and failed > len(accounts) // 2:
        raise SystemExit(f"most accounts failed ({failed}); is the login still valid? run --login again")

    DUMP.parent.mkdir(parents=True, exist_ok=True)
    DUMP.write_text(json.dumps(tweets, ensure_ascii=False), encoding="utf-8")
    print(f"{len(tweets)} tweets from {len(accounts) - failed}/{len(accounts)} accounts -> {DUMP.relative_to(ROOT)}")


if __name__ == "__main__":
    (login if "--login" in sys.argv else crawl)()
