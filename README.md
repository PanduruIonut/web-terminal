# Personal page inspired by kevin.me

feel free to use it as a template

check out the [demo](https://ionut.codes)

## CTF storage

The two CTF flags and the `userOwns` leaderboard live in a Redis store, reached
through the `api/` routes so no store token is ever shipped to the browser.

The original Vercel KV store was deleted when Vercel retired KV, so a fresh one
is needed:

1. In the Vercel dashboard: **Storage → Create → Upstash Redis**, and connect it
   to this project. That sets `KV_REST_API_URL` and `KV_REST_API_TOKEN`.
2. Seed the flags (the old ones were lost with the store):

   ```sh
   vercel env pull .env
   node --env-file=.env scripts/seed-ctf.mjs 'CTF{first}' 'CTF{second}'
   ```

3. Redeploy.

`flag-1` is revealed by hovering the hidden heading, `flag-2` by reading
`/top_secret_clown_business/secret.txt`. Both are seeded into the `flags` set
that `owned` validates against, so they cannot drift apart.

Note that `vite dev` does not serve the `api/` routes — use `vercel dev` when
working on them.
