import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  // GitHub Pages project sites are served from /<repo-name>/, not the domain root.
  base: "/world2/",
  server: {
    host: true,
  },
});
