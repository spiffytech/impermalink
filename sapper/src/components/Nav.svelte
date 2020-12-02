<script lang="ts">
  import axios from "axios";
  import { stores, goto } from "@sapper/app";

  export let isInsideApp: boolean;

  const { session } = stores();

  async function logout(event: Event) {
    event.preventDefault();

    await axios.post("/logout", null, { withCredentials: true });
    await goto("/");
    // Ensure we aren't holding onto any private state in-memory or in the
    // console or anything
    window.location.reload();
  }
</script>

<nav
  class="flex justify-between py-2 mb-2 border-b-2 w-full"
  role="navigation"
  aria-label="main navigation">
  <a class="navbar-item text-xl font-semibold" href="/">Impermalink</a>

  <div>
    {#if $session.email}
      {#if !isInsideApp}<a href="/app"> <strong>Go to app</strong> </a>{/if}
      <button on:click={logout}>Log Out</button>
    {:else}
      <a href="/signup"> <strong>Sign up</strong> </a>
      <a href="/login">Log in </a>
    {/if}
  </div>
</nav>
