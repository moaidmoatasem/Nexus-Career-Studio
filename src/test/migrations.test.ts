// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { beforeAll, describe, expect, it } from "vitest";

// Replays every migration against PGlite so SQL mistakes (like the old 42P10 upsert) fail CI.
// Supabase provides roles, the auth and storage schemas and extensions; small stand-ins below.

const MIGRATIONS_DIR = path.resolve(__dirname, "../../supabase/migrations");

const SUPABASE_STAND_INS = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin;
  create schema extensions;
  create extension pg_trgm with schema extensions;
  grant usage on schema extensions to anon, authenticated, service_role;
  create schema auth;
  grant usage on schema auth to anon, authenticated, service_role;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    raw_user_meta_data jsonb not null default '{}'::jsonb
  );
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function auth.role() returns text language sql stable
    as $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon') $$;
  create schema storage;
  grant usage on schema storage to anon, authenticated, service_role;
  create table storage.buckets (id text primary key, name text not null, public boolean default false);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable
    as $$ select string_to_array(name, '/') $$;
`;

let db: PGlite;

const USER_A = "00000000-0000-0000-0000-00000000000a";
const USER_B = "00000000-0000-0000-0000-00000000000b";

/** Runs a statement as an authenticated user, with RLS applied, and rolls the role back afterwards. */
async function asUser<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  await db.exec(
    `set role authenticated; select set_config('request.jwt.claim.sub', '${userId}', false);`,
  );
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  }
}

async function sqlState(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
  } catch (e) {
    return (e as { code?: string }).code ?? "unknown";
  }
  return undefined;
}

beforeAll(async () => {
  db = new PGlite({ extensions: { pg_trgm } });
  await db.exec(SUPABASE_STAND_INS);
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    try {
      await db.exec(readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"));
    } catch (e) {
      throw new Error(`Migration ${file} failed: ${(e as Error).message}`);
    }
  }
  await db.exec(
    `insert into auth.users (id, email) values ('${USER_A}', 'a@example.com'), ('${USER_B}', 'b@example.com')`,
  );
  await db.exec(`
    insert into public.sponsors (organisation_name, organisation_normalized, town_city, route)
    values ('Acme Robotics Limited', public.normalize_company_name('Acme Robotics Limited'), 'Leeds', 'Skilled Worker'),
           ('Globex Engineering Ltd', public.normalize_company_name('Globex Engineering Ltd'), 'London', 'Skilled Worker')
  `);
}, 120_000);

describe("migrations", () => {
  it("replay in filename order without errors", async () => {
    const { rows } = await db.query<{ n: number }>(
      "select count(*)::int as n from information_schema.tables where table_schema = 'public'",
    );
    expect(rows[0]!.n).toBeGreaterThan(10);
  });

  it("reject a duplicate job for the same user and url with 23505", async () => {
    const insert = () =>
      db.query(
        `insert into public.jobs (user_id, title, company_name, job_url, canonical_url)
         values ('${USER_A}', 'Engineer', 'Acme', 'https://acme.example/jobs/1', 'https://acme.example/jobs/1')`,
      );
    await insert();
    expect(await sqlState(insert())).toBe("23505");
  });

  it("match_sponsor_company_v3 finds an exact and a fuzzy name", async () => {
    const exact = await db.query<{ organisation_name: string }>(
      "select organisation_name from public.match_sponsor_company_v3('Acme Robotics Limited')",
    );
    expect(exact.rows[0]?.organisation_name).toBe("Acme Robotics Limited");

    const fuzzy = await db.query<{ organisation_name: string }>(
      "select organisation_name from public.match_sponsor_company_v3('Globex Engineerin')",
    );
    expect(fuzzy.rows[0]?.organisation_name).toBe("Globex Engineering Ltd");

    const none = await db.query(
      "select * from public.match_sponsor_company_v3('Zzyzx Unknown Holdings')",
    );
    expect(none.rows).toHaveLength(0);
  });

  describe("portal_tasks insert policy", () => {
    let jobId: string;
    let applicationId: string;

    beforeAll(async () => {
      const job = await db.query<{ id: string }>(
        `insert into public.jobs (user_id, title, company_name, job_url, canonical_url)
         values ('${USER_A}', 'Designer', 'Globex', 'https://globex.example/jobs/9', 'https://globex.example/jobs/9')
         returning id`,
      );
      jobId = job.rows[0]!.id;
      const app = await db.query<{ id: string }>(
        `insert into public.applications (user_id, job_id) values ('${USER_A}', '${jobId}') returning id`,
      );
      applicationId = app.rows[0]!.id;
    });

    const queue = (userId: string, appId: string, url: string) =>
      asUser(userId, () =>
        db.query(
          "insert into public.portal_tasks (user_id, application_id, portal_url) values ($1, $2, $3)",
          [userId, appId, url],
        ),
      );

    it("accepts the https link of the user's own application", async () => {
      await expect(
        queue(USER_A, applicationId, "https://globex.example/jobs/9"),
      ).resolves.toBeDefined();
    });

    it("rejects another user's application", async () => {
      const code = await sqlState(queue(USER_B, applicationId, "https://globex.example/jobs/9"));
      expect(code).toBe("42501");
    });

    it("rejects a non-https link", async () => {
      const code = await sqlState(queue(USER_A, applicationId, "http://globex.example/jobs/9"));
      expect(code).toBe("42501");
    });

    it("rejects a link that is not the application's posting, such as the metadata address", async () => {
      const code = await sqlState(queue(USER_A, applicationId, "https://169.254.169.254/"));
      expect(code).toBe("42501");
    });
  });

  describe("consume_usage", () => {
    const take = async (user: string, kind: string, limit: number) =>
      (
        await db.query<{ ok: boolean }>("select public.consume_usage($1, $2, $3) as ok", [
          user,
          kind,
          limit,
        ])
      ).rows[0]!.ok;

    it("allows exactly the limit per user per kind per day, then refuses", async () => {
      expect([
        await take(USER_A, "ai", 2),
        await take(USER_A, "ai", 2),
        await take(USER_A, "ai", 2),
      ]).toEqual([true, true, false]);
      expect(await take(USER_B, "ai", 2)).toBe(true);
      expect(await take(USER_A, "firecrawl", 2)).toBe(true);
      const { rows } = await db.query<{ count: number }>(
        "select count from public.usage_counters where user_id = $1 and kind = 'ai'",
        [USER_A],
      );
      expect(rows[0]!.count).toBe(2);
    });

    it("refuses a zero or missing limit and an unknown kind", async () => {
      expect(await take(USER_B, "firecrawl", 0)).toBe(false);
      expect(await sqlState(take(USER_B, "bogus", 5))).toBe("23514");
    });

    it("is not callable, and the counters are not readable, by signed-in users", async () => {
      const call = () =>
        asUser(USER_A, () => db.query("select public.consume_usage($1, 'ai', 5)", [USER_A]));
      expect(await sqlState(call())).toBe("42501");
      const read = () => asUser(USER_A, () => db.query("select * from public.usage_counters"));
      expect(await sqlState(read())).toBe("42501");
    });
  });
});
