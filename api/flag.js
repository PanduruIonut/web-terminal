import { isConfigured, redis } from "../lib/redis.js";

// Allowlisted so the endpoint reveals the two CTF flags and nothing else in the store.
const READABLE_FLAGS = new Set(["flag-1", "flag-2"]);

export default async function handler(req, res) {
    if (req.method !== "GET") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const { id } = req.query;
    if (!READABLE_FLAGS.has(id)) {
        return res.status(400).json({ error: "Unknown flag" });
    }

    if (!isConfigured()) {
        return res.status(503).json({ error: "Flag store is not configured" });
    }

    try {
        const flag = await redis(["GET", id]);
        if (flag === null) {
            return res.status(404).json({ error: "Flag has not been seeded" });
        }
        return res.status(200).json({ flag });
    } catch (error) {
        console.error("Flag lookup failed:", error);
        return res.status(502).json({ error: "Flag store is unavailable" });
    }
}
