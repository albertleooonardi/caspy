"""Local Caspy accounts, consented evaluations, and organization dataset licensing."""
from contextlib import contextmanager
import hashlib
import hmac
from http.cookies import SimpleCookie
import json
import os
from pathlib import Path
import re
import secrets
import sqlite3
import threading
import time
from urllib.parse import urlsplit

NOTICE = 'caspy-research-2026-11-v1'
RETENTION = 90 * 86400
STRATEGIES = ('emotional', 'logic', 'roleplay', 'trade', 'humor', 'other', 'exploit_attempt')


class Fault(Exception):
    def __init__(self, status, detail):
        self.status, self.detail = status, detail
        super().__init__(detail)


def text(value, name, minimum=1, maximum=200):
    if not isinstance(value, str) or not minimum <= len(value.strip()) <= maximum:
        raise Fault(400, f'{name} must contain {minimum}–{maximum} characters.')
    return value.strip()


def redact(value):
    value = re.sub(r'(?i)\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b', '[EMAIL]', value)
    value = re.sub(r'(?i)https?://[^\s<>]+|\bwww\.[^\s<>]+', '[URL]', value)
    value = re.sub(r'(?i)\b0x[0-9a-f]{40,}\b', '[WALLET]', value)
    value = re.sub(r'\b(?:\d{1,3}\.){3}\d{1,3}\b', '[IP]', value)
    value = re.sub(r'(?i)\b(?:sk-|sk_|api[_-]?key[=: ]+)[a-z0-9_\-]{12,}', '[SECRET]', value)
    value = re.sub(r'(?<!\w)\+?\d[\d ()\-.]{6,}\d(?!\w)', '[NUMBER]', value)
    return value


class Platform:
    def __init__(self, path, model_info=None):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.touch(mode=0o600, exist_ok=True)
        os.chmod(self.path, 0o600)
        self.lock = threading.RLock()
        self.model_info = model_info or {'actor_requested': 'unknown', 'judge_requested': 'unknown', 'rubric_version': 'caspy-judge-v1'}
        self.last_purge = 0
        self.dummy_salt = secrets.token_bytes(16)
        self.dummy_hash = self.password_hash('nonexistent-account-password', self.dummy_salt)
        with self.db() as db:
            db.executescript('''
            CREATE TABLE IF NOT EXISTS organizations(id TEXT PRIMARY KEY, name TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
                salt TEXT NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL, org_id TEXT, created INTEGER NOT NULL);
            CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires INTEGER NOT NULL);
            CREATE TABLE IF NOT EXISTS login_attempts(ip TEXT NOT NULL, email TEXT NOT NULL, created INTEGER NOT NULL);
            CREATE TABLE IF NOT EXISTS wallet_links(address TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id));
            CREATE TABLE IF NOT EXISTS campaigns(id TEXT PRIMARY KEY, org_id TEXT NOT NULL REFERENCES organizations(id),
                name TEXT NOT NULL, description TEXT NOT NULL, active INTEGER NOT NULL, config TEXT NOT NULL, created INTEGER NOT NULL);
            CREATE TABLE IF NOT EXISTS contributions(session_id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
                campaign_id TEXT REFERENCES campaigns(id), research INTEGER NOT NULL, commercial INTEGER NOT NULL,
                notice TEXT NOT NULL, withdrawn INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL);
            CREATE TABLE IF NOT EXISTS samples(id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES contributions(session_id),
                turn INTEGER NOT NULL, prompt TEXT NOT NULL, reply TEXT NOT NULL, evaluation TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending', human_verdict TEXT, test_kind TEXT, safety_label TEXT,
                strategy TEXT, rating INTEGER, participant_rating INTEGER, created INTEGER NOT NULL,
                UNIQUE(session_id,turn));
            CREATE TABLE IF NOT EXISTS releases(id TEXT PRIMARY KEY, org_id TEXT NOT NULL REFERENCES organizations(id),
                title TEXT NOT NULL, description TEXT NOT NULL, license TEXT NOT NULL, price_cents INTEGER NOT NULL, created INTEGER NOT NULL);
            CREATE TABLE IF NOT EXISTS release_samples(release_id TEXT REFERENCES releases(id), sample_id TEXT REFERENCES samples(id) ON DELETE CASCADE,
                PRIMARY KEY(release_id,sample_id));
            CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY, release_id TEXT NOT NULL REFERENCES releases(id),
                buyer_org TEXT NOT NULL REFERENCES organizations(id), status TEXT NOT NULL DEFAULT 'requested', created INTEGER NOT NULL,
                UNIQUE(release_id,buyer_org));
            CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY, user_id TEXT, action TEXT NOT NULL, object_id TEXT NOT NULL, created INTEGER NOT NULL);
            CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
            ''')
            db.execute('INSERT OR IGNORE INTO settings VALUES (?,?)', ('export_key', secrets.token_hex(32)))
            self.export_key = bytes.fromhex(db.execute('SELECT value FROM settings WHERE key=?', ('export_key',)).fetchone()[0])
        os.chmod(self.path, 0o600)

    @contextmanager
    def db(self):
        with self.lock:
            connection = sqlite3.connect(self.path, timeout=10)
            connection.row_factory = sqlite3.Row
            connection.execute('PRAGMA foreign_keys=ON')
            try:
                with connection:
                    yield connection
            finally:
                connection.close()

    @staticmethod
    def password_hash(password, salt):
        # Available in macOS's system Python, including builds without scrypt.
        return hashlib.pbkdf2_hmac('sha256', password.encode(), salt, 600000, dklen=32)

    @staticmethod
    def cookie_token(handler):
        cookie = SimpleCookie()
        try:
            cookie.load(handler.headers.get('Cookie', ''))
            return cookie['caspy_account'].value if 'caspy_account' in cookie else ''
        except Exception:
            return ''

    @staticmethod
    def token_hash(token):
        return hashlib.sha256(token.encode()).hexdigest()

    def user(self, token, required=True):
        with self.db() as db:
            row = db.execute('SELECT u.id,u.email,u.name,u.role,u.org_id,o.name org_name FROM sessions s JOIN users u ON u.id=s.user_id LEFT JOIN organizations o ON o.id=u.org_id WHERE s.token_hash=? AND s.expires>?', (self.token_hash(token), int(time.time()))).fetchone()
        if not row and required:
            raise Fault(401, 'Sign in to your Caspy account to continue.')
        return dict(row) if row else None

    @staticmethod
    def researcher(user):
        if user['role'] != 'researcher' or not user['org_id']:
            raise Fault(403, 'This action requires a research workspace account.')

    def throttle(self, ip, email):
        now = int(time.time())
        with self.db() as db:
            db.execute('DELETE FROM login_attempts WHERE created<?', (now-600,))
            count = db.execute('SELECT count(*) FROM login_attempts WHERE ip=? OR email=?', (ip, email)).fetchone()[0]
            if count >= 20:
                raise Fault(429, 'Too many sign-in attempts. Try again in ten minutes.')
            db.execute('INSERT INTO login_attempts VALUES (?,?,?)', (ip, email, now))

    def authenticate(self, body, ip, old_token, register=False):
        email = text(body.get('email'), 'Email', 3, 254).lower()
        if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', email):
            raise Fault(400, 'Enter a valid email address.')
        password = body.get('password')
        if not isinstance(password, str) or not 12 <= len(password) <= 128:
            raise Fault(400, 'Use a password between 12 and 128 characters.')
        self.throttle(ip, email)
        if register:
            name = text(body.get('name'), 'Name', 2, 60)
            role = body.get('account_type', 'contributor')
            if role not in ('contributor', 'researcher'):
                raise Fault(400, 'Choose contributor or researcher.')
            org_name = text(body.get('organization'), 'Workspace name', 2, 80) if role == 'researcher' else None
            if body.get('terms_accepted') is not True:
                raise Fault(400, 'Accept the account terms to register.')
            salt = secrets.token_bytes(16)
            hashed = 'pbkdf2_sha256$600000$' + self.password_hash(password, salt).hex()
            user_id, org_id = secrets.token_urlsafe(18), secrets.token_urlsafe(18) if org_name else None
            try:
                with self.db() as db:
                    if org_id:
                        db.execute('INSERT INTO organizations VALUES (?,?)', (org_id, org_name))
                    db.execute('INSERT INTO users VALUES (?,?,?,?,?,?,?,?)', (user_id, email, name, salt.hex(), hashed, role, org_id, int(time.time())))
                    self.audit(db, {'id': user_id}, 'accept_account_terms_v1', user_id)
            except sqlite3.IntegrityError:
                raise Fault(400, 'Unable to register with these details. Try signing in or use a different email.') from None
        else:
            with self.db() as db:
                row = db.execute('SELECT * FROM users WHERE email=?', (email,)).fetchone()
            salt = bytes.fromhex(row['salt']) if row else self.dummy_salt
            hashed = self.password_hash(password, salt)
            expected = bytes.fromhex(row['password_hash'].split('$')[-1]) if row else self.dummy_hash
            if not row or not hmac.compare_digest(hashed, expected):
                raise Fault(401, 'Email or password is incorrect.')
            user_id = row['id']
        token = secrets.token_urlsafe(32)
        with self.db() as db:
            db.execute('DELETE FROM sessions WHERE token_hash=? OR expires<?', (self.token_hash(old_token), int(time.time())))
            db.execute('INSERT INTO sessions VALUES (?,?,?)', (self.token_hash(token), user_id, int(time.time())+28800))
        return token, self.user(token)

    def link_wallet(self, user, address):
        address = address.lower()
        with self.db() as db:
            existing = db.execute('SELECT user_id FROM wallet_links WHERE address=?', (address,)).fetchone()
            if existing and existing[0] != user['id']:
                raise Fault(403, 'This verified wallet is already linked to another Caspy account.')
            db.execute('INSERT OR IGNORE INTO wallet_links VALUES (?,?)', (address, user['id']))

    def check_wallet(self, user, address):
        with self.db() as db:
            row = db.execute('SELECT user_id FROM wallet_links WHERE address=?', (address.lower(),)).fetchone()
        if not row or row[0] != user['id']:
            raise Fault(403, 'Verify this wallet with your current Caspy account first.')

    def available_wallets(self, user, addresses):
        with self.db() as db:
            links = {r['address']: r['user_id'] for r in db.execute('SELECT * FROM wallet_links')}
        return [{'address': address, 'linked': links.get(address.lower()) == user['id']}
                for address in addresses if links.get(address.lower()) in (None, user['id'])]

    def create_campaign(self, user, body):
        self.researcher(user)
        ident = secrets.token_urlsafe(18)
        with self.db() as db:
            db.execute('INSERT INTO campaigns VALUES (?,?,?,?,?,?,?)', (ident, user['org_id'], text(body.get('name'), 'Campaign name', 3, 100), text(body.get('description'), 'Research purpose', 20, 1000), 1, json.dumps(self.model_info), int(time.time())))
        return {'id': ident}

    def campaigns(self):
        with self.db() as db:
            rows = db.execute('SELECT c.id,c.name,c.description,c.config,o.name organization FROM campaigns c JOIN organizations o ON o.id=c.org_id WHERE c.active=1 ORDER BY c.created DESC').fetchall()
        return [dict(r, config=json.loads(r['config'])) for r in rows]

    def associate_game(self, user, game, body):
        campaign_id = body.get('campaign_id') or None
        research, commercial = body.get('research_opt_in') is True, body.get('commercial_opt_in') is True
        if commercial and not research:
            raise Fault(400, 'Commercial contribution requires research consent too.')
        if research and (not campaign_id or body.get('consent_version') != NOTICE):
            raise Fault(400, 'Choose a research campaign and accept the current consent notice.')
        with self.db() as db:
            if campaign_id:
                campaign = db.execute('SELECT config FROM campaigns WHERE id=? AND active=1', (campaign_id,)).fetchone() if isinstance(campaign_id, str) else None
                if not campaign:
                    raise Fault(400, 'This research campaign is unavailable.')
                if research and json.loads(campaign['config']) != self.model_info:
                    raise Fault(409, 'The campaign configuration changed. Its owner must publish a new campaign before collecting more examples.')
            existing = db.execute('SELECT user_id FROM contributions WHERE session_id=?', (game['id'],)).fetchone()
            if existing and existing[0] != user['id']:
                raise Fault(403, 'This heist belongs to another account.')
            if not existing:
                db.execute('INSERT INTO contributions VALUES (?,?,?,?,?,?,?,?)', (game['id'], user['id'], campaign_id, int(research), int(commercial), NOTICE, 0, int(time.time())))
        return self.decorate(game, user)

    def owns_game(self, user, ident):
        with self.db() as db:
            row = db.execute('SELECT * FROM contributions WHERE session_id=? AND user_id=?', (ident, user['id'])).fetchone()
        if not row:
            raise Fault(404, 'Heist not found for this account.')
        return dict(row)

    def decorate(self, game, user):
        link = self.owns_game(user, game['id'])
        return {**game, 'research_consent': bool(link['research'] and not link['withdrawn']), 'commercial_consent': bool(link['commercial'] and not link['withdrawn']), 'campaign_id': link['campaign_id']}

    def capture(self, game):
        with self.db() as db:
            link = db.execute('SELECT * FROM contributions WHERE session_id=?', (game['id'],)).fetchone()
            if not link or not link['research'] or link['withdrawn'] or link['created'] < time.time()-RETENTION:
                return
            for evaluation in game.get('evaluations', []):
                turn = evaluation['turn']
                offset = (turn-1)*2
                if offset+1 >= len(game['messages']):
                    continue
                db.execute('INSERT OR IGNORE INTO samples(id,session_id,turn,prompt,reply,evaluation,created) VALUES (?,?,?,?,?,?,?)', (secrets.token_urlsafe(18), game['id'], turn, redact(game['messages'][offset]['text']), redact(game['messages'][offset+1]['text']), json.dumps(evaluation), int(time.time())))

    def dashboard(self, user):
        self.researcher(user)
        with self.db() as db:
            campaigns = [dict(r, config=json.loads(r['config'])) for r in db.execute('SELECT * FROM campaigns WHERE org_id=? ORDER BY created DESC', (user['org_id'],))]
            rows = db.execute('SELECT s.*,c.campaign_id,c.commercial FROM samples s JOIN contributions c ON c.session_id=s.session_id JOIN campaigns p ON p.id=c.campaign_id WHERE p.org_id=? AND c.withdrawn=0 AND c.research=1 ORDER BY s.created DESC,s.rowid DESC', (user['org_id'],)).fetchall()
            orders = [dict(r) for r in db.execute('SELECT o.*,r.title,b.name buyer_name FROM orders o JOIN releases r ON r.id=o.release_id JOIN organizations b ON b.id=o.buyer_org WHERE r.org_id=? ORDER BY o.created DESC', (user['org_id'],))]
        groups = {}
        for row in rows:
            ev = json.loads(row['evaluation'])
            key = (row['campaign_id'], ev.get('actor_served') or 'unknown', ev.get('rubric_hash') or ev.get('rubric_version', 'unknown'))
            group = groups.setdefault(key, dict(campaign_id=key[0], model=key[1], rubric_version=ev.get('rubric_version','unknown'), rubric_hash=ev.get('rubric_hash'), turns=0, yield_count=0, reviewed=0, agreement_count=0, agreement_denominator=0, attack_cases=0, boundary_failures=0))
            group['turns'] += 1
            group['yield_count'] += int(ev.get('verdict') == 'YIELD')
            if row['status'] == 'approved':
                group['reviewed'] += 1
                if row['human_verdict'] in ('YIELD', 'NO_YIELD'):
                    group['agreement_denominator'] += 1
                    group['agreement_count'] += int(row['human_verdict'] == ev.get('verdict'))
                if row['test_kind'] == 'policy_attack' and row['safety_label'] in ('boundary_violation', 'appropriate_refusal'):
                    group['attack_cases'] += 1
                    group['boundary_failures'] += int(row['safety_label'] == 'boundary_violation')
        for group in groups.values():
            group['yield_rate'] = group['yield_count']/group['turns'] if group['turns'] else None
            group['judge_agreement'] = group['agreement_count']/group['agreement_denominator'] if group['agreement_denominator'] else None
            group['boundary_violation_rate'] = group['boundary_failures']/group['attack_cases'] if group['attack_cases'] else None
        samples = [{k: r[k] for k in ('id','campaign_id','turn','prompt','reply','status','human_verdict','test_kind','safety_label','strategy','rating','participant_rating','commercial')} | {'evaluation': json.loads(r['evaluation'])} for r in rows[:200]]
        return {'campaigns': campaigns, 'samples': samples, 'metrics': list(groups.values()), 'orders': orders,
                'totals': {'turns': len(rows), 'pending': sum(r['status']=='pending' for r in rows), 'approved': sum(r['status']=='approved' for r in rows)}}

    def review_sample(self, user, ident, body):
        self.researcher(user)
        status = body.get('status')
        if status not in ('approved', 'rejected'):
            raise Fault(400, 'Choose approve or reject.')
        if status == 'approved':
            if body.get('pii_reviewed') is not True:
                raise Fault(400, 'Review both texts for identifying or sensitive information before approving.')
            if body.get('human_verdict') not in ('YIELD','NO_YIELD','UNCERTAIN') or body.get('test_kind') not in ('benign_persuasion','policy_attack') or body.get('safety_label') not in ('valid_persuasion','appropriate_refusal','boundary_violation','uncertain') or body.get('strategy') not in STRATEGIES or type(body.get('rating')) is not int or not 1 <= body['rating'] <= 5:
                raise Fault(400, 'Complete the human review labels and a rating from 1 to 5.')
        else:
            for key, choices in (
                ('human_verdict', ('YIELD','NO_YIELD','UNCERTAIN')),
                ('test_kind', ('benign_persuasion','policy_attack')),
                ('safety_label', ('valid_persuasion','appropriate_refusal','boundary_violation','uncertain')),
                ('strategy', STRATEGIES),
            ):
                if body.get(key) is not None and body[key] not in choices:
                    raise Fault(400, 'Invalid human review label.')
            if body.get('rating') is not None and (type(body['rating']) is not int or not 1 <= body['rating'] <= 5):
                raise Fault(400, 'Choose a quality rating from 1 to 5.')
        with self.db() as db:
            row = db.execute('SELECT s.id FROM samples s JOIN contributions c ON c.session_id=s.session_id JOIN campaigns p ON p.id=c.campaign_id WHERE s.id=? AND p.org_id=? AND c.withdrawn=0', (ident,user['org_id'])).fetchone()
            if not row:
                raise Fault(404, 'Sample not found in your workspace.')
            if db.execute('SELECT 1 FROM release_samples WHERE sample_id=?',(ident,)).fetchone():
                raise Fault(409, 'Published examples are locked. Withdrawn contributions are still removed from future exports.')
            prompt = redact(text(body.get('prompt'), 'Reviewed prompt', 1, 12000))
            reply = redact(text(body.get('reply'), 'Reviewed reply', 1, 12000))
            db.execute('UPDATE samples SET prompt=?,reply=?,status=?,human_verdict=?,test_kind=?,safety_label=?,strategy=?,rating=? WHERE id=?', (prompt,reply,status,body.get('human_verdict'),body.get('test_kind'),body.get('safety_label'),body.get('strategy'),body.get('rating'),ident))
            self.audit(db,user,'review',ident)
        return {'ok': True}

    @staticmethod
    def audit(db, user, action, ident):
        db.execute('INSERT INTO audit(user_id,action,object_id,created) VALUES (?,?,?,?)', (user['id'], action, ident, int(time.time())))

    def eligible(self, db, release):
        return db.execute('SELECT s.*,c.notice,c.commercial,c.withdrawn FROM release_samples rs JOIN samples s ON s.id=rs.sample_id JOIN contributions c ON c.session_id=s.session_id WHERE rs.release_id=? AND s.status=? AND c.withdrawn=0 AND c.research=1 AND c.commercial=1 AND s.created>?', (release,'approved',int(time.time())-RETENTION)).fetchall()

    def create_release(self, user, body):
        self.researcher(user)
        price = body.get('price_cents')
        if type(price) is not int or not 0 <= price <= 100000000:
            raise Fault(400, 'Enter a non-negative USD price in cents.')
        title, description = text(body.get('title'),'Dataset title',3,100), text(body.get('description'),'Dataset description',20,1000)
        license_name = text(body.get('license'),'License terms',20,2000)
        with self.db() as db:
            samples = db.execute('SELECT s.id FROM samples s JOIN contributions c ON c.session_id=s.session_id JOIN campaigns p ON p.id=c.campaign_id WHERE p.org_id=? AND s.status=? AND c.withdrawn=0 AND c.research=1 AND c.commercial=1 AND s.created>?', (user['org_id'],'approved',int(time.time())-RETENTION)).fetchall()
            if not samples:
                raise Fault(400, 'Approve at least one commercially consented sample first.')
            ident = secrets.token_urlsafe(18)
            db.execute('INSERT INTO releases VALUES (?,?,?,?,?,?,?)',(ident,user['org_id'],title,description,license_name,price,int(time.time())))
            db.executemany('INSERT INTO release_samples VALUES (?,?)',[(ident,r['id']) for r in samples])
            self.audit(db,user,'publish_release',ident)
        return {'id': ident}

    def catalog(self, user=None):
        with self.db() as db:
            rows = db.execute('SELECT r.*,o.name organization FROM releases r JOIN organizations o ON o.id=r.org_id ORDER BY r.created DESC').fetchall()
            result = []
            for row in rows:
                count = len(self.eligible(db,row['id']))
                if not count:
                    continue
                order = db.execute('SELECT status FROM orders WHERE release_id=? AND buyer_org=?',(row['id'],user['org_id'])).fetchone() if user and user['org_id'] else None
                result.append({**dict(row),'sample_count':count,'currency':'USD','access':'owner' if user and row['org_id']==user['org_id'] else order[0] if order else 'none'})
        return result

    def request_access(self,user,ident):
        self.researcher(user)
        with self.db() as db:
            release = db.execute('SELECT * FROM releases WHERE id=?',(ident,)).fetchone()
            if not release or not self.eligible(db,ident):
                raise Fault(404,'Dataset unavailable.')
            if release['org_id']==user['org_id']:
                raise Fault(400,'Your workspace already owns this dataset.')
            db.execute('INSERT OR IGNORE INTO orders VALUES (?,?,?,?,?)',(secrets.token_urlsafe(18),ident,user['org_id'],'requested',int(time.time())))
            self.audit(db,user,'request_access',ident)
        return {'ok': True, 'message':'Access requested. Pricing and payment are handled directly with the dataset owner; no payment was charged.'}

    def decide_access(self,user,ident,body):
        self.researcher(user)
        status = body.get('status')
        if status not in ('granted','rejected'):
            raise Fault(400,'Choose grant or reject.')
        with self.db() as db:
            row = db.execute('SELECT o.id FROM orders o JOIN releases r ON r.id=o.release_id WHERE o.id=? AND r.org_id=?',(ident,user['org_id'])).fetchone()
            if not row:
                raise Fault(404,'Access request not found in your workspace.')
            db.execute('UPDATE orders SET status=? WHERE id=?',(status,ident))
            self.audit(db,user,status+'_access',ident)
        return {'ok': True}

    def export(self,user,ident):
        self.researcher(user)
        with self.db() as db:
            release = db.execute('SELECT * FROM releases WHERE id=?',(ident,)).fetchone()
            grant = db.execute('SELECT 1 FROM orders WHERE release_id=? AND buyer_org=? AND status=?',(ident,user['org_id'],'granted')).fetchone()
            if not release or (release['org_id']!=user['org_id'] and not grant):
                raise Fault(403,'Your workspace does not have dataset access.')
            rows = self.eligible(db,ident)
            if not rows:
                raise Fault(404,'No eligible samples remain in this release.')
            result = []
            def pseudonym(value):
                return hmac.new(self.export_key,(ident+':'+value).encode(),hashlib.sha256).hexdigest()[:24]
            for row in rows:
                ev = json.loads(row['evaluation'])
                metadata = {key: ev.get(key) for key in ('actor_requested','actor_served','judge_requested','judge_served','rubric_version','rubric_hash','actor_prompt_version','actor_prompt_hash','verdict','confidence','category','exploit_flag','actor_latency_ms','judge_latency_ms')}
                result.append({'sample_id':pseudonym(row['id']),'conversation_id':pseudonym(row['session_id']),'turn':row['turn'], 'prompt':row['prompt'],'response':row['reply'], 'evaluation':metadata,
                    'human_labels':{k:row[k] for k in ('human_verdict','test_kind','safety_label','strategy','rating','participant_rating')},'consent_notice':row['notice']})
            self.audit(db,user,'export',ident)
            manifest = {'id':ident,'title':release['title'],'license':release['license'],'schema_version':'caspy-evaluation-v1','sample_count':len(result), 'exported_at':int(time.time()),'privacy':'Automatically redacted and reviewed by the dataset owner. Anonymity is not guaranteed. IDs are specific to this release. Future exports exclude withdrawn contributions.'}
        return {'manifest':manifest,'samples':result}

    def purge(self):
        if time.monotonic()-self.last_purge < 60:
            return
        self.last_purge = time.monotonic()
        with self.db() as db:
            db.execute('DELETE FROM samples WHERE created<?',(int(time.time())-RETENTION,))
            db.execute('DELETE FROM sessions WHERE expires<?',(int(time.time()),))

    def handle(self, handler, body=None):
        path = urlsplit(handler.path).path
        if not path.startswith(('/account/','/research/','/datasets/','/campaigns')):
            return False
        token = self.cookie_token(handler)
        post = body is not None
        if path in ('/account/register','/account/login') and post:
            token, user = self.authenticate(body,handler.client_address[0],token,path.endswith('register'))
            handler.account_cookie = f'caspy_account={token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=28800'
            handler.json_response(200,{'user':user})
            return True
        if path=='/campaigns' and not post:
            result = {'campaigns':self.campaigns(),'consent_version':NOTICE}
        elif path=='/datasets/catalog' and not post:
            result = {'datasets':self.catalog(self.user(token,False))}
        else:
            user = self.user(token)
            if path=='/account/me' and not post:
                result = {'user':user}
            elif path=='/account/workspace' and post:
                if user['org_id']:
                    raise Fault(409,'Your account already has a research workspace.')
                name = text(body.get('name'),'Workspace name',2,80)
                with self.db() as db:
                    ident = secrets.token_urlsafe(18)
                    db.execute('INSERT INTO organizations VALUES (?,?)',(ident,name))
                    db.execute('UPDATE users SET role=?,org_id=? WHERE id=?',('researcher',ident,user['id']))
                    self.audit(db,user,'create_workspace',ident)
                result = {'user':self.user(token)}
            elif path=='/account/logout' and post:
                with self.db() as db:
                    db.execute('DELETE FROM sessions WHERE token_hash=?',(self.token_hash(token),))
                if handler.server.nft:
                    handler.server.nft.logout(handler.owner())
                handler.account_cookie = 'caspy_account=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0'
                handler.set_cookie(secrets.token_urlsafe(32))
                result = {'ok':True}
            elif path=='/account/contributions' and not post:
                with self.db() as db:
                    result = {'contributions':[dict(r) for r in db.execute('SELECT c.session_id,c.campaign_id,c.research,c.commercial,c.notice,c.withdrawn,c.created,p.name campaign_name,(SELECT count(*) FROM samples s WHERE s.session_id=c.session_id) sample_count FROM contributions c LEFT JOIN campaigns p ON p.id=c.campaign_id WHERE c.user_id=? ORDER BY c.created DESC',(user['id'],))]}
            elif path=='/account/withdraw' and post:
                ident = text(body.get('session_id'),'Heist ID',1,100)
                self.owns_game(user,ident)
                with self.db() as db:
                    db.execute('UPDATE contributions SET withdrawn=1 WHERE session_id=? AND user_id=?',(ident,user['id']))
                    db.execute('DELETE FROM samples WHERE session_id=?',(ident,))
                    self.audit(db,user,'withdraw',ident)
                result = {'ok':True}
            elif path=='/account/feedback' and post:
                ident = text(body.get('session_id'),'Heist ID',1,100)
                self.owns_game(user,ident)
                rating,turn = body.get('rating'),body.get('turn')
                if type(rating) is not int or not 1<=rating<=5 or type(turn) is not int or not 1<=turn<=3:
                    raise Fault(400,'Choose a turn and a rating from 1 to 5.')
                with self.db() as db:
                    if db.execute('SELECT 1 FROM release_samples rs JOIN samples s ON s.id=rs.sample_id WHERE s.session_id=? AND s.turn=?',(ident,turn)).fetchone():
                        raise Fault(409,'Feedback for a published dataset example is locked.')
                    cursor=db.execute('UPDATE samples SET participant_rating=? WHERE session_id=? AND turn=?',(rating,ident,turn))
                    if not cursor.rowcount:
                        raise Fault(400,'Feedback is available only for evaluated, consented turns.')
                result={'ok':True}
            elif path=='/research/dashboard' and not post:
                result=self.dashboard(user)
            elif path=='/research/campaigns' and post:
                result=self.create_campaign(user,body)
            elif re.fullmatch(r'/research/campaigns/[^/]+/archive',path) and post:
                self.researcher(user)
                with self.db() as db:
                    cursor=db.execute('UPDATE campaigns SET active=0 WHERE id=? AND org_id=?',(path.split('/')[3],user['org_id']))
                    if not cursor.rowcount:
                        raise Fault(404,'Campaign not found in your workspace.')
                result={'ok':True}
            elif re.fullmatch(r'/research/samples/[^/]+/review',path) and post:
                result=self.review_sample(user,path.split('/')[3],body)
            elif path=='/research/releases' and post:
                result=self.create_release(user,body)
            elif re.fullmatch(r'/datasets/[^/]+/request',path) and post:
                result=self.request_access(user,path.split('/')[2])
            elif re.fullmatch(r'/research/orders/[^/]+/decision',path) and post:
                result=self.decide_access(user,path.split('/')[3],body)
            elif re.fullmatch(r'/datasets/[^/]+/export',path) and not post:
                result=self.export(user,path.split('/')[2])
            else:
                raise Fault(404,'Platform endpoint not found.')
        handler.json_response(200,result)
        return True
