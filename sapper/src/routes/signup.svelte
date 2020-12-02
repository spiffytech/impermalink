<script lang="ts">
  import axios from "axios";
  import Fa from "svelte-fa";
  import { faUser, faKey, faRedoAlt } from "@fortawesome/free-solid-svg-icons";
  import { goto } from "@sapper/app";

  let errors: string[] | null = null;
  let email: string = "";
  let password: string = "";
  let passwordAgain: string = "";

  async function submit(event: Event) {
    event.preventDefault();
    try {
      await axios.post(
        "/signup",
        { email, password, passwordAgain },
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

<form on:submit={submit}>
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
  <div class="field">
    <label class="label" for="email">Email</label>
    <div class="control has-icons-left has-icons-right">
      <span class="icon is-small is-left">
        <Fa icon={faUser} class="inline" />
      </span>
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
    <div class="control has-icons-left has-icons-right">
      <span class="icon is-small is-left">
        <Fa icon={faKey} class="inline" />
      </span>
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
    <label class="label" for="passwordAgain">Password</label>
    <div class="control has-icons-left has-icons-right">
      <span class="icon is-small is-left">
        <Fa icon={faRedoAlt} class="inline" />
      </span>
      <input
        class="input"
        type="password"
        name="passwordAgain"
        placeholder="Population:Tire"
        required
        minlength="8"
        bind:value={passwordAgain} />
    </div>
  </div>

  <div class="field">
    <div class="control">
      <button class="button is-primary" type="submit">Lemme in!</button>
    </div>
  </div>
</form>
