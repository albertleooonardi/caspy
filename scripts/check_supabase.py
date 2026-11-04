#!/usr/bin/env python3
"""Read-only startup checks. No secrets, query bodies or row values are logged."""
import json
import sys
import psycopg
from bifrost_setup import ROOT, environment
from database import database_url


def main():
    env=environment(ROOT)
    dsn=database_url(env)
    with psycopg.connect(dsn,sslmode='require',connect_timeout=10,prepare_threshold=None) as connection:
        for table in ('users','sessions','settings','candy_jobs'):
            if not connection.execute('SELECT to_regclass(%s)',('caspy.'+table,)).fetchone()[0]:
                raise RuntimeError('Supabase schema not initialized. Run the migration before starting Caspy.')
    config=json.loads((ROOT/'data/config.json').read_text())
    for key in ('config_store','logs_store'):
        store=config.get(key,{})
        if not store.get('enabled') or store.get('type')!='postgres':
            raise RuntimeError('Bifrost must use PostgreSQL for both stores; SQLite fallback is disabled.')
        values={}
        for field in ('host','port','user','password','db_name'):
            value=store['config'][field]
            values[field]=env.get(value[4:],'') if value.startswith('env.') else value
        with psycopg.connect(host=values['host'],port=values['port'],user=values['user'],password=values['password'],dbname=values['db_name'],sslmode='require',connect_timeout=10) as connection:
            expected='caspy_bifrost_config' if key=='config_store' else 'caspy_bifrost_logs'
            actual=connection.execute('SELECT current_schema()').fetchone()[0]
            if actual!=expected: raise RuntimeError('Bifrost role has an unexpected default schema.')
    print('Supabase ready: Caspy database and both isolated PostgreSQL Bifrost stores connected.')


if __name__=='__main__':
    try: main()
    except Exception as error:
        print(str(error) if isinstance(error,RuntimeError) else 'Supabase check failed; verify network/credentials (details hidden).',file=sys.stderr)
        raise SystemExit(1)
