# Personal page inspired by kevin.me

feel free to use it as a template

check out the [demo](https://ionut.codes)

## CV content

`src/data/cv.json` is the single source for everything on the CV. The CV page
imports it directly, and `scripts/generate-cv-txt.mjs` renders `public/cv.txt`
from the same file as the first step of `pnpm build`, so the two cannot drift
apart. That also means `cv.txt` must never be edited by hand — the next build
overwrites it. `pnpm generate:cv` re-renders it without a full build.

`scripts/og-card.html` is the source of `public/og.png`, the link preview image.
To remake it, serve that file from the site root, capture the 1200x630 body and
save it over `public/og.png`; the comment at the top of the file has the rest.

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

## Blog

`/blog/` is static HTML in the CV page's look: an index, a page per post, and
`/blog/feed.xml`. The CV page lists the newest three under "Blog" and links
`blog` in its header. While nothing is published there is no trace of it.

Posts are written elsewhere, in a private writing folder (`posts/NN-slug.md`,
`images/` for originals, `images/NN/` for redacted copies). Finished ones come
over with:

```sh
pnpm blog:import ~/Documents/moto-tracker-blog
```

which copies each post marked `draft: false`, and only the images it uses, into
`content/blog/`.

A post can belong to a series: `series: moto-tracker` in its front matter puts
it at `/blog/moto-tracker/<slug>/` and its images under
`/blog/moto-tracker/images/`, adds a page listing the series at
`/blog/moto-tracker/`, and keeps previous/next inside the series. In
`content/blog/` each series is a folder of its own, numbered on its own, and the
build refuses a post whose folder and front matter disagree. A post without a
series sits at `/blog/<slug>/`.

`content/blog/` is public (this repo is), so the checks in
`scripts/blog/content.mjs` are the gate, and they fail the build rather than
warn. They refuse a draft, a leftover `TODO` or `PHOTO:`, any raw HTML or
`<!-- note -->`, an image outside `images/NN/` or marked `_PRIVATE`, and any
image carrying metadata beyond what `redact.swift` leaves (GPS, camera, dates,
thumbnails, a second image after the first). `pnpm test:blog` runs them.

To see drafts on the site before publishing, point the dev server at the
writing folder. Only `vite dev` reads it; a build never does:

```sh
BLOG_PREVIEW=~/Documents/moto-tracker-blog pnpm dev   # then open /blog/
```

The pages are built by a Vite plugin (`scripts/blog/plugin.mjs`), so they are
produced however the site is built. The Markdown is a small subset rendered in
`content.mjs`: `##`–`####` headings, paragraphs, `*em*`, `**strong**`, `` `code` ``,
`[links](https://…)`, lists, `>` quotes, fenced code, `---`, and figures, which
are an image on its own line with an `*italic caption*` on the lines under it.

A post can name a cover photo in its front matter (`cover: ../images/NN/x.jpg`
with a `cover_alt:`). It goes through the same image checks, shows under the
title at 16:9, and is the picture in the post's link preview; without one, the
first figure is.

A `>` quote shows as a pull quote. One whose first line is only `**bold**` is a
number callout: the bold is set large, the rest of the quote beside it. Figures
are laid out by shape: on a wide screen a landscape photo runs wider than the
text and a phone screenshot sits beside it; on a phone they all stack. A click
on any photo shows it whole.
