<script lang="ts">
  import axios from "axios";
  import Fa from "svelte-fa";
  import { faUser, faKey } from "@fortawesome/free-solid-svg-icons";
  import { goto } from "@sapper/app";

  let errors: string[] | null = null;
  let email: string = "";
  let password: string = "";

  async function submit() {
    try {
      await axios.post(
        "/login",
        { email, password },
        { withCredentials: true }
      );

      await goto("/app");
    } catch (ex) {
      if (ex.isAxiosError) {
        errors = ex.response.data.errors.map(({ message }: any) => message);
      } else {
        errors = [ex.message];
      }
    }
  }
</script>

<form on:submit|preventDefault={submit}>
  {#if errors}
    <article class="message is-danger">
      <div class="message-header">
        <p>Watch out, an error!</p>
      </div>
      <div class="message-body">
        <ul>
          {#each errors as error}
            <li>{error}</li>
          {/each}
        </ul>
      </div>
    </article>
  {/if}
  <div>
    <label class="label" for="email">Email</label>
    <div>
      <Fa icon={faUser} class="inline" />
      <input
        class="input"
        type="email"
        name="email"
        placeholder="HomeStarRunner@StrongBadia.net"
        required
        bind:value={email} />
    </div>
  </div>

  <div class="field">
    <label class="label" for="password">Password</label>
    <div>
      <Fa icon={faKey} class="inline" />
      <input
        class="input"
        type="password"
        name="password"
        placeholder="Population:Tire"
        required
        minlength="8"
        bind:value={password} />
    </div>
  </div>

  <div class="field">
    <div class="control">
      <button class="button is-primary" type="submit">Lemme in!</button>
    </div>
  </div>
</form>
