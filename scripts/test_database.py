"""Adapter unit checks plus opt-in reuse of app tests against private PG schemas."""
import unittest
from database import postgres_sql, Row, database_url, DatabaseError


class AdapterTests(unittest.TestCase):
    def test_bound_values_and_literal_question_marks(self):
        self.assertEqual(postgres_sql("SELECT '?' AS literal, name FROM users WHERE id=? AND note='it''s ?'"),
                         "SELECT '?' AS literal, name FROM users WHERE id=%s AND note='it''s ?'")
        self.assertEqual(postgres_sql('INSERT OR IGNORE INTO settings VALUES (?,?)'),
                         'INSERT INTO settings VALUES (%s,%s) ON CONFLICT DO NOTHING')

    def test_row_compatibility(self):
        row=Row(['id','name'],('one','Player'))
        self.assertEqual(row[0],row['id'])
        self.assertEqual(dict(row),{'id':'one','name':'Player'})

    def test_no_missing_or_placeholder_runtime_database(self):
        for value in ('','sqlite:///file','postgresql://u:[YOUR_PASSWORD]@host/db'):
            with self.assertRaises(DatabaseError): database_url({'SUPABASE_DB_URL':value})
