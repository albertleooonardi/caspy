"""Friend codes and friendships for Caspy accounts.

Players find each other only through a private friend code that the owner
chooses to share. There is no name/email search, so accounts cannot be
enumerated. Responses never include email addresses or internal user IDs.
"""
import re
import secrets
import time

from platform_store import Fault

# Unambiguous characters only (no 0/O, 1/I/L).
ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
CODE_LENGTH = 8
MAX_FRIENDS = 200
MAX_OUTGOING = 50
MAX_FAILED_LOOKUPS = 10
LOOKUP_WINDOW = 600

SCHEMA = '''
CREATE TABLE IF NOT EXISTS friend_codes(user_id TEXT PRIMARY KEY REFERENCES users(id),
    code TEXT UNIQUE NOT NULL, created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS friendships(id TEXT PRIMARY KEY, pair TEXT UNIQUE NOT NULL,
    requester TEXT NOT NULL REFERENCES users(id), addressee TEXT NOT NULL REFERENCES users(id),
    status TEXT NOT NULL, created INTEGER NOT NULL, updated INTEGER NOT NULL);
'''


def normalize_code(value):
    if not isinstance(value, str):
        raise Fault(400, 'Enter the 8-character friend code.')
    code = re.sub(r'[\s\-]', '', value).upper()
    if not re.fullmatch('[' + ALPHABET + ']{' + str(CODE_LENGTH) + '}', code):
        raise Fault(400, 'Enter the 8-character friend code.')
    return code


def display_code(code):
    return code[:4] + '-' + code[4:]


class Social:
    def __init__(self, platform):
        self.platform = platform
        with platform.db() as db:
            db.executescript(SCHEMA)
            if platform.database.postgres:
                for table in ('friend_codes', 'friendships'):
                    db.execute(f'ALTER TABLE {table} ENABLE ROW LEVEL SECURITY')
                    db.execute(f'REVOKE ALL ON {table} FROM PUBLIC, anon, authenticated')

    # -- helpers -----------------------------------------------------------
    @staticmethod
    def pair(first, second):
        return ':'.join(sorted((first, second)))

    @staticmethod
    def new_code(db):
        while True:
            code = ''.join(secrets.choice(ALPHABET) for _ in range(CODE_LENGTH))
            if not db.execute('SELECT 1 FROM friend_codes WHERE code=?', (code,)).fetchone():
                return code

    def code_for(self, db, user_id):
        row = db.execute('SELECT code FROM friend_codes WHERE user_id=?', (user_id,)).fetchone()
        if row:
            return row[0]
        code = self.new_code(db)
        db.execute('INSERT INTO friend_codes VALUES (?,?,?)', (user_id, code, int(time.time())))
        return code

    @staticmethod
    def friend_count(db, user_id):
        return db.execute("SELECT count(*) FROM friendships WHERE status='accepted' AND (requester=? OR addressee=?)", (user_id, user_id)).fetchone()[0]

    def check_lookup_budget(self, db, user_id):
        now = int(time.time())
        key = 'social:' + user_id
        db.execute('DELETE FROM login_attempts WHERE ip=? AND created<?', ('social', now - LOOKUP_WINDOW))
        failed = db.execute('SELECT count(*) FROM login_attempts WHERE ip=? AND email=?', ('social', key)).fetchone()[0]
        if failed >= MAX_FAILED_LOOKUPS:
            raise Fault(429, 'Too many unknown friend codes. Check the code with your friend and try again in ten minutes.')

    @staticmethod
    def record_failed_lookup(db, user_id):
        db.execute('INSERT INTO login_attempts VALUES (?,?,?)', ('social', 'social:' + user_id, int(time.time())))

    def person(self, row):
        return {'id': row['id'], 'name': row['name'], 'avatar_url': self.platform.avatar_url(row['avatar_image_hash']), 'at': row['updated']}

    # -- reads -------------------------------------------------------------
    def overview(self, user):
        me = user['id']
        with self.platform.db() as db:
            code = self.code_for(db, me)
            rows = db.execute(
                'SELECT f.id,f.requester,f.status,f.updated,u.name,p.avatar_image_hash '
                'FROM friendships f JOIN users u ON u.id=CASE WHEN f.requester=? THEN f.addressee ELSE f.requester END '
                'LEFT JOIN profiles p ON p.user_id=u.id '
                "WHERE (f.requester=? OR f.addressee=?) AND f.status IN ('pending','accepted') ORDER BY f.updated DESC",
                (me, me, me)).fetchall()
        friends, incoming, outgoing = [], [], []
        for row in rows:
            if row['status'] == 'accepted':
                friends.append(self.person(row))
            elif row['requester'] == me:
                outgoing.append(self.person(row))
            else:
                incoming.append(self.person(row))
        friends.sort(key=lambda item: item['name'].lower())
        return {'code': display_code(code), 'friends': friends, 'incoming': incoming, 'outgoing': outgoing,
                'limits': {'friends': MAX_FRIENDS, 'outgoing': MAX_OUTGOING}}

    # -- writes ------------------------------------------------------------
    def regenerate_code(self, user):
        with self.platform.db() as db:
            code = self.new_code(db)
            self.code_for(db, user['id'])
            db.execute('UPDATE friend_codes SET code=?,created=? WHERE user_id=?', (code, int(time.time()), user['id']))
            self.platform.audit(db, user, 'friend_code_reset', user['id'])
        return {'code': display_code(code)}

    def send(self, user, body):
        if set(body) != {'code'}:
            raise Fault(400, 'Enter the 8-character friend code.')
        code, me, now = normalize_code(body['code']), user['id'], int(time.time())
        with self.platform.db() as db:
            self.check_lookup_budget(db, me)
            target = db.execute('SELECT f.user_id,u.name FROM friend_codes f JOIN users u ON u.id=f.user_id WHERE f.code=?', (code,)).fetchone()
            if not target:
                self.record_failed_lookup(db, me)  # Committed when this block exits normally.
        if not target:
            raise Fault(404, 'No player found with that friend code.')
        with self.platform.db() as db:
            other, name = target['user_id'], target['name']
            if other == me:
                raise Fault(400, 'That is your own friend code. Share it with a friend instead.')
            existing = db.execute('SELECT * FROM friendships WHERE pair=?', (self.pair(me, other),)).fetchone()
            if existing and existing['status'] == 'accepted':
                raise Fault(409, f'You and {name} are already friends.')
            if existing and existing['status'] == 'pending':
                if existing['requester'] == me:
                    raise Fault(409, f'You already sent {name} a friend request.')
                self.accept_row(db, user, existing)
                return {'status': 'accepted', 'message': f'You and {name} are now friends.'}
            if existing and existing['requester'] == me:  # I was declined; do not allow re-sending.
                raise Fault(409, 'This friend request cannot be sent.')
            if self.friend_count(db, me) >= MAX_FRIENDS:
                raise Fault(409, 'Your friend list is full.')
            outgoing = db.execute("SELECT count(*) FROM friendships WHERE requester=? AND status='pending'", (me,)).fetchone()[0]
            if outgoing >= MAX_OUTGOING:
                raise Fault(409, 'Too many pending requests. Wait for replies or cancel some.')
            if existing:  # I had declined them earlier; now I am asking.
                db.execute("UPDATE friendships SET requester=?,addressee=?,status='pending',updated=? WHERE id=?", (me, other, now, existing['id']))
                ident = existing['id']
            else:
                ident = secrets.token_urlsafe(12)
                db.execute('INSERT INTO friendships VALUES (?,?,?,?,?,?,?)', (ident, self.pair(me, other), me, other, 'pending', now, now))
            self.platform.audit(db, user, 'friend_request', ident)
        return {'status': 'pending', 'message': f'Friend request sent to {name}.'}

    def accept_row(self, db, user, row):
        me, other = user['id'], row['requester']
        if self.friend_count(db, me) >= MAX_FRIENDS or self.friend_count(db, other) >= MAX_FRIENDS:
            raise Fault(409, 'A friend list is full, so this request cannot be accepted.')
        db.execute("UPDATE friendships SET status='accepted',updated=? WHERE id=?", (int(time.time()), row['id']))
        self.platform.audit(db, user, 'friend_accept', row['id'])

    def respond(self, user, ident, action):
        me = user['id']
        with self.platform.db() as db:
            row = db.execute('SELECT * FROM friendships WHERE id=? AND (requester=? OR addressee=?)', (ident, me, me)).fetchone()
            if not row:
                raise Fault(404, 'That friend request or friend was not found.')
            status = row['status']
            if action == 'accept':
                if row['addressee'] != me:
                    raise Fault(403, 'Only the invited player can accept a request.')
                if status == 'pending':
                    self.accept_row(db, user, row)
                elif status != 'accepted':
                    raise Fault(409, 'This request is no longer open.')
            elif action == 'decline':
                if row['addressee'] != me:
                    raise Fault(403, 'Only the invited player can decline a request.')
                if status == 'pending':
                    db.execute("UPDATE friendships SET status='declined',updated=? WHERE id=?", (int(time.time()), ident))
                    self.platform.audit(db, user, 'friend_decline', ident)
                elif status != 'declined':
                    raise Fault(409, 'This request is no longer open.')
            elif action == 'cancel':
                if row['requester'] != me or status != 'pending':
                    raise Fault(409, 'Only your own pending request can be cancelled.')
                db.execute('DELETE FROM friendships WHERE id=?', (ident,))
                self.platform.audit(db, user, 'friend_cancel', ident)
            elif action == 'remove':
                if status != 'accepted':
                    raise Fault(409, 'You are not friends with this player.')
                db.execute('DELETE FROM friendships WHERE id=?', (ident,))
                self.platform.audit(db, user, 'friend_remove', ident)
            else:
                raise Fault(404, 'Platform endpoint not found.')
        return {'ok': True}
