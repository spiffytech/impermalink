<script lang="ts">
  import Nav from "../components/Nav.svelte";

  export let segment: string;
</script>

<Nav isInsideApp={segment === 'app'} />

<main class="container">
  <slot />
</main>
