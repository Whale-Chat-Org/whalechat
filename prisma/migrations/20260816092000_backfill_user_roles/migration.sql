-- Move role assignments from the `user.role` string onto `user_role`, which is
-- the source of truth from here on. The column stays, as a mirror — Better
-- Auth's admin plugin reads it to authorize its own endpoints.
--
-- Additive only: no column is dropped and no existing value is lost. An
-- instance running the old code against a database that has had this applied
-- keeps working, which is what makes it safe to deploy ahead of the code.

-- The two roles the system guarantees. `prisma/seed.ts` upserts these as well;
-- creating them here too is what lets the backfill below run on a database the
-- seed has never touched.
INSERT INTO "auth_role" ("id", "key", "name", "description", "system", "createdAt", "updatedAt")
VALUES
  ('rbac_role_admin', 'admin', 'Administrator', 'Full access to every part of the instance.', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rbac_role_user', 'user', 'Member', 'Can use the chat. No administrative access.', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

-- Split the mirror on commas even though it only ever holds one key today. It
-- costs nothing, and it keeps this correct if it is ever replayed against a
-- database that already has multi-role mirrors.
INSERT INTO "user_role" ("userId", "roleId", "assignedAt")
SELECT u."id", r."id", CURRENT_TIMESTAMP
FROM "user" u
CROSS JOIN LATERAL unnest(string_to_array(u."role", ',')) AS t(role_key)
JOIN "auth_role" r ON r."key" = btrim(t.role_key)
WHERE btrim(t.role_key) <> ''
ON CONFLICT ("userId", "roleId") DO NOTHING;

-- Rewrite the mirror from what was just inserted, so it comes out of this
-- migration in the canonical form `lib/access.ts` writes: sorted, deduplicated,
-- comma-joined. Nothing depends on the old ordering, and starting normalized
-- means the first real assignment is a genuine diff rather than a reformat.
UPDATE "user" u
SET "role" = m.mirror
FROM (
  SELECT ur."userId" AS user_id, string_agg(r."key", ',' ORDER BY r."key") AS mirror
  FROM "user_role" ur
  JOIN "auth_role" r ON r."id" = ur."roleId"
  GROUP BY ur."userId"
) m
WHERE u."id" = m.user_id
  AND u."role" IS DISTINCT FROM m.mirror;
