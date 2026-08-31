/**
 * Minimal Upstash Redis REST client for the CTF endpoints.
 *
 * The Vercel <-> Upstash marketplace integration provisions KV_REST_API_*, while a
 * store created directly from the Upstash console provisions UPSTASH_REDIS_REST_*.
 * Accept either so the deployment works whichever route the store was created by.
 */
const REST_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REST_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export function isConfigured() {
    return Boolean(REST_URL && REST_TOKEN);
}

/**
 * Commands are sent as a JSON array in the body rather than as URL path segments,
 * so flag values containing '/', '{' or '}' need no escaping.
 */
export async function redis(command) {
    if (!isConfigured()) {
        throw new Error("Redis REST credentials are not configured");
    }

    const response = await fetch(REST_URL, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${REST_TOKEN}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(command),
    });

    if (!response.ok) {
        throw new Error(`Redis REST responded with ${response.status}`);
    }

    const data = await response.json();
    if (data.error) {
        throw new Error(data.error);
    }

    return data.result;
}
