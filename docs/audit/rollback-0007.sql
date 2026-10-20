-- Do not put seed-token-* back. That string is public and is no longer a credential.
--
-- 0007 only replaced access_token on demonstration rows whose token matched
-- the public pattern. Amounts, status, and inventory were not changed.
-- If the migration committed, deleting this record does not restore the old
-- tokens. Re-applying 0007 is then a no-op because those tokens are gone.
-- If a non-demonstration row was ever changed, restore that row's access_token
-- from a backup taken before 0007. Do not invent a token in this file.

delete from _migrations where name = '0007_retire_seed_tokens.sql';
