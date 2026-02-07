/*
  # Expose wa_intel schema to PostgREST API

  1. Configuration Change
    - Adds `wa_intel` to the list of schemas exposed by PostgREST
    - This allows the Supabase JS client to query tables in the `wa_intel` schema
    - Preserves existing exposed schemas: public, graphql_public, training

  2. Important Notes
    - Without this change, all API calls to wa_intel tables fail with PGRST106
    - The listener service and frontend both need this to function
*/

ALTER ROLE authenticator SET pgrst.db_schemas TO 'public, graphql_public, training, wa_intel';

NOTIFY pgrst, 'reload config';
