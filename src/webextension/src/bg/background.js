chrome.contextMenus.create({
  id: "impermalink",
  title: "Impermalink -> save for later",
  contexts: ["link"],
});

async function saveLink(url) {
  try {
    const response = await fetch(
      "https://impermalink.spiffy.tech/app/storeLink",
      {
        method: "post",
        body: url,
        credentials: "include",
      }
    );
    if (response.status >= 400) {
      console.error(await response.text());
      chrome.notifications.create("impermalink", {
        type: "basic",
        title: "Impermalink",
        message: "Error saving link",
      });
      throw new Error("Couldn't save your link");
    }
    chrome.notifications.create("impermalink", {
      type: "basic",
      title: "Impermalink",
      message: "Saved the link!",
    });
    setTimeout(() => browser.notifications.clear("impermalink"), 2000);
  } catch (ex) {
    console.error(ex);
    chrome.notifications.create("impermalink", {
      type: "basic",
      title: "Impermalink",
      message: "Encountered an error saving the link",
    });
    setTimeout(() => browser.notifications.clear("impermalink"), 5000);
  }
}

chrome.pageAction.onClicked.addListener((tab) => {
  console.log(tab);
  return saveLink(tab.url);
});

chrome.contextMenus.onClicked.addListener((info) => {
  console.log("info", info);
  if (info.menuItemId !== "impermalink") return;
  /*
  const apiKey = browser.storage.sync.get("apiKey");
  if (!apiKey) return void browser.runtime.openOptionsPage();
  */
  return saveLink(info.linkUrl);
});
