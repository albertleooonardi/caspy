"""Small single-replica preview snapshots in the private application database.

This is not a distributed game engine. Only one API replica may write a given
deployment namespace. Nothing is exported to public Supabase schemas.
"""
import json


class DatabaseSnapshots:
    def __init__(self, platform, namespace):
        self.platform,self.namespace=platform,namespace
        with platform.db() as db:
            db.execute('CREATE TABLE IF NOT EXISTS game_snapshots(namespace TEXT PRIMARY KEY,payload TEXT NOT NULL)')
            if platform.database.postgres:
                db.execute('ALTER TABLE game_snapshots ENABLE ROW LEVEL SECURITY')
                db.execute('REVOKE ALL ON game_snapshots FROM anon, authenticated')

    def load(self):
        with self.platform.db() as db:
            row=db.execute('SELECT payload FROM game_snapshots WHERE namespace=?',(self.namespace,)).fetchone()
        return json.loads(row['payload']) if row else {}

    def save(self, value):
        payload=json.dumps(value)
        with self.platform.db() as db:
            db.execute('INSERT INTO game_snapshots(namespace,payload) VALUES (?,?) ON CONFLICT(namespace) DO UPDATE SET payload=excluded.payload',(self.namespace,payload))
