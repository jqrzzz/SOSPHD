#!/usr/bin/env python3
"""Real Next.js page/actions, synthetic HTTP auth and persistence fixture.
NOT a real Supabase/RLS acceptance test. Binds loopback only; never takes a hosted URL.
Run in a dependency-installed disposable checkout. No real credentials or records.
"""
from __future__ import annotations
import base64
import json
import os
from pathlib import Path
import subprocess
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'test-results' / 'revision-browser'
APP = 'http://127.0.0.1:4173'
OWNER = '11111111-1111-4111-8111-111111111111'
DOC = '22222222-2222-4222-8222-222222222222'
BASE = '# Synthetic preservation manuscript\n\n## Methods\nOriginal method.\n\n### Nested\nNested text.\n\n## Results\nNo real participants.\n'
SESSION = None
STATE = {}
LOCK = threading.Lock()


def reset():
    STATE.clear()
    STATE.update(docs={DOC: dict(id=DOC, user_id=OWNER, title='Synthetic preservation manuscript', content_md=BASE,
        updated_at='2030-01-01T00:00:00Z', folder='Papers', tags=['synthetic'], status='draft', linked_case_id=None)},
        versions={}, annotations=[dict(id='33333333-3333-4333-8333-333333333333', doc_id=DOC,
        user_id=OWNER, quote='Original method.', comment='Review the event definition.', resolved=False)],
        operations=[], fail_archive_read=False, unexpected=[])


def make_session():
    now = int(time.time())
    def enc(value):
        return base64.urlsafe_b64encode(json.dumps(value, separators=(',', ':')).encode()).decode().rstrip('=')
    token = f'{enc({"alg":"HS256","typ":"JWT"})}.{enc({"sub":OWNER,"role":"authenticated","aud":"authenticated","exp":now+3600,"iat":now})}.synthetic-fixture-signature'
    return dict(access_token=token, refresh_token='synthetic-refresh-token', token_type='bearer', expires_in=3600,
        expires_at=now+3600, user=dict(id=OWNER, aud='authenticated', role='authenticated',
        email='synthetic-owner@example.invalid', app_metadata={}, user_metadata={}, identities=[], created_at='2030-01-01T00:00:00Z'))


class Fixture(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        pass

    def reply(self, status, data):
        payload = json.dumps(data).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(payload)))
        self.send_header('Access-Control-Allow-Origin', APP)
        self.send_header('Access-Control-Allow-Headers', 'authorization,apikey,content-type,x-client-info,accept-profile,content-profile')
        self.end_headers()
        self.wfile.write(payload)

    def do_OPTIONS(self):
        self.reply(200, {})

    def do_GET(self):
        self.handle_read_write()

    def do_POST(self):
        self.handle_read_write()

    def handle_read_write(self):
        with LOCK:
            self.handle_locked()

    def handle_locked(self):
        url = urlsplit(self.path)
        if url.path == '/auth/v1/user':
            good = self.headers.get('Authorization') == f'Bearer {SESSION["access_token"]}'
            return self.reply(200 if good else 401, SESSION['user'] if good else {'message':'No fixture session'})
        if self.headers.get('Authorization') != f'Bearer {SESSION["access_token"]}':
            return self.reply(401, {'message':'Synthetic authentication required'})
        if url.path == '/rest/v1/rpc/is_allowed_user' and self.command == 'POST':
            return self.reply(200, True)
        table = url.path.removeprefix('/rest/v1/')
        if table not in ('docs', 'doc_versions', 'doc_annotations', 'profiles'):
            STATE['unexpected'].append([self.command, url.path])
            return self.reply(404, {'message':'Unsupported fixture route'})
        if table == 'profiles':
            return self.reply(200, [])
        storage = STATE['versions'] if table == 'doc_versions' else STATE['docs']
        if self.command == 'POST':
            length = int(self.headers.get('Content-Length', '0'))
            if length < 1 or length > 2 * 1024 * 1024 or table == 'doc_annotations':
                return self.reply(400, {'message':'Unsupported fixture mutation'})
            row = json.loads(self.rfile.read(length))
            if not isinstance(row, dict) or row.get('user_id') != OWNER:
                return self.reply(403, {'message':'Wrong fixture owner'})
            if row['id'] in storage:
                return self.reply(409, {'code':'23505','message':'Synthetic duplicate key'})
            if table == 'doc_versions' and row.get('doc_id') not in STATE['docs']:
                return self.reply(400, {'message':'Missing synthetic base'})
            storage[row['id']] = dict(row)
            if table == 'docs':
                storage[row['id']]['updated_at'] = '2030-01-02T00:00:00Z'
            STATE['operations'].append(['insert', table, row['id']])
            return self.reply(201, None)
        if table == 'doc_versions' and STATE['fail_archive_read'] and STATE['versions']:
            STATE['fail_archive_read'] = False
            return self.reply(503, {'message':'Injected archive readback failure'})
        rows = list(STATE['annotations']) if table == 'doc_annotations' else list(storage.values())
        filters = parse_qs(url.query)
        for name in ('id', 'doc_id', 'user_id', 'resolved'):
            if name in filters:
                target = filters[name][0].removeprefix('eq.')
                rows = [r for r in rows if str(r.get(name)).lower() == target.lower()]
        if 'application/vnd.pgrst.object+json' in self.headers.get('Accept',''):
            return self.reply(200, rows[0] if len(rows) == 1 else None)
        return self.reply(200, rows)


def main():
    global SESSION
    # Never inherit real connection settings or AI keys into the tested app.
    if not (ROOT / 'node_modules/next').exists():
        raise RuntimeError('Install the repository lockfile in an isolated checkout first.')
    if any((ROOT / name).exists() for name in ('.env', '.env.local', '.env.production', '.env.development.local')):
        raise RuntimeError('Use a clean disposable checkout without local environment files.')
    from playwright.sync_api import sync_playwright, expect
    OUT.mkdir(parents=True, exist_ok=True)
    SESSION = make_session()
    reset()
    server = ThreadingHTTPServer(('127.0.0.1', 54329), Fixture)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    env = {k: v for k, v in os.environ.items() if not any(x in k.upper() for x in ('SUPABASE','OPENAI','ANTHROPIC','AI_GATEWAY','DATABASE_URL'))}
    env.update(NEXT_PUBLIC_SUPABASE_URL='http://127.0.0.1:54329', NEXT_PUBLIC_SUPABASE_ANON_KEY='synthetic-anon-key', NEXT_TELEMETRY_DISABLED='1', NODE_ENV='development')
    log = (OUT / 'next-synthetic.log').open('w')
    proc = subprocess.Popen(['node', 'node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', '4173'], cwd=ROOT, env=env, stdout=log, stderr=subprocess.STDOUT)
    checks = []
    errors = []
    def record(name):
        checks.append({'id':name,'passed':True})
    try:
        deadline = time.monotonic() + 150
        while time.monotonic() < deadline:
            if proc.poll() is not None:
                raise RuntimeError('Synthetic app exited before readiness.')
            try:
                with urlopen(APP, timeout=2) as response:
                    if response.status == 200:
                        break
            except Exception:
                time.sleep(1)
        else:
            raise RuntimeError('Synthetic app readiness timed out.')
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(viewport={'width':1440,'height':1000})
            external = []
            def network_guard(route):
                host = urlsplit(route.request.url).hostname
                if host != '127.0.0.1':
                    external.append(host)
                    route.abort()
                else:
                    route.continue_()
            context.route('**/*', network_guard)
            page = context.new_page()
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto(f'{APP}/docs/{DOC}/revise')
            assert '/revise' not in page.url
            record('anonymous-route-protected')
            cookie = 'base64-' + base64.urlsafe_b64encode(json.dumps(SESSION, separators=(',',':')).encode()).decode().rstrip('=')
            context.add_cookies([dict(name='sb-127-auth-token',value=cookie,domain='127.0.0.1',path='/',httpOnly=False,sameSite='Lax')])
            def open_editor():
                page.goto(f'{APP}/docs/{DOC}/revise')
                expect(page.get_by_role('heading',name='Revise a section',exact=True)).to_be_visible(timeout=90000)
                # Pick the exact heading label from the application, not an assumed byte range.
                option = page.locator('#revision-section option').filter(has_text='Methods').first
                page.locator('#revision-section').select_option(option.get_attribute('value'))
            def proposal(text='Revised synthetic method.\n\n### Nested\nNested text preserved.\n\n'):
                page.locator('#revision-replacement').fill(text)
                page.locator('#revision-note').fill('Synthetic preservation acceptance test.')
                page.get_by_role('button',name='3. Preview full draft',exact=True).click()
                expect(page.get_by_role('button',name='Save full draft separately',exact=True)).to_be_disabled()
                page.get_by_role('checkbox').check()
            open_editor()
            page.get_by_text('Open review notes (1)',exact=True).click()
            expect(page.get_by_text('Review the event definition.',exact=True)).to_be_visible()
            proposal()
            expect(page.get_by_role('heading',name='Full manuscript after this replacement',exact=True)).to_be_visible()
            assert page.locator('pre').last.inner_text().endswith('No real participants.\n')
            page.screenshot(path=str(OUT/'desktop-preview.png'), full_page=True)
            record('parent-section-full-preview-and-review-gate')
            # Execute the real Server Action, then drop its response after persistence.
            def lose_response(route):
                if route.request.method == 'POST' and 'next-action' in route.request.headers:
                    route.fetch()
                    route.abort('failed')
                else:
                    route.continue_()
            page.route('**/revise', lose_response)
            page.get_by_role('button',name='Save full draft separately',exact=True).click()
            expect(page.get_by_role('status').filter(has_text='interrupted')).to_be_visible(timeout=30000)
            assert len(STATE['docs']) == 2 and len(STATE['versions']) == 1
            page.unroute('**/revise', lose_response)
            page.get_by_role('button',name='Save full draft separately',exact=True).click()
            expect(page.get_by_role('status').filter(has_text='earlier save was recovered')).to_be_visible(timeout=30000)
            assert len(STATE['docs']) == 2 and len(STATE['versions']) == 1
            assert STATE['docs'][DOC]['content_md'] == BASE
            assert next(iter(STATE['versions'].values()))['content_md'] == BASE
            record('interrupted-response-identical-retry-single-draft-base-preserved')
            with LOCK: reset()
            open_editor(); proposal()
            with LOCK: STATE['docs'][DOC]['content_md'] += '\nChanged in another tab.\n'
            page.get_by_role('button',name='Save full draft separately',exact=True).click()
            expect(page.get_by_role('status').filter(has_text='source or its review notes changed')).to_be_visible(timeout=30000)
            assert len(STATE['docs']) == 1 and not STATE['versions']
            record('stale-source-rejected-without-write')
            with LOCK: reset()
            open_editor(); proposal()
            with LOCK: STATE['annotations'][0]['comment'] = 'Updated review note.'
            page.get_by_role('button',name='Save full draft separately',exact=True).click()
            expect(page.get_by_role('status').filter(has_text='source or its review notes changed')).to_be_visible(timeout=30000)
            assert len(STATE['docs']) == 1 and not STATE['versions']
            record('stale-review-note-rejected-without-write')
            with LOCK: reset(); STATE['fail_archive_read'] = True
            open_editor(); proposal()
            page.get_by_role('button',name='Save full draft separately',exact=True).click()
            expect(page.get_by_role('status').filter(has_text='database is unavailable')).to_be_visible(timeout=30000)
            assert len(STATE['docs']) == 1 and len(STATE['versions']) == 1
            page.get_by_role('button',name='Save full draft separately',exact=True).click()
            expect(page.get_by_role('status').filter(has_text='Full revised draft saved')).to_be_visible(timeout=30000)
            assert len(STATE['docs']) == 2 and len(STATE['versions']) == 1
            record('archive-readback-failure-prevents-draft-retry-recovers')
            with LOCK: reset()
            page.set_viewport_size({'width':390,'height':844})
            open_editor(); proposal('Mobile synthetic proposal.\n\n')
            assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
            page.locator('#revision-section').focus()
            assert page.locator('#revision-section').evaluate('e => e === document.activeElement')
            with page.expect_download() as download:
                page.get_by_role('button',name='Export private working copy',exact=True).click()
            payload=json.loads(Path(download.value.path()).read_text())
            assert payload['base_content_md'] == BASE
            assert 'Mobile synthetic proposal.' in payload['selected_full_draft_md']
            page.screenshot(path=str(OUT/'mobile-preview.png'),full_page=True)
            record('mobile-width-keyboard-focus-and-private-export')
            assert not external, 'Unexpected external browser request'
            assert not STATE['unexpected'], 'Unexpected backend fixture route'
            # Interrupted network response is expected; actual JS page exceptions are not.
            assert not errors, 'Unexpected browser page exception'
            record('no-external-requests-or-browser-exceptions')
            browser.close()
    finally:
        proc.terminate()
        try: proc.wait(timeout=15)
        except subprocess.TimeoutExpired: proc.kill(); proc.wait()
        server.shutdown(); server.server_close(); log.close()
        report=dict(scope='real-next-page-and-actions-with-mocked-auth-and-persistence',
            real_supabase_or_rls_tested=False, hosted_records_used=False, checks=checks,
            passed=len(checks)==8, code_under_test='current-checkout',
            notice='Synthetic browser integration only. Real isolated Supabase acceptance remains separate.')
        (OUT/'summary.json').write_text(json.dumps(report,indent=2)+'\n')
        print(json.dumps(report))
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
