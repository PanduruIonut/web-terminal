#!/usr/bin/env node
/**
 * Seeds the CTF data into the Redis store. The original Vercel KV store was
 * deleted when Vercel retired KV, taking the flags with it, so a fresh store
 * needs this run once before the `ctf` commands work.
 *
 * Usage:
 *   vercel env pull .env          # get KV_REST_API_* for the new store
 *   node --env-file=.env scripts/seed-ctf.mjs 'CTF{first}' 'CTF{second}'
 *
 * Re-running is safe: it overwrites the two flag keys and rebuilds the set of
 * accepted values, so the revealed flags and the accepted flags cannot drift
 * apart. It never touches the `users` leaderboard.
 */
import { isConfigured, redis } from "../lib/redis.js";

const [flag1, flag2] = process.argv.slice(2);

if (!flag1 || !flag2) {
    console.error("Usage: node --env-file=.env scripts/seed-ctf.mjs '<flag-1>' '<flag-2>'");
    process.exit(1);
}

if (flag1 === flag2) {
    console.error("The two flags must be different from each other.");
    process.exit(1);
}

if (!isConfigured()) {
    console.error(
        "Missing store credentials. Set KV_REST_API_URL and KV_REST_API_TOKEN\n" +
        "(or UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN), e.g. by running\n" +
        "`vercel env pull .env` and passing `--env-file=.env` to node."
    );
    process.exit(1);
}

try {
    await redis(["SET", "flag-1", flag1]);
    await redis(["SET", "flag-2", flag2]);

    // Rebuild rather than add to, so stale values from an earlier seed stop validating.
    await redis(["DEL", "flags"]);
    await redis(["SADD", "flags", flag1, flag2]);

    const accepted = await redis(["SMEMBERS", "flags"]);
    const solvers = await redis(["SMEMBERS", "users"]);

    console.log("Seeded the CTF store.");
    console.log(`  flag-1        ${flag1}`);
    console.log(`  flag-2        ${flag2}`);
    console.log(`  accepted      ${accepted.length} value(s)`);
    console.log(`  leaderboard   ${solvers.length} solver(s) (left untouched)`);
} catch (error) {
    console.error("Seeding failed:", error.message);
    process.exit(1);
}
