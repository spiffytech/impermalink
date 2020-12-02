<script lang="ts">
  import Fa from "svelte-fa";
  import { faGlobeAmericas } from "@fortawesome/free-solid-svg-icons";
  import geopattern from "geopattern";

  import Link from "./Link.svelte";
  import type { LinkGroup } from "../routes/_lib/types";

  export let group: LinkGroup;
  export let colors: any;

  let pattern: string = "";
  $: {
    const url = geopattern
      .generate(group.domain, { color: colors.warmGray[200] })
      .toDataUrl();
    pattern = `background-image: ${url};`;
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
    style={pattern}>
    <header
      class="text-2xl text-gray-700 rounded-lg p-2 mb-2 bg-gradient-to-r from-gray-200">
      <Fa icon={faGlobeAmericas} class="inline" />
      <span>{group.domain.replace(/^www\./, '')}</span>
      <span class="text-sm text-gray-500 italic">({group.links.length})</span>
    </header>
  </summary>
  <ul
    class="p-2 rounded-lg grid gap-2 md:gap-4 gap-y-2 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 auto-rows-min"
    style={pattern}>
    {#each group.links as link (link.url)}
      <li class="contents">
        <Link {link} on:linksChanged />
      </li>
    {/each}
  </ul>
</details>
