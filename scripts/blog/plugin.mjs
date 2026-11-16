/**
 * Puts the blog into the site. A Vite plugin rather than a step in the build
 * script, so it runs however the site is built (`pnpm build`, a bare
 * `vite build`, or whatever command Vercel is set to) and `vite dev` serves
 * the same pages.
 *
 *   vite build   writes /blog/** into dist/, from content/blog/ only
 *   vite dev     serves /blog/** on request, rebuilt from disk every time
 *   both         provide `virtual:blog`, the post list the CV page shows
 *
 * BLOG_PREVIEW=<writing folder> makes the dev server show that folder instead,
 * drafts included. Only the dev server ever reads it: generateBundle below is
 * hard-wired to content/blog/, so no setting can put a draft into a build.
 */
import path from "node:path";
import { ContentError, loadPosts, loadPublished } from "./content.mjs";
import { buildSite, summaries } from "./site.mjs";

const VIRTUAL_ID = "virtual:blog";
const RESOLVED_ID = `\0${VIRTUAL_ID}`;

export default function blog() {
    let root = process.cwd();
    let serving = false;

    const publishedDir = () => path.join(root, "content/blog");

    const writingFolder = () => (serving && process.env.BLOG_PREVIEW ? path.resolve(process.env.BLOG_PREVIEW) : null);

    /** The writing folder when previewing, content/blog/ otherwise. */
    const load = () => {
        const folder = writingFolder();
        return folder
            ? loadPosts({ postsDir: path.join(folder, "posts"), imagesRoot: folder, preview: true, prepare: true })
            : loadPublished(publishedDir());
    };

    return {
        name: "blog",

        configResolved(config) {
            root = config.root;
            serving = config.command === "serve";
        },

        resolveId(id) {
            return id === VIRTUAL_ID ? RESOLVED_ID : undefined;
        },

        load(id) {
            if (id !== RESOLVED_ID) return undefined;
            try {
                return `export default ${JSON.stringify(summaries(load().posts))};`;
            } catch (error) {
                if (error instanceof ContentError) this.error(error.message);
                throw error;
            }
        },

        configureServer(server) {
            const watched = [publishedDir(), writingFolder()].filter(Boolean);
            server.watcher.add(watched);
            server.watcher.on("all", (_event, file) => {
                if (!watched.some((dir) => file.startsWith(dir + path.sep))) return;
                const module = server.moduleGraph.getModuleById(RESOLVED_ID);
                if (module) server.moduleGraph.invalidateModule(module);
                server.ws.send({ type: "full-reload" });
            });

            server.middlewares.use((req, res, next) => {
                const { pathname } = new URL(req.url ?? "/", "http://localhost");
                if (pathname !== "/blog" && !pathname.startsWith("/blog/")) return next();

                if (!pathname.endsWith("/") && !path.posix.extname(pathname)) {
                    res.statusCode = 302;
                    res.setHeader("Location", `${pathname}/`);
                    return res.end();
                }

                let files;
                try {
                    files = buildSite(load(), { preview: Boolean(writingFolder()) });
                } catch (error) {
                    if (!(error instanceof ContentError)) return next(error);
                    res.statusCode = 500;
                    res.setHeader("Content-Type", "text/plain; charset=utf-8");
                    return res.end(`The blog did not build:\n\n${error.message}\n`);
                }

                const file = files.get(pathname.endsWith("/") ? `${pathname}index.html` : pathname);
                if (!file) {
                    res.statusCode = 404;
                    res.setHeader("Content-Type", "text/plain; charset=utf-8");
                    return res.end(files.size ? "No such page in the blog.\n" : "No post is published yet. Preview drafts with BLOG_PREVIEW=<writing folder> pnpm dev.\n");
                }
                res.setHeader("Content-Type", file.type);
                res.setHeader("Cache-Control", "no-store");
                return res.end(file.body);
            });
        },

        generateBundle() {
            let files;
            try {
                files = buildSite(loadPublished(publishedDir()));
            } catch (error) {
                if (error instanceof ContentError) this.error(error.message);
                throw error;
            }
            for (const [url, file] of files) {
                this.emitFile({ type: "asset", fileName: url.slice(1), source: file.body });
            }
        },
    };
}
