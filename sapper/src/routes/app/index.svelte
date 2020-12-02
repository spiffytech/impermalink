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
  import Fa from "svelte-fa";
  import {
    faLink,
    faExclamationTriangle,
  } from "@fortawesome/free-solid-svg-icons";

  import LinkGroup from "../../components/LinkGroup.svelte";
  import type { LinkGroup as ILinkGroup } from "../_lib/types";

  export let linkGroups: ILinkGroup[];
  export let colors: any;

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
