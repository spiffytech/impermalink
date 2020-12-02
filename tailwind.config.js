const colors = require("tailwindcss/colors");

module.exports = {
  purge:
    // For now our dev environment uses a different folder structure than our
    // Docker container
    // process.env.NODE_ENV === "production"
    // ? ["src/**/*.svelte", "src/**/*.html"]
    // : ["sapper/src/**/*.svelte", "sapper/src/**/*.html"],
    [],
  darkMode: false, // or 'media' or 'class'
  theme: {},
  variants: {
    extend: {},
  },
  plugins: [],
};
