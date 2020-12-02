import * as sapper from "@sapper/app";

document.querySelector("#sapper")?.classList.remove("hidden");
sapper.start({
  target: document.querySelector("#sapper"),
});
