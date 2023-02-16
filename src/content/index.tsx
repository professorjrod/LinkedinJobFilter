import { isOneDomainSearchPage, legalizeUrl, ready, isOneIntentionLink, getExtensionApi, parseUrl } from "lib/utils";

console.log("Content script: ", location.href);

const runtime = getExtensionApi().runtime;
let tabHistories = [];

// store the history of the tab, will be cleaned up in background
let historyR;
const historyP = new Promise(r => {
  historyR = r;
});
runtime.sendMessage({ cmd: "get_tab_history" }, his => {
  tabHistories = his;
  historyR();
});

const currentUrl = location.href;
// The parse / redirect will only happen to urls that we care about.
if (isOneDomainSearchPage(currentUrl)) {
  // This is to avoid the content flashing since the redirect is happening in content script.
  const styleEl = document.createElement('style');
  styleEl.id = "_one_redirect_temp_style";
  styleEl.innerHTML = 'html, body {display: none !important;}';
  document.querySelector('html').appendChild(styleEl);

  // Wait at most 100ms for the history before redirecting,
  // we can afford no history ;)
  const maxWaitP = new Promise(r => setTimeout(r, 100));
  Promise.race([historyP, maxWaitP])
    .then(() => {
      // Redirect immediately if elligble
      const res = parseUrl(location.href, tabHistories);
      tabHistories = [];
      if (res?.redirectUrl) {
        location.href = res.redirectUrl;
      }
      // in case of not redirecting, remove the added style override.
      styleEl.remove();
    });
}


// Hijack link clicks so we can handle `.1` links correctly, otherwise as browser may
// think its illegal and just open `about:blank#blocked`
ready(() => {
  function getClosestLink(node, root) {
    if (!node || node === root) return;
    if ('a' !== node.nodeName.toLowerCase() || !node.href) {
      return getClosestLink(node.parentNode, root);
    }
    return node;
  }

  const root = document.documentElement;
  root.addEventListener('click', (e) => {
    if (e.defaultPrevented) return;
    if (e.button && e.button !== 0) return;

    if (e.altKey) {
      return;
    }

    var link = getClosestLink(e.target, root);
    if (!link) return;

    try {
      const url = link.href;
      // If its a one intention link, then replace with the targetted legal url before passing it to the default handler.
      if (isOneIntentionLink(url)) {
        link.setAttribute('href', legalizeUrl(link.href));
        // if it's open in new tab, reset the link afterwards.
        if (link.target === "_blank" || e.ctrlKey || e.metaKey) {
          setTimeout(() => {
            link.setAttribute('href', url);
          });
        }
      }
    } catch (e) {
      console.log(e);
     }
    return true;
  });
});