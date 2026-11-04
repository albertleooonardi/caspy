"""Migration safeguards/precision tests using disposable legacy fixtures only."""
import datetime as dt
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest
from unittest.mock import patch,MagicMock
from urllib.parse import urlsplit,unquote
from migrate_supabase import snapshot,digest,cell,role_url,stopped


class MigrationTests(unittest.TestCase):
    def test_wal_binary_and_partial_index_survive_lossless_snapshot(self):
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/'legacy.db'
            with sqlite3.connect(path) as connection:
                connection.execute('PRAGMA journal_mode=WAL')
                connection.execute('CREATE TABLE examples(id INTEGER PRIMARY KEY, content BLOB, label TEXT)')
                connection.execute("CREATE UNIQUE INDEX examples_label ON examples(label) WHERE label IS NOT NULL")
                connection.execute('INSERT INTO examples VALUES (?,?,?)',(1,b'\x00\xff','fictional'))
                connection.commit()
                before=path.read_bytes()
                payload=snapshot(path)
                row=payload['tables'][0]['rows'][0]
                self.assertEqual(cell(row[1],'BYTEA'),b'\x00\xff')
                self.assertIn('WHERE label IS NOT NULL',payload['tables'][0]['indexes'][0]['ddl'])
                self.assertEqual(digest(payload),digest(json.loads(json.dumps(payload))))
                self.assertEqual(path.read_bytes(),before)

    def test_variable_precision_go_timestamps_preserve_microseconds(self):
        value=cell('2026-11-01 16:55:08.93603+07:00','TIMESTAMPTZ')
        self.assertEqual(value.microsecond,936030)
        self.assertEqual(value.astimezone(dt.timezone.utc).hour,9)

    def test_pooler_role_routing_and_password_escaping(self):
        value=role_url('postgresql://postgres.project:old@aws-0-example.pooler.supabase.com:5432/postgres','caspy_bifrost_logs','test@:/#password')
        parsed=urlsplit(value)
        self.assertEqual(unquote(parsed.username),'caspy_bifrost_logs.project')
        self.assertEqual(unquote(parsed.password),'test@:/#password')

    def test_live_writer_blocks_migration_and_removal(self):
        connection=MagicMock()
        connection.__enter__.return_value=connection
        connection.connect_ex.return_value=0
        with patch('migrate_supabase.socket.socket',return_value=connection):
            with self.assertRaises(RuntimeError):stopped()
