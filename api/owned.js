import { isConfigured, redis } from "../lib/redis.js";

const MAX_NAME_LENGTH = 32;

// Someone who holds both flags could submit a stream of different names. This
// turns that from a flood into a trickle without blocking the submissions
// themselves — the leaderboard still records every one of them.
const MAX_ALERTS_PER_DAY = 10;

/**
 * Pings Telegram when someone new solves it. Awaited rather than fired and
 * forgotten: the serverless function is frozen the moment it responds, so an
 * un-awaited request would often never leave. Any failure is swallowed — a
 * missed notification must never turn into a failed submission.
 */
async function notifySolve(user) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) return;

    try {
        const day = new Date().toISOString().slice(0, 10);
        const sentToday = await redis(["INCR", `alerts:${day}`]);
        if (sentToday === 1) await redis(["EXPIRE", `alerts:${day}`, 172800]);
        if (sentToday > MAX_ALERTS_PER_DAY) return;

        const solvers = await redis(["SCARD", "users"]);

        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: chatId,
                text: `${user} solved the CTF on ionut.codes. That makes ${solvers}.`,
            }),
        });
    } catch (error) {
        console.error("Telegram notification failed:", error);
    }
}

/**
 * Validating the flags here rather than in the browser is the point of this route:
 * the client never sees a token that could write to the store, so it cannot add
 * itself to the leaderboard without actually holding both flags.
 */
export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    if (!isConfigured()) {
        return res.status(503).json({ error: "Flag store is not configured" });
    }

    const { flag1, flag2, user } = req.body ?? {};
    if (typeof flag1 !== "string" || typeof flag2 !== "string" || typeof user !== "string") {
        return res.status(400).json({ error: "flag1, flag2 and user are required" });
    }

    // The leaderboard is rendered straight into the terminal, so keep names plain.
    const name = user.trim().slice(0, MAX_NAME_LENGTH).replace(/[^\w .-]/g, "");
    if (!name) {
        return res.status(400).json({ error: "Pick a name using letters, digits, spaces, '.' or '-'" });
    }

    const first = flag1.trim();
    const second = flag2.trim();
    if (first === second) {
        return res.status(200).json({ ok: false, reason: "The two flags are different from each other." });
    }

    try {
        const [firstValid, secondValid] = await Promise.all([
            redis(["SISMEMBER", "flags", first]),
            redis(["SISMEMBER", "flags", second]),
        ]);

        if (!firstValid || !secondValid) {
            return res.status(200).json({ ok: false, reason: "Invalid flag(s), please try again." });
        }

        // SADD reports 1 for a new member and 0 for one already there, so this
        // is a free dedupe: resubmitting the same name never pings twice.
        const added = await redis(["SADD", "users", name]);
        if (added === 1) await notifySolve(name);

        return res.status(200).json({ ok: true, user: name });
    } catch (error) {
        console.error("Flag submission failed:", error);
        return res.status(502).json({ error: "Flag store is unavailable" });
    }
}
