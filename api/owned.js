import { isConfigured, redis } from "../lib/redis.js";

const MAX_NAME_LENGTH = 32;

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

        await redis(["SADD", "users", name]);
        return res.status(200).json({ ok: true, user: name });
    } catch (error) {
        console.error("Flag submission failed:", error);
        return res.status(502).json({ error: "Flag store is unavailable" });
    }
}
