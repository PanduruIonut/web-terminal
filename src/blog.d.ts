/** The published posts, newest first. Provided by scripts/blog/plugin.mjs. */
declare module "virtual:blog" {
    export interface BlogPost {
        readonly slug: string;
        readonly url: string;
        readonly title: string;
        readonly description: string;
        /** YYYY-MM-DD */
        readonly date: string;
        /** "15 November 2026", the same string the post's own page shows. */
        readonly dateLabel: string;
    }
    const posts: readonly BlogPost[];
    export default posts;
}
