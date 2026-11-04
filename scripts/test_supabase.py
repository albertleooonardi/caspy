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


class SupabaseFixture:
    def setUp(self):
        self.dsn=database_url(environment(ROOT))
        self.schema='caspy_test_'+secrets.token_hex(8)
        with psycopg.connect(self.dsn,sslmode='require',connect_timeout=10) as connection:
            connection.execute(sql.SQL('CREATE SCHEMA {}').format(sql.Identifier(self.schema)))
            connection.execute(sql.SQL('REVOKE ALL ON SCHEMA {} FROM PUBLIC, anon, authenticated').format(sql.Identifier(self.schema)))
        self.addCleanup(self.drop_schema)
        factory=lambda target,*args,**kwargs: Platform(self.dsn,*args,schema=self.schema,**kwargs)
        for module in (test_platform_store,test_candy_store,test_platform_http):
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
class SupabaseCandyTests(SupabaseFixture,test_candy_store.CandyTests): pass

@unittest.skipUnless(enabled and os.environ.get('CASPY_RUN_HTTP_TESTS')=='1','Opt in to live Supabase HTTP tests.')
class SupabaseHTTPTests(SupabaseFixture,test_platform_http.PlatformHTTPTests): pass
