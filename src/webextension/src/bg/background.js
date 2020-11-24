browser.contextMenus.create({
  id: "impermalink",
  title: "Impermalink -> save for later",
  contexts: ["link"],
});

browser.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId !== "impermalink") return;
  const apiKey = browser.storage.sync.get("apiKey");
  if (!apiKey) return void browser.runtime.openOptionsPage();
  fetch("https://impermalink.spiffy.tech/app/share-target", {
    method: "post",
    body: info.linkUrl,
    credentials: "include",
  })
    .then(() => console.log("Impermalink: saved link"))
    .catch(console.error.bind(console));
});
