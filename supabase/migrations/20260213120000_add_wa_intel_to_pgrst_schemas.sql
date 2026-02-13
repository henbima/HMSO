-- Migration: Add wa_intel schema to PostgREST exposed schemas
-- Purpose: The wa_intel schema was missing from pgrst.db_schemas, causing all API queries to fail
-- The frontend could not load groups, messages, briefings, or any wa_intel data

ALTER ROLE authenticator SET pgrst.db_schemas TO 'public, hmbi, hm_core, storage, graphql_public, hmisc, wa_intel';
NOTIFY pgrst, 'reload config';
