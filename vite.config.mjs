import { defineConfig } from "vite";
import blog from "./scripts/blog/plugin.mjs";

export default defineConfig({
    plugins: [blog()],
});
