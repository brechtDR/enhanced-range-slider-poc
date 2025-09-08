import { defineConfig } from 'vite';

// This config is now set up to build the index.html as a static site for GitHub Pages.
export default defineConfig({
    // The base path for the deployed site. This should match your GitHub repository name.
    base: '/enhanced-range-slider-poc/',
    build: {
        // The output directory for the build is 'dist' by default, which is
        // what the GitHub Pages workflow expects.
    },
});
