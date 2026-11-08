"""Opt-in real Supabase regression in disposable private test schemas.

CASPY_RUN_SUPABASE_TESTS=1 .venv/bin/python -m unittest discover -s scripts -p test_supabase.py -v
Uses fictional fixture data, never the migrated application schema. Own temporary
schemas are dropped after each test. No AI/image/chain/provider calls are made.
"""
import os
import secrets
import unittest
from unittest.mock import patch
import psycopg
from psycopg import sql
from bifrost_setup import ROOT,environment
from database import database_url
from platform_store import Platform
import test_platform_store
import test_candy_store
import test_platform_http
import test_cloud_storage
import test_wallet_sessions
from database import Database


class SupabaseFixture:
    def setUp(self):
        self.dsn=database_url(environment(ROOT))
        self.schema='caspy_test_'+secrets.token_hex(8)
        with psycopg.connect(self.dsn,sslmode='require',connect_timeout=10) as connection:
            connection.execute(sql.SQL('CREATE SCHEMA {}').format(sql.Identifier(self.schema)))
            connection.execute(sql.SQL('REVOKE ALL ON SCHEMA {} FROM PUBLIC, anon, authenticated').format(sql.Identifier(self.schema)))
        self.addCleanup(self.drop_schema)
        factory=lambda target,*args,**kwargs: Platform(self.dsn,*args,schema=self.schema,**kwargs)
        for module in (test_platform_store,test_candy_store,test_platform_http,test_cloud_storage):
            context=patch.object(module,'Platform',factory)
            context.start();self.addCleanup(context.stop)
        super().setUp()

    def drop_schema(self):
        # Only the exact random fixture schema created by this test is removable.
        with psycopg.connect(self.dsn,sslmode='require',connect_timeout=10) as connection:
            connection.execute(sql.SQL('DROP SCHEMA {} CASCADE').format(sql.Identifier(self.schema)))


enabled=os.environ.get('CASPY_RUN_SUPABASE_TESTS')=='1'
@unittest.skipUnless(enabled,'Opt in to live Supabase fixture tests.')
class SupabasePlatformTests(SupabaseFixture,test_platform_store.PlatformTests): pass

@unittest.skipUnless(enabled,'Opt in to live Supabase fixture tests.')
class SupabaseCandyTests(SupabaseFixture,test_candy_store.CandyTests):
    def test_old_wallet_constraint_migrates_without_changing_existing_reward(self):
        first=self.earn()
        with self.platform.db() as db:
            db.execute('ALTER TABLE candy_jobs ADD CONSTRAINT candy_jobs_namespace_wallet_key UNIQUE(namespace,wallet)')
            db.execute('CREATE UNIQUE INDEX candy_jobs_migrated_0 ON candy_jobs(namespace,wallet)')
            db.execute('CREATE INDEX candy_wallet_lookup ON candy_jobs(wallet)')
        self.candy.close()
        self.candy=test_candy_store.CandyStore(self.platform,test_candy_store.FakeNFT(),self.root/'assets',self.renderer)
        second=self.candy.ensure_win(test_candy_store.winner('two'),self.user,'wallet-one')
        self.assertNotEqual(first['session_id'],second['session_id'])
        self.assertEqual(self.candy.public(self.candy.row('one')),first)
        with self.platform.db() as db:
            indexes={row[0] for row in db.execute("SELECT indexname FROM pg_indexes WHERE schemaname=? AND tablename='candy_jobs'",(self.schema,))}
            self.assertIn('candy_jobs_pkey',indexes)
            self.assertIn('candy_wallet_lookup',indexes)
            self.assertNotIn('candy_jobs_migrated_0',indexes)
            self.assertNotIn('candy_jobs_namespace_wallet_key',indexes)

@unittest.skipUnless(enabled and os.environ.get('CASPY_RUN_HTTP_TESTS')=='1','Opt in to live Supabase HTTP tests.')
class SupabaseHTTPTests(SupabaseFixture,test_platform_http.PlatformHTTPTests): pass

@unittest.skipUnless(enabled,'Opt in to live Supabase cloud storage fixtures.')
class SupabaseCloudStorageTests(SupabaseFixture,test_cloud_storage.CloudStorageTests): pass


@unittest.skipUnless(enabled,'Opt in to live Supabase wallet session fixtures.')
class SupabaseWalletSessionTests(SupabaseFixture,test_wallet_sessions.WalletSessionTests):
    def setUp(self):
        super().setUp()
        self.database = Database(self.dsn, schema=self.schema)

    def test_private_table_permissions(self):
        self.instance()
        with self.database.connect() as db:
            row = db.execute("SELECT relrowsecurity FROM pg_class WHERE oid='wallet_sessions'::regclass").fetchone()
            self.assertTrue(row[0])
            for role in ('anon', 'authenticated'):
                self.assertFalse(db.execute("SELECT has_table_privilege(?, 'wallet_sessions', 'SELECT')", (role,)).fetchone()[0])
