import { getExtensionApi, getTabBasedCacheKey } from "lib/utils";

// TODO: if we enable this, then we need to change how `parseUrl` is done now,
// as for webRequest, the history session will not be available.
// getExtensionApi().webRequest.onBeforeRequest.addListener((data) => {
//     const result = parseUrl(data.url)
//     if (result?.redirectUrl) {
//         return {
//             'redirectUrl': result.redirectUrl
//         }
//     }
// }, { urls: ["<all_urls>"], types: ["main_frame"] }, ["blocking"]);


const tabs = getExtensionApi().tabs;
const storage = getExtensionApi().storage.local;

// store the history of the tab, will be cleaned up once tab is destroyed
tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    const key = getTabBasedCacheKey(tab.windowId, tabId);
    // use callback instead of promise as it is supported in both v2 and v3.
    storage.get(key, items => {
        const prev = items[key] || { history: [] };
        const lastTabUrl = prev.history[prev.history.length - 1];
        if (lastTabUrl !== tab.url) {
            prev.history.push(tab.url);
        }
        storage.set({ [key]: prev });
    });
});

// clean up the tab level storage once tab is destroyed.
tabs.onRemoved.addListener((tabId, removeInfo) => {
    storage.remove(getTabBasedCacheKey(removeInfo.windowId, tabId));
});

// Respond to the history query message from tab.
getExtensionApi().runtime.onMessage.addListener((msg, sender, sendResponse) => {
    // TODO: move to enum.
    if (msg.cmd == "get_tab_history") {
        const key = getTabBasedCacheKey(sender.tab.windowId, sender.tab.id);
        storage.get(key, items => {
            const prev = items[key] || { history: [] };
            sendResponse( prev.history );
        });
        return true;
    }
});