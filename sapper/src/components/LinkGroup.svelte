<script lang="ts">
  import Fa from "svelte-fa";
  import { faGlobeAmericas } from "@fortawesome/free-solid-svg-icons";
  import geopattern from "geopattern";

  import Link from "./Link.svelte";
  import type { LinkGroup } from "../routes/_lib/types";

  export let group: LinkGroup;
  export let colors: any;

  // From https://stackoverflow.com/questions/5623838/rgb-to-hex-and-hex-to-rgb
  function rgb2hex(r: number, g: number, b: number) {
    return ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  // Derived from https://css-tricks.com/converting-color-spaces-in-javascript/
  function rgb2hsl([r, g, b]: [number, number, number]) {
    // Make r, g, and b fractions of 1
    r /= 255;
    g /= 255;
    b /= 255;

    // Find greatest and smallest channel values
    let cmin = Math.min(r, g, b),
      cmax = Math.max(r, g, b),
      delta = cmax - cmin,
      h = 0,
      s = 0,
      l = 0;

    // Calculate hue
    // No difference
    if (delta == 0) h = 0;
    // Red is max
    else if (cmax == r) h = ((g - b) / delta) % 6;
    // Green is max
    else if (cmax == g) h = (b - r) / delta + 2;
    // Blue is max
    else h = (r - g) / delta + 4;

    h = Math.round(h * 60);

    // Make negative hues positive behind 360°
    if (h < 0) h += 360;

    // Calculate lightness
    l = (cmax + cmin) / 2;

    // Calculate saturation
    s = delta == 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

    // Multiply l and s by 100
    s = +(s * 100).toFixed(1);
    l = +(l * 100).toFixed(1);

    return { h, s, l };
  }

  // From https://css-tricks.com/converting-color-spaces-in-javascript/
  function hsl2hex({ h, s, l }: { h: number; s: number; l: number }) {
    s /= 100;
    l /= 100;

    let c = (1 - Math.abs(2 * l - 1)) * s,
      x = c * (1 - Math.abs(((h / 60) % 2) - 1)),
      m = l - c / 2,
      r = 0,
      g = 0,
      b = 0;

    if (0 <= h && h < 60) {
      r = c;
      g = x;
      b = 0;
    } else if (60 <= h && h < 120) {
      r = x;
      g = c;
      b = 0;
    } else if (120 <= h && h < 180) {
      r = 0;
      g = c;
      b = x;
    } else if (180 <= h && h < 240) {
      r = 0;
      g = x;
      b = c;
    } else if (240 <= h && h < 300) {
      r = x;
      g = 0;
      b = c;
    } else if (300 <= h && h < 360) {
      r = c;
      g = 0;
      b = x;
    }
    // Having obtained RGB, convert channels to hex
    let rStr = Math.round((r + m) * 255).toString(16);
    let gStr = Math.round((g + m) * 255).toString(16);
    let bStr = Math.round((b + m) * 255).toString(16);

    // Prepend 0s, if necessary
    if (rStr.length == 1) rStr = "0" + r;
    if (gStr.length == 1) gStr = "0" + g;
    if (bStr.length == 1) bStr = "0" + b;

    return "#" + rStr + gStr + bStr;
  }

  $: favicon = group.links.find((link) => link.favicon)?.favicon;
  let groupSummaryColor: string | null = null;
  let groupDetailColor: string | null = null;
  $: {
    const faviconColorRgb = group.links.find((link) => link.faviconColor)
      ?.faviconColor;
    if (faviconColorRgb) {
      const parsed = JSON.parse(faviconColorRgb) as [number, number, number];
      groupSummaryColor = rgb2hex(...parsed);

      const colorHsl = rgb2hsl(parsed);
      colorHsl.s = Math.min(colorHsl.s * 1.25, 100);
      colorHsl.l = Math.min(colorHsl.l * 1.35, 100);
      groupDetailColor = hsl2hex(colorHsl);
    }
  }

  let patternSummary: string = "";
  let patternDetail: string = "";
  $: {
    const urlSummary = geopattern
      .generate(group.domain, {
        color: groupSummaryColor ?? colors.warmGray[200],
      })
      .toDataUrl();
    patternSummary = `background-image: ${urlSummary};`;
    const urlDetail = geopattern
      .generate(group.domain, {
        color: groupDetailColor ?? colors.warmGray[200],
      })
      .toDataUrl();
    patternDetail = `background-image: ${urlDetail};`;
  }
</script>

<style>
  /* Hide caret that opens/closes the details page in Chrome/Safari */
  .linkGroup-header::-webkit-details-marker {
    display: none;
  }
</style>

<details class="mb-8 last:mb-0">
  <!-- z-10 because opacity on link items makes them appear above the sticky group header -->
  <summary
    class="linkGroup-header list-none sticky top-0 rounded-lg z-10"
    style={patternSummary}>
    <header
      class="text-2xl text-gray-700 rounded-lg p-2 mb-2 bg-gradient-to-r md:via-transparent from-gray-200">
      {#if favicon}
        <img class="h-6 w-6 inline" src={favicon} alt="favicon" />
      {:else}
        <Fa icon={faGlobeAmericas} class="inline" />
      {/if}
      <span>{group.domain.replace(/^www\./, '')}</span>
      <span class="text-sm text-gray-500 italic">({group.links.length})</span>
    </header>
  </summary>
  <ul
    class="p-2 rounded-lg grid gap-2 md:gap-4 gap-y-2 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 auto-rows-min"
    style={patternDetail}>
    {#each group.links as link (link.url)}
      <li class="contents">
        <Link {link} on:linksChanged />
      </li>
    {/each}
  </ul>
</details>
