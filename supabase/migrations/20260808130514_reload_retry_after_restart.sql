-- A prior schema-cache reload notification did not take effect even after a manual
-- project restart (Settings → General → Restart project). Retried once more post-restart
-- in case a fresh PostgREST listener connection picks it up where the earlier attempt,
-- sent before the restart, could not.
notify pgrst, 'reload schema';
