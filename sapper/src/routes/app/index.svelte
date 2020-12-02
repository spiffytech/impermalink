<script lang="ts" context="module">
  import type { Preload } from "@sapper/common";
  export const preload: Preload.Preload = async function preload(this) {
    const [linkGroupsResp, colorsResp] = await Promise.all([
      this.fetch("/app/linkGroups.json"),
      this.fetch("/app/colors.json"),
    ]);
    const [{ linkGroups }, colors] = await Promise.all([
      linkGroupsResp.json(),
      colorsResp.json(),
    ]);
    return { linkGroups, colors };
  };
</script>

<script lang="ts">
  import axios from "axios";
  import { fly } from "svelte/transition";
  import { quintOut } from "svelte/easing";
  import Fa from "svelte-fa";
  import {
    faLink,
    faExclamationTriangle,
    faSkull,
    faTrashRestore,
  } from "@fortawesome/free-solid-svg-icons";

  import LinkGroup from "../../components/LinkGroup.svelte";
  import type { Link as ILink, LinkGroup as ILinkGroup } from "../_lib/types";

  export let linkGroups: ILinkGroup[];
  export let colors: any;

  $: topOfRecycleBin = linkGroups.reduce((top, group): ILink | null => {
    const recycled = group.links.filter((link) => link.dateDeleted);
    recycled.sort((a, b) => (a.dateDeleted! > b.dateDeleted! ? -1 : 1));
    const topRecycledInGroup = recycled?.[0];
    if (
      topRecycledInGroup &&
      (!top || topRecycledInGroup.dateDeleted! > top.dateDeleted!)
    ) {
      return topRecycledInGroup;
    }
    return top;
  }, null as ILink | null);

  let error: string | null = null;
  let newLink: string = "";
  let spin = false;

  async function refreshLinks() {
    const resp = await fetch("/app/linkGroups.json");
    const { linkGroups: newLinkGroups } = await resp.json();
    linkGroups = newLinkGroups;
  }

  async function storeLink(event: Event) {
    event.preventDefault();

    error = null;
    if (!newLink) return;
    try {
      spin = true;
      await axios.post("/app/storeLink", newLink, {
        headers: { "Content-Type": "text/plain" },
      });
      newLink = "";
      await refreshLinks();
    } catch (ex) {
      console.error(ex);
      if (ex.response.data) {
        error = ex.response?.data;
      } else {
        error = ex.message;
      }
    } finally {
      spin = false;
    }
  }

  async function moveFromRecycleBin() {
    if (!topOfRecycleBin) return;
    await axios.post("/app/moveFromRecycleBin", { linkId: topOfRecycleBin.id });
    await refreshLinks();
  }
</script>

<form on:submit={storeLink}>
  <div class="flex">
    <span class="flex flex-col justify-around mr-2">
      {#if spin}
        <div class="sk-pulse" />
      {:else}
        <Fa icon={faLink} class="inline" />
      {/if}
    </span>

    <input
      class="flex-1"
      type="url"
      name="newLink"
      placeholder="https://HomeStarRunner.com"
      autocomplete="off"
      bind:value={newLink} />

    <button class="text-gray-500 ml-4" type="submit">Add Link</button>
  </div>
  {#if error}
    <p class="p-2 border border-red-700 rounded-lg m-2 bg-red-50 text-red-700">
      <span>
        <Fa icon={faExclamationTriangle} class="inline mx-2" />{error}</span>
    </p>
  {/if}
</form>

{#each linkGroups as linkGroup (linkGroup.domain)}
  <LinkGroup {colors} group={linkGroup} on:linksChanged={refreshLinks} />
{/each}
{#if !linkGroups.length}
  <p class="flex flex-col items-center px-4">
    <span class="mt-8">You stare into the abyss.</span><br />
    <span class="pb-1 border-b-4 border-gray-700">The abyss stares back.</span>
  </p>
{/if}

{#if topOfRecycleBin}
  {#key 'footer-' + topOfRecycleBin.id.toString()}
    <footer
      class="z-10 sticky bottom-0 pt-2 border-t-8 border-gray-400 w-full flex justify-between items-center bg-gray-100 p-2 pr-0"
      transition:fly={{ x: -100, easing: quintOut }}>
      <div class="flex-auto">
        <p class="text-xs italic text-gray-600">In the Recycle Bin</p>
        <p class="italic">
          <Fa icon={faSkull} class="inline" />
          {topOfRecycleBin.title}
        </p>
      </div>
      <button
        class="border-l border-gray-500 p-4 -my-2 ml-4"
        on:click|preventDefault={moveFromRecycleBin}><Fa
          icon={faTrashRestore}
          size="1.25x"
          class="inline" /></button>
    </footer>
  {/key}
{/if}
