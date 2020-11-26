browser.contextMenus.create({
  id: "impermalink",
  title: "Impermalink -> save for later",
  contexts: ["link"],
});

async function saveLink(url) {
  try {
    await fetch("https://impermalink.spiffy.tech/app/share-target", {
      method: "post",
      body: url,
      credentials: "include",
    });
    browser.notifications.create("impermalink", {
      type: "basic",
      title: "Impermalink",
      message: "Saved the link!",
    });
    setTimeout(() => browser.notifications.clear("impermalink"), 2000);
  } catch (ex) {
    console.error(ex);
    browser.notifications.create("impermalink", {
      type: "basic",
      title: "Impermalink",
      message: "Encountered an error saving the link",
    });
    setTimeout(() => browser.notifications.clear("impermalink"), 5000);
  }
}

browser.pageAction.onClicked.addListener((tab) => {
  return saveLink(tab.url);
});

browser.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId !== "impermalink") return;
  /*
  const apiKey = browser.storage.sync.get("apiKey");
  if (!apiKey) return void browser.runtime.openOptionsPage();
  */
  return saveLink(info.linkUrl);
});
