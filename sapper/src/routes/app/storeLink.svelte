<script lang="ts">
  import { onMount } from "svelte";
  onMount(() => {
    // Assume we're only sent here after a link is shared with us
    window.close();
  });
</script>
