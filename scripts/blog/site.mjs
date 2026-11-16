/**
 * The blog's pages: an index at /blog/, one page per post at /blog/<slug>/, and
 * an RSS feed. Static HTML, so a shared link gets its own title, description and
 * picture in the preview card, which a route inside the single-page app could
 * not give it (crawlers neither run the JS nor see the #hash).
 *
 * They wear the CV page's palette and type, and share its theme choice: the
 * same `cv-theme` key in localStorage, so picking light on one is light on the
 * other. The colours are copied from src/components/cvPage.ts; change both.
 */
import fs from "node:fs";
import { escapeHtml as esc } from "./content.mjs";

export const SITE = {
    origin: "https://ionut.codes",
    name: "ionut.codes",
    author: "Panduru Ionut",
    twitter: "@ThisIsIonut",
    description: "Notes on the things I build when nobody is paying.",
    image: {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "A dark terminal window running 'whoami', answering: Panduru Ionut, full stack developer in Sibiu.",
    },
};

const CSS = fs.readFileSync(new URL("./blog.css", import.meta.url), "utf8");

/** Runs before first paint, so a reader who chose light never sees a dark flash. */
const THEME_BOOT = `try{var t=localStorage.getItem("cv-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

/** The toggle. Its label names where a click leads, as on the CV page. Hidden without JS. */
const THEME_TOGGLE = `(function(){var b=document.querySelector(".b-theme");if(!b)return;var r=document.documentElement,light=matchMedia("(prefers-color-scheme: light)");function now(){return r.dataset.theme||(light.matches?"light":"dark")}function paint(){var n=now()==="dark"?"light":"dark";b.textContent=n;b.setAttribute("aria-label","Switch to the "+n+" theme");b.title="Switch to the "+n+" theme"}b.addEventListener("click",function(){var n=now()==="dark"?"light":"dark";r.dataset.theme=n;try{localStorage.setItem("cv-theme",n)}catch(e){}paint()});light.addEventListener("change",paint);b.hidden=false;paint()})();`;

/** A click, Enter or Space on a photo shows it whole; a click or Escape closes it and gives focus back. */
const ZOOM = `(function(){var imgs=document.querySelectorAll(".b-cover img,.b-body figure img");if(!imgs.length)return;var box=document.createElement("div"),stage=document.createElement("div"),big=document.createElement("img"),shut=document.createElement("button"),cap=document.createElement("p"),from=null;box.className="b-zoom";box.hidden=true;box.setAttribute("role","dialog");box.setAttribute("aria-modal","true");box.setAttribute("aria-label","Enlarged photo");stage.className="b-zoom-stage";stage.appendChild(big);shut.type="button";shut.className="b-zoom-close";shut.setAttribute("aria-label","Close photo");shut.textContent="×";cap.className="b-zoom-cap";box.appendChild(shut);box.appendChild(stage);box.appendChild(cap);document.body.appendChild(box);function close(){box.hidden=true;big.removeAttribute("src");document.documentElement.style.overflow="";if(from)from.focus()}function open(img){var f=img.closest("figure"),c=f&&f.querySelector("figcaption");from=img;big.src=img.currentSrc||img.src;big.alt=img.alt;cap.textContent=(c?c.textContent:img.alt).trim();cap.hidden=!cap.textContent;box.hidden=false;document.documentElement.style.overflow="hidden";shut.focus()}for(var i=0;i<imgs.length;i++){imgs[i].tabIndex=0;imgs[i].addEventListener("click",function(e){open(e.currentTarget)});imgs[i].addEventListener("keydown",function(e){if(e.key==="Enter"||e.key===" "){e.preventDefault();open(e.currentTarget)}})}box.addEventListener("click",close);document.addEventListener("keydown",function(e){if(box.hidden)return;if(e.key==="Escape")close();else if(e.key==="Tab"){e.preventDefault();shut.focus()}})})();`;

/** moto-tracker → Moto Tracker, for the series' own page. */
const seriesTitle = (series) => series.split("-").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");

function page({ title, ogTitle, description, path, type, image, published, body, preview, series }) {
    const canonical = SITE.origin + path;
    const card = image ?? SITE.image;
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<link rel="icon" type="image/svg+xml" href="/cli.svg">
<link rel="author" href="/humans.txt">
<link rel="alternate" type="application/rss+xml" title="${esc(SITE.name)} blog" href="/blog/feed.xml">
<meta name="theme-color" content="#1a1b26" media="(prefers-color-scheme: dark)">
<meta name="theme-color" content="#f7f7fb" media="(prefers-color-scheme: light)">
${preview ? `<meta name="robots" content="noindex">\n` : ""}<meta property="og:type" content="${type}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:title" content="${esc(ogTitle)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${esc(SITE.origin + card.url)}">
<meta property="og:image:width" content="${card.width}">
<meta property="og:image:height" content="${card.height}">
<meta property="og:image:alt" content="${esc(card.alt)}">
<meta property="og:site_name" content="${esc(SITE.name)}">
<meta property="og:locale" content="en_GB">
${published ? `<meta property="article:published_time" content="${published}">\n<meta property="article:author" content="${esc(SITE.author)}">\n` : ""}<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:creator" content="${SITE.twitter}">
<script>${THEME_BOOT}</script>
<style>${CSS}</style>
</head>
<body>
<nav class="b-menu" aria-label="Site">${path === "/blog/" ? `<span aria-current="page">blog</span>` : `<a href="/blog/" aria-current="true">blog</a>`}<a href="/#cv">cv</a></nav>
<div class="b-page">
${preview ? `<p class="b-preview">Preview of the writing folder: drafts included. Never deployed.</p>\n` : ""}<header class="b-top">
<nav class="b-crumbs" aria-label="Breadcrumb"><a href="/">${esc(SITE.name)}</a><span aria-hidden="true">/</span><a href="/blog/">blog</a>${series ? `<span aria-hidden="true">/</span><a href="/blog/${series}/">${esc(seriesTitle(series))}</a>` : ""}</nav>
<button type="button" class="b-theme" hidden></button>
</header>
<main>
${body}
</main>
<footer class="b-foot">
<a href="/blog/">All posts</a>
<a href="/blog/feed.xml">RSS</a>
<a href="/#cv">CV</a>
<a href="/">&gt;_ terminal</a>
</footer>
</div>
<script>${THEME_TOGGLE}${ZOOM}</script>
<script defer src="/_vercel/insights/script.js"></script>
</body>
</html>
`;
}

const newestFirst = (posts) => [...posts].sort((a, b) => b.date.localeCompare(a.date) || b.number - a.number);

/**
 * "Moto Tracker, part 3", or "… part 3 of 4" on the post itself: where a post
 * sits in its series, counted the way the series page and previous/next count
 * (the published posts, in file-number order). Empty for a post in no series.
 */
function seriesLabel(post, posts, { of = false } = {}) {
    if (!post.series) return "";
    const siblings = posts.filter((other) => other.series === post.series);
    const part = siblings.indexOf(post) + 1;
    // Non-breaking inside "part 3 of 5", so a narrow line breaks after the comma, never before the number.
    return `<a class="b-series" href="/blog/${post.series}/">${esc(seriesTitle(post.series))}</a>, part&nbsp;${part}${of ? `&nbsp;of&nbsp;${siblings.length}` : ""}`;
}

function postBody(post, previous, next, series = "") {
    const pager = previous || next
        ? `
<nav class="b-pager" aria-label="Previous and next post">
${previous ? `<a class="b-prev" href="${previous.url}" rel="prev"><span>Previous</span>${esc(previous.title)}</a>` : "<span></span>"}
${next ? `<a class="b-next" href="${next.url}" rel="next"><span>Next</span>${esc(next.title)}</a>` : ""}
</nav>`
        : "";
    return `<article class="b-post">
<header class="b-head">
<p class="b-meta"><time datetime="${post.date}">${esc(post.dateLabel)}</time><span aria-hidden="true"> · </span>${post.minutes} min read${series ? `<span aria-hidden="true"> · </span>${series}` : ""}${post.draft ? `<span class="b-draft">draft</span>` : ""}</p>
<h1>${esc(post.title)}</h1>
<p class="b-lede">${esc(post.description)}</p>
</header>${post.cover ? `
<figure class="b-cover"><img src="${esc(post.cover.url)}" alt="${esc(post.cover.alt)}" width="${post.cover.width}" height="${post.cover.height}" fetchpriority="high"></figure>` : ""}
<div class="b-body">
${post.html}
</div>
</article>${pager}`;
}

/** Preview only: what would stop a draft from publishing, said plainly. */
function problemsBlock(problems) {
    if (!problems.length) return "";
    return `<div class="b-problems">
<p><strong>${problems.length === 1 ? "One draft" : `${problems.length} drafts`} cannot be shown yet:</strong></p>
${problems.map((problem) => `<pre>${esc(problem.message)}</pre>`).join("\n")}
</div>`;
}

/** `all` given (the blog index): each post in a series says which, and where in it. */
const listItems = (posts, all = null) => posts.map((post) => `<li>
<time datetime="${post.date}">${esc(post.dateLabel)}</time>${all && post.series ? `<span class="b-list-series"><span aria-hidden="true"> · </span>${seriesLabel(post, all)}</span>` : ""}${post.draft ? `<span class="b-draft">draft</span>` : ""}
<a class="b-list-title" href="${post.url}">${esc(post.title)}</a>
<p>${esc(post.description)}</p>
</li>`).join("\n");

function indexBody(posts, problems = []) {
    return `<header class="b-head">
<h1>Blog</h1>
<p class="b-lede">${esc(SITE.description)}</p>
</header>
${problemsBlock(problems)}
<ul class="b-list">
${listItems(newestFirst(posts), posts)}
</ul>`;
}

/** A series reads in order, so its page lists it oldest first. */
function seriesBody(series, posts) {
    return `<header class="b-head">
<h1>${esc(seriesTitle(series))}</h1>
<p class="b-lede">Every post in the series, in the order it happened.</p>
</header>
<ul class="b-list">
${listItems(posts)}
</ul>`;
}

function feed(posts) {
    const items = newestFirst(posts).map((post) => `<item>
<title>${esc(post.title)}</title>
<link>${SITE.origin}${post.url}</link>
<guid isPermaLink="true">${SITE.origin}${post.url}</guid>
<pubDate>${new Date(`${post.date}T00:00:00Z`).toUTCString()}</pubDate>
<description>${esc(post.description)}</description>
</item>`).join("\n");
    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>${esc(SITE.name)} · Blog</title>
<link>${SITE.origin}/blog/</link>
<atom:link href="${SITE.origin}/blog/feed.xml" rel="self" type="application/rss+xml"/>
<description>${esc(SITE.description)}</description>
<language>en-gb</language>
${items}
</channel>
</rss>
`;
}

/**
 * Every file of the blog, keyed by the URL path it is served at. Nothing at all
 * while no post is published, so the site carries no trace of a blog until the
 * first one goes out.
 */
export function buildSite({ posts, assets, problems = [] }, { preview = false } = {}) {
    const files = new Map();
    if (posts.length === 0 && problems.length === 0) return files;

    const html = (body) => ({ body: Buffer.from(body), type: "text/html; charset=utf-8" });

    files.set("/blog/index.html", html(page({
        title: `Blog · ${SITE.author}`,
        ogTitle: `Blog · ${SITE.name}`,
        description: SITE.description,
        path: "/blog/",
        type: "website",
        body: indexBody(posts, problems),
        preview,
    })));

    for (const problem of problems.filter((p) => p.url)) {
        files.set(`${problem.url}index.html`, html(page({
            title: `${problem.name} · cannot be shown yet`,
            ogTitle: problem.name,
            description: problem.message,
            path: problem.url,
            type: "article",
            body: `<header class="b-head"><h1>${esc(problem.name)}</h1></header>\n${problemsBlock([problem])}`,
            preview,
        })));
    }

    for (const series of new Set(posts.map((post) => post.series).filter(Boolean))) {
        const name = seriesTitle(series);
        files.set(`/blog/${series}/index.html`, html(page({
            title: `${name} · ${SITE.author}`,
            ogTitle: `${name} · ${SITE.name}`,
            description: `Every post in the ${name} series, in the order it happened.`,
            path: `/blog/${series}/`,
            type: "website",
            body: seriesBody(series, posts.filter((post) => post.series === series)),
            preview,
            series,
        })));
    }

    // Previous and next stay inside the post's series (or among posts without one).
    for (const post of posts) {
        const siblings = posts.filter((other) => other.series === post.series);
        const i = siblings.indexOf(post);
        files.set(`${post.url}index.html`, html(page({
            title: `${post.title} · ${SITE.author}`,
            ogTitle: post.title,
            description: post.description,
            path: post.url,
            type: "article",
            image: post.cover ?? post.figures[0],
            published: post.date,
            body: postBody(post, siblings[i - 1], siblings[i + 1], seriesLabel(post, posts, { of: true })),
            preview,
            series: post.series,
        })));
    }

    files.set("/blog/feed.xml", { body: Buffer.from(feed(posts)), type: "application/rss+xml; charset=utf-8" });
    for (const [url, asset] of assets) files.set(url, asset);
    return files;
}

/** What the CV page lists: newest first, and only what it shows. */
export function summaries(posts) {
    return newestFirst(posts).map(({ slug, url, title, description, date, dateLabel }) => ({
        slug, url, title, description, date, dateLabel,
    }));
}
