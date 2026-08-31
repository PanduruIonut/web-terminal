import { isConfigured, redis } from "../lib/redis.js";

export default async function handler(req, res) {
    if (req.method !== "GET") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    if (!isConfigured()) {
        return res.status(503).json({ error: "Flag store is not configured" });
    }

    try {
        const users = await redis(["SMEMBERS", "users"]);
        return res.status(200).json({ users: users ?? [] });
    } catch (error) {
        console.error("User list lookup failed:", error);
        return res.status(502).json({ error: "Flag store is unavailable" });
    }
}
