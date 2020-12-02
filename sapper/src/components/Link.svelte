<script lang="ts">
  import axios from "axios";
  import Fa from "svelte-fa";
  import { faSkull } from "@fortawesome/free-solid-svg-icons";
  import { faTrashAlt } from "@fortawesome/free-regular-svg-icons";
  import { createEventDispatcher } from "svelte";

  import type { Link } from "../routes/_lib/types";

  export let link: Link;

  const dispatch = createEventDispatcher();

  const actionButtonStyle =
    "float-right border-l border-b border-gray-500 rounded-bl-lg rounded-tr-lg ml-2 flex-none flex items-center bg-gray-50 hover:bg-gray-200 transition-colors";

  function colorArticle(dateDeleted: string | null) {
    if (!dateDeleted) {
      return "bg-gray-50";
    } else {
      return "bg-white border-2 border-dashed border-gray-500";
    }
  }

  async function moveToRecycleBin(event?: Event) {
    if (event) event.preventDefault();

    await axios.post("/app/moveToRecycleBin", { linkId: link.id });
    dispatch("linksChanged");
  }
  async function moveFromRecycleBin(event: Event) {
    event.preventDefault();

    await axios.post("/app/moveFromRecycleBin", { linkId: link.id });
    dispatch("linksChanged");
  }
</script>

<article
  id="link-{link.id}"
  class="border border-gray-300 {colorArticle(link.dateDeleted)} rounded-lg shadow-sm h-full opacity-70">
  {#if !link.dateDeleted}
    <form
      title="Send link to the recycle bin"
      class={actionButtonStyle}
      on:submit={moveToRecycleBin}>
      <button class="p-4 h-full" type="submit">
        <Fa icon={faTrashAlt} class="inline" />
      </button>
    </form>
  {:else}
    <form
      title="Link will be deleted soon. Click to remove from the recycle bin."
      class={actionButtonStyle}
      on:submit={moveFromRecycleBin}>
      <button class="p-4 h-full" type="submit">
        <Fa icon={faSkull} class="inline" />
      </button>
    </form>
  {/if}

  <a
    href={link.url}
    class="link block h-full p-2 hover:bg-gray-200 transition-colors"
    data-id={link.id}
    data-is-deleted={link.dateDeleted ? 'true' : null}
    rel="noopener noreferrer external"
    target="_blank"
    on:click={() => moveToRecycleBin()}>
    <header class="text-lg" title={link.title || undefined}>
      {link.title && link.title.slice(0, 140)}
    </header>
    <p
      title={link.url}
      class="block text-xs italic text-gray-500 underline whitespace-nowrap overflow-hidden overflow-ellipsis">
      {link.url.replace(/^https?:\/\/(www\.)?/, '')}
    </p>
    <p class="text-sm text-gray-800 italic">{link.description}</p>
  </a>
</article>
