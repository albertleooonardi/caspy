-- PostgreSQL-only helper from Bifrost's logs_add_safe_jsonb_function migration.
-- SQLite records that migration as a no-op. Copying its migration marker alone
-- would leave SearchLogs calling a missing function after a cross-engine move.
CREATE OR REPLACE FUNCTION bifrost_safe_jsonb(t text) RETURNS text
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
    j jsonb;
BEGIN
    IF t IS NULL OR t = '' OR t = '[]' THEN RETURN t; END IF;
    IF left(btrim(t), 1) <> '[' THEN RETURN t; END IF;
    BEGIN
        j := t::jsonb;
    EXCEPTION WHEN invalid_text_representation OR untranslatable_character THEN
        RETURN t;
    END;
    IF jsonb_typeof(j) <> 'array' OR jsonb_array_length(j) = 0 THEN RETURN t; END IF;
    RETURN jsonb_build_array(j->-1)::text;
END;
$$;
