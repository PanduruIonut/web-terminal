#!/usr/bin/env node
/**
 * Brings finished posts over from the writing folder:
 *
 *   pnpm blog:import ~/Documents/moto-tracker-blog
 *
 * The writing folder (posts/NN-slug.md, images/, images/NN/) stays private;
 * content/blog/ in this repo is public. Only a post marked `draft: false` that
 * passes every check in scripts/blog/content.mjs comes across, with only the
 * images it uses. <!-- notes --> are removed on the way. Drafts are not
 * copied anywhere, so one can never be committed by accident. A post with
 * `series: moto-tracker` lands in content/blog/moto-tracker/, with its images,
 * and is served at /blog/moto-tracker/<slug>/.
 *
 * Nothing is deleted. A post taken back to `draft: true` is reported, and
 * stays on the site until its file is removed from content/blog/.
 *
 * Exits 1 if any post marked `draft: false` was refused.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ContentError, POST_FILE, imageResolver, parsePost, prepareForPublish, splitFrontmatter } from "./blog/content.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const destination = path.join(root, "content/blog");

const source = process.argv[2];
if (!source) {
    console.error("Usage: pnpm blog:import <writing folder>   (the folder holding posts/ and images/)");
    process.exit(2);
}
const writingFolder = path.resolve(source);
const postsDir = path.join(writingFolder, "posts");
if (!fs.existsSync(postsDir)) {
    console.error(`No posts/ folder in ${writingFolder}`);
    process.exit(2);
}

let published = 0;
let drafts = 0;
let refused = 0;
const publishedNow = new Set();

for (const name of fs.readdirSync(postsDir).filter((n) => n.endsWith(".md")).sort()) {
    const raw = fs.readFileSync(path.join(postsDir, name), "utf8");

    let draft;
    try {
        draft = splitFrontmatter(raw, name).data.draft;
    } catch (error) {
        if (!(error instanceof ContentError)) throw error;
        console.log(`  REFUSED  ${name}\n           ${error.message}`);
        refused += 1;
        continue;
    }
    if (draft !== false) {
        console.log(`  draft    ${name}`);
        drafts += 1;
        continue;
    }

    const { text, notes } = prepareForPublish(raw);
    const images = [];
    let post;
    try {
        post = parsePost(text, { file: name, resolveImage: imageResolver(writingFolder, (image) => images.push(image)) });
    } catch (error) {
        if (!(error instanceof ContentError)) throw error;
        console.log(`  REFUSED  ${name}\n           ${error.message}`);
        refused += 1;
        continue;
    }

    // A series keeps its posts and images in a folder of its own: content/blog/<series>/.
    const folder = post.series ? path.join(destination, post.series) : destination;
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, name), text);
    for (const image of images) {
        const target = path.join(folder, image.src);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(image.file, target);
    }
    const shown = path.relative(destination, path.join(folder, name));
    publishedNow.add(shown);
    published += 1;
    const used = new Set(images.map((image) => image.src)).size;
    console.log(`  publish  ${name}  → ${post.url}  (${used} image${used === 1 ? "" : "s"}${notes ? `, ${notes} note${notes === 1 ? "" : "s"} removed` : ""})`);
}

const onSite = [];
if (fs.existsSync(destination)) {
    for (const entry of fs.readdirSync(destination, { withFileTypes: true })) {
        if (entry.isFile() && POST_FILE.test(entry.name)) onSite.push(entry.name);
        if (entry.isDirectory() && entry.name !== "images") {
            for (const name of fs.readdirSync(path.join(destination, entry.name)).filter((n) => POST_FILE.test(n))) {
                onSite.push(path.join(entry.name, name));
            }
        }
    }
}
for (const name of onSite.filter((n) => !publishedNow.has(n))) {
    console.log(`  note     content/blog/${name} was not published from the writing folder this time; it stays until you delete it`);
}

console.log(`\n${published} published, ${drafts} still draft, ${refused} refused.`);
process.exit(refused ? 1 : 0);
