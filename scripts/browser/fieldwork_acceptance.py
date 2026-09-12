#!/usr/bin/env python3
"""Actual Next page/actions, fictional loopback auth/persistence. NOT Supabase/RLS validation.

No external target or credentials are accepted. This harness refuses local env files,
serves synthetic records only, and writes only screenshots plus a bounded test receipt.
"""
from __future__ import annotations
import base64
import copy
import datetime as dt
import json
import os
from pathlib import Path
import re
import shutil
import socket
import subprocess
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse
import uuid

from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "test-results" / "fieldwork-browser"
OWNER = "10000000-0000-4000-8000-000000000001"
ACTIVE = "30000000-0000-4000-8000-000000000001"
TEMPLATE = "30000000-0000-4000-8000-000000000002"
USER = {"id": OWNER, "aud": "authenticated", "role": "authenticated", "email": "synthetic@example.invalid",
        "created_at": "2020-01-01T00:00:00Z", "app_metadata": {"provider": "email"}, "user_metadata": {}}

def encoded(value):
    return base64.urlsafe_b64encode(json.dumps(value).encode()).decode().rstrip("=")

def stamp():
    return dt.datetime.now(dt.timezone.utc).isoformat()

def entry(i):
    return {"id": f"20000000-0000-4000-8000-{i:012d}", "user_id": OWNER, "entry_type": "idea",
            "title": f"Synthetic journal {i}", "content": "Fictional personal research reflection.",
            "created_at": (dt.datetime(2020, 1, 1, tzinfo=dt.timezone.utc) + dt.timedelta(days=i)).isoformat(),
            "updated_at": "2020-01-01T00:00:00Z", "location": None, "corridor": None, "tags": [],
            "contact_ids": [], "linked_case_id": None, "attachments": [], "is_pinned": False,
            "consent_status": "not_required", "consent_method": None,
            "consent_jurisdiction": None, "consent_captured_at": None}

def protocol(id_, title, status):
    return {"id": id_, "user_id": OWNER, "created_at": "2020-01-01T00:00:00Z", "updated_at": "2020-01-01T00:00:00Z",
            "title": title, "description": "Synthetic checklist, not a study approval.", "status": status,
            "template_id": None, "location": None, "corridor": None, "linked_journal_id": None, "linked_contact_ids": [],
            "sections": [{"title": "Synthetic section", "items": [{"id": "test-item", "label": "Synthetic checkpoint", "checked": False, "notes": "Existing note survives."}]}]}

class Backend:
    def __init__(self):
        rows = [entry(i) for i in range(1, 73)]
        rows[0].update(title="OLDER_UNIQUE_RECORD", is_pinned=True, tags=["older-tag"])
        self.tables = {"journal_entries": rows, "contacts": [], "protocols": [
            protocol(ACTIVE, "Synthetic active checklist", "in_progress"), protocol(TEMPLATE, "Synthetic template", "template")]}
        self.lock = threading.Lock()
        self.fail_journal_reads = False
        self.fail_next_insert = False
        self.fail_protocol_save = False
        self.allowed = True
        self.writes = []

STATE = Backend()

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass  # Never log bodies, credentials or query text.

    def reply(self, status, value, count=None):
        payload = json.dumps(value).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS")
        self.send_header("Access-Control-Expose-Headers", "Content-Range")
        if count is not None:
            self.send_header("Content-Range", f"0-{max(0, len(value)-1)}/{count}")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_OPTIONS(self):
        self.reply(200, {})

    def dispatch(self):
        parsed = urlparse(self.path)
        if parsed.path == "/auth/v1/user":
            return self.reply(200, USER)
        if parsed.path == "/rest/v1/rpc/is_allowed_user":
            return self.reply(200, STATE.allowed)
        if not parsed.path.startswith("/rest/v1/"):
            return self.reply(404, {"message": "Synthetic backend endpoint not supported"})
        table = parsed.path.rsplit("/", 1)[-1]
        query = parse_qs(parsed.query)
        with STATE.lock:
            if table not in STATE.tables:
                return self.reply(200, [], 0) if self.command == "GET" else self.reply(403, {"message": "Write outside synthetic fieldwork tables"})
            if self.command == "GET" and table == "journal_entries" and STATE.fail_journal_reads:
                return self.reply(503, {"message": "Synthetic read unavailable"})
            rows = STATE.tables[table]
            selected = rows
            for k, vals in query.items():
                v = vals[0]
                if v.startswith("eq."):
                    target = v[3:]
                    selected = [r for r in selected if str(r.get(k)).lower() == target.lower()]
                if k == "tags" and v.startswith("cs."):
                    tags = v[3:].strip("{}").replace('"', '').split(',')
                    selected = [r for r in selected if all(t in r.get("tags", []) for t in tags)]
            if "or" in query:
                terms = re.findall(r'\.ilike\."?%(.*?)%"?(?:,|\))', query["or"][0])
                term = terms[0] if terms else ""
                selected = [r for r in selected if any(term.lower() in str(r.get(k, "")).lower() for k in ["title", "content", "location"])]
            if self.command == "GET":
                count = len(selected)
                selected = sorted(selected, key=lambda r: (r.get("created_at", r.get("updated_at", "")), r["id"]), reverse=True)
                offset = int(query.get("offset", ["0"])[0]); limit = int(query.get("limit", ["1000"])[0])
                selected = selected[offset:offset + limit]
                if "application/vnd.pgrst.object+json" in self.headers.get("Accept", ""):
                    return self.reply(200, selected[0]) if len(selected) == 1 else self.reply(406, {"code": "PGRST116", "details": "The result contains 0 rows", "message": "No rows"})
                return self.reply(200, selected, count)
            length = int(self.headers.get("Content-Length", "0"))
            if length > 1024 * 1024:
                return self.reply(413, {"message": "Synthetic input too large"})
            body = json.loads(self.rfile.read(length))
            if isinstance(body, list):
                if len(body) != 1: return self.reply(400, {"message": "One synthetic insert expected"})
                body = body[0]
            if self.command == "POST":
                if table == "journal_entries" and STATE.fail_next_insert:
                    STATE.fail_next_insert = False
                    return self.reply(503, {"message": "Synthetic insert rejected before commit"})
                new = copy.deepcopy(body)
                new.setdefault("id", str(uuid.uuid4()))
                if any(r["id"] == new["id"] for r in rows):
                    return self.reply(409, {"code": "23505", "message": "Synthetic primary key conflict"})
                new.setdefault("created_at", stamp()); new.setdefault("updated_at", stamp())
                rows.append(new); STATE.writes.append(["insert", table, new["id"]])
                obj = "application/vnd.pgrst.object+json" in self.headers.get("Accept", "")
                return self.reply(201, new if obj else [new])
            if self.command == "PATCH":
                if table == "protocols" and STATE.fail_protocol_save:
                    return self.reply(503, {"message": "Synthetic checklist save failure"})
                if len(selected) != 1:
                    return self.reply(400, {"message": "One owned synthetic row expected"})
                selected[0].update(copy.deepcopy(body)); STATE.writes.append(["update", table, selected[0]["id"]])
                obj = "application/vnd.pgrst.object+json" in self.headers.get("Accept", "")
                return self.reply(200, selected[0] if obj else selected)
            return self.reply(405, {"message": "Method not allowed"})

    do_GET = dispatch
    do_POST = dispatch
    do_PATCH = dispatch


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0)); return s.getsockname()[1]


def main():
    # A real session/environment must never be used by this harness.
    if any(p.name != ".env.example" for p in ROOT.glob(".env*")):
        raise RuntimeError("Refusing local environment files")
    OUT.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    db_port = server.server_address[1]; app_port = free_port()
    env = {k: v for k, v in os.environ.items() if not any(w in k.upper() for w in ["SUPABASE", "OPENAI", "ANTHROPIC", "SOSPHD_MODEL", "AI_GATEWAY", "VERCEL"])}
    env.update(NEXT_PUBLIC_SUPABASE_URL=f"http://127.0.0.1:{db_port}", NEXT_PUBLIC_SUPABASE_ANON_KEY="synthetic-public-test-key",
               NEXT_TELEMETRY_DISABLED="1", NODE_ENV="development")
    log = (OUT / "local-next.log").open("w")
    process = subprocess.Popen([str(ROOT / "node_modules/.bin/next"), "dev", "--hostname", "127.0.0.1", "--port", str(app_port)], cwd=ROOT, env=env, stdout=log, stderr=subprocess.STDOUT)
    checks = []; page = None; errors = []
    def checked(name):
        checks.append(name)
    try:
        for _ in range(120):
            if process.poll() is not None: raise RuntimeError("Local Next stopped; inspect the synthetic log")
            try:
                with socket.create_connection(("127.0.0.1", app_port), timeout=0.2): break
            except OSError: time.sleep(0.25)
        else: raise RuntimeError("Local Next did not become ready")
        with sync_playwright() as p:
            executable = os.environ.get("SOSPHD_TEST_CHROMIUM") or shutil.which("chromium")
            browser = p.chromium.launch(headless=True, **({"executable_path": executable} if executable else {}))
            context = browser.new_context(viewport={"width": 1440, "height": 1000})
            # This is an explicitly mocked auth session, not a valid Supabase login.
            token = encoded({"alg": "HS256", "typ": "JWT"}) + "." + encoded({"sub": OWNER, "exp": int(time.time()) + 3600, "role": "authenticated"}) + ".synthetic"
            session = {"access_token": token, "refresh_token": "synthetic-refresh", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "user": USER}
            context.add_cookies([{"name": "sb-127-auth-token", "value": "base64-" + encoded(session), "domain": "127.0.0.1", "path": "/", "httpOnly": False, "secure": False, "sameSite": "Lax"}])
            context.route("**/*", lambda route: route.continue_() if urlparse(route.request.url).hostname in ["127.0.0.1", "localhost", None] else route.abort())
            page = context.new_page(); page.set_default_timeout(20000)
            page.on("pageerror", lambda e: errors.append(str(e)[:300]))
            page.goto(f"http://127.0.0.1:{app_port}/fieldwork", timeout=60000)
            expect(page.get_by_text("Page 1: 50 shown of 72 matching entries", exact=True)).to_be_visible()
            checked("bounded first page with exact matching inventory count")
            page.get_by_role("button", name="Older entries", exact=True).click()
            expect(page.get_by_text("Page 2: 22 shown of 72 matching entries", exact=True)).to_be_visible()
            expect(page.get_by_text("OLDER_UNIQUE_RECORD", exact=True)).to_be_visible()
            checked("older entries remain reachable")
            page.get_by_role("button", name="Newer entries", exact=True).click()
            page.get_by_label("Search all journal entries").fill("OLDER_UNIQUE_RECORD")
            expect(page.get_by_text("Page 1: 1 shown of 1 matching entries", exact=True)).to_be_visible()
            checked("search runs before pagination")
            page.get_by_label("Search all journal entries").fill("")
            page.get_by_role("button", name="Pinned only", exact=True).click()
            expect(page.get_by_text("Page 1: 1 shown of 1 matching entries", exact=True)).to_be_visible()
            expect(page.get_by_text("OLDER_UNIQUE_RECORD", exact=True)).to_be_visible()
            checked("old pinned record visible in dedicated view")
            page.get_by_role("button", name="Pinned only", exact=True).click()
            page.get_by_label("Exact journal tag").fill("older-tag")
            expect(page.get_by_text("Page 1: 1 shown of 1 matching entries", exact=True)).to_be_visible()
            checked("exact tag filter runs before pagination")
            page.get_by_label("Exact journal tag").fill("")
            expect(page.get_by_text("Page 1: 50 shown of 72 matching entries", exact=True)).to_be_visible()

            def fill_entry(title):
                page.get_by_role("button", name="New entry").first.click()
                expect(page.get_by_role("dialog")).to_be_visible()
                page.get_by_label("Title", exact=True).fill(title)
                page.get_by_label("Details", exact=True).fill("Synthetic field note ລາວ. No real people or events.")

            for n in [1, 2]:
                fill_entry(f"Synthetic saved entry {n}")
                # Open the Radix selector explicitly: the former empty value crashes here.
                page.get_by_role("combobox").last.click()
                page.get_by_role("option", name="None", exact=True).click()
                page.get_by_role("button", name="Save Entry", exact=True).click()
                expect(page.get_by_role("dialog")).not_to_be_visible()
                expect(page.get_by_text(f"Synthetic saved entry {n}", exact=True)).to_be_visible()
            page.reload()
            expect(page.get_by_text("Synthetic saved entry 1", exact=True)).to_be_visible()
            expect(page.get_by_text("Synthetic saved entry 2", exact=True)).to_be_visible()
            checked("two consecutive entries save, reset, appear, and survive reload")
            assert len(STATE.tables["journal_entries"]) == 74

            fill_entry("Synthetic failed then retried")
            STATE.fail_next_insert = True
            page.get_by_role("button", name="Save Entry", exact=True).click()
            expect(page.get_by_role("button", name="Retry same entry", exact=True)).to_be_visible()
            expect(page.get_by_label("Title", exact=True)).to_have_value("Synthetic failed then retried")
            page.get_by_role("button", name="Retry same entry", exact=True).click()
            expect(page.get_by_role("dialog")).not_to_be_visible()
            assert len(STATE.tables["journal_entries"]) == 75
            checked("failed insert retains text and safe retry identity")

            fill_entry("Synthetic lost response")
            lost = {"done": False}
            def interrupt(route):
                if route.request.method == "POST" and route.request.headers.get("next-action") and not lost["done"]:
                    lost["done"] = True; route.fetch(); route.abort("failed")
                else: route.continue_()
            page.route(f"http://127.0.0.1:{app_port}/fieldwork", interrupt)
            page.get_by_role("button", name="Save Entry", exact=True).click()
            expect(page.get_by_role("button", name="Retry same entry", exact=True)).to_be_visible()
            assert len(STATE.tables["journal_entries"]) == 76
            with page.expect_download() as download:
                page.get_by_role("button", name="Export private draft", exact=True).click()
            recovered = json.loads(Path(download.value.path()).read_text())
            assert recovered["request_id"] and recovered["fields"]["title"] == "Synthetic lost response"
            page.get_by_role("button", name="Retry same entry", exact=True).click()
            expect(page.get_by_role("dialog")).not_to_be_visible()
            assert len(STATE.tables["journal_entries"]) == 76
            page.unroute(f"http://127.0.0.1:{app_port}/fieldwork", interrupt)
            checked("lost successful response recovers without a duplicate; private export retains request")

            STATE.fail_journal_reads = True
            page.get_by_role("button", name="Refresh", exact=True).click()
            expect(page.get_by_role("button", name="Retry journal load", exact=True)).to_be_visible()
            expect(page.get_by_text("No journal entries yet.", exact=True)).not_to_be_visible()
            STATE.fail_journal_reads = False
            page.get_by_role("button", name="Retry journal load", exact=True).click()
            expect(page.get_by_text("Page 1: 50 shown of 76 matching entries", exact=True)).to_be_visible()
            checked("unavailable is not an empty journal and refresh recovers")

            page.get_by_text("Synthetic active checklist", exact=True).click()
            page.get_by_role("checkbox", name="Synthetic checkpoint", exact=False).check()
            STATE.fail_protocol_save = True
            page.get_by_role("button", name="Save Progress", exact=True).click()
            expect(page.get_by_role("alert")).to_contain_text("Checklist save was not confirmed")
            expect(page.get_by_role("checkbox", name="Synthetic checkpoint", exact=False)).to_be_checked()
            expect(page.get_by_role("button", name="Save Progress", exact=True)).to_be_enabled()
            STATE.fail_protocol_save = False
            page.get_by_role("button", name="Save Progress", exact=True).click()
            expect(page.get_by_role("dialog")).not_to_be_visible()
            assert next(r for r in STATE.tables["protocols"] if r["id"] == ACTIVE)["sections"][0]["items"][0]["notes"] == "Existing note survives."
            checked("checklist failure retains progress, cleans pending state, and preserves existing notes")
            page.screenshot(path=str(OUT / "desktop.png"), full_page=True)
            page.set_viewport_size({"width": 390, "height": 844})
            fill_entry("Synthetic narrow-screen draft")
            page.get_by_label("Title", exact=True).focus()
            page.keyboard.press("Tab")
            expect(page.get_by_label("Details", exact=True)).to_be_focused()
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1")
            page.screenshot(path=str(OUT / "mobile.png"), full_page=True)
            checked("keyboard field navigation and narrow viewport without document overflow")
            assert not errors, errors
            checked("no uncaught page exceptions")
            browser.close()
    except Exception:
        if page:
            try: page.screenshot(path=str(OUT / "failure.png"), full_page=True)
            except Exception: pass
        (OUT / "summary.json").write_text(json.dumps({"passed": False, "checks_completed": checks, "backend": "synthetic loopback; not real Supabase/RLS"}, indent=2))
        raise
    finally:
        process.terminate()
        try: process.wait(timeout=10)
        except subprocess.TimeoutExpired: process.kill(); process.wait()
        server.shutdown(); server.server_close(); log.close()
    (OUT / "summary.json").write_text(json.dumps({"passed": True, "checks_completed": checks, "backend": "synthetic loopback; not real Supabase/RLS", "live_writes": False}, indent=2))
    print(f"Fieldwork browser checks passed: {len(checks)}. Synthetic backend only.")

if __name__ == "__main__":
    main()
