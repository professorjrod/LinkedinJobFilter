declare var browser: typeof chrome;

import { detect } from "detect-browser";
const bw = detect();


// https://regex101.com/r/MoiGZG/1, should be excluded for our redirect.
const IP_REGEXP = /^((25[0-5]|(2[0-4]|1\d|[1-9]|)\d)\.?\b){4}$/;
// https://regex101.com/r/OTKUMy/1
const PROTOCOL_REGEXP = /^(http(s)?):\/\//;
// https://regex101.com/r/tdVq8Y/1
// URL regex that matches the official url definition,
// taken from https://stackoverflow.com/a/3809435
// A TLD's maximum length is 63 characters, although most are around 2–3:
// https://developer.mozilla.org/en-US/docs/Learn/Common_questions/What_is_a_domain_name
const URL_REGEX_NO_PROTOCOL = /^([-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,63})\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/;


export function getExtensionApi() {
  return bw.name === 'chrome' ? chrome : browser;
}

// Url open in new tab -> 1
// New tab and then type the url -> 2
function isNewSession() {
  return history.length <= 2;
}

function isSearchEngineHost(urlStr: string) {
  const url = new URL(urlStr);
  return ["www.bing.com", "www.google.com", "duckduckgo.com"]
    .includes(url.hostname);
}

function getSearchQueryParam(urlStr: string) {
  const url = new URL(urlStr);
  return url.searchParams.get('q') ?? '';
}

function getProtocol(urlStr: string) {
  const m = PROTOCOL_REGEXP.exec(urlStr);
  if (m && m[1]) {
    return m[1];
  }
  return 'http';
}

export function isOneIntentionLink(urlStr: string) {
  // Strip off the protocol
  const protocol = getProtocol(urlStr);
  const urlNoProto = urlStr.replace(PROTOCOL_REGEXP, '');
  // No redirect for ip addresses
  if (IP_REGEXP.test(urlNoProto.replace(/\/+$/, ''))) return false;
  // It has to be a valid url format.
  if (!URL_REGEX_NO_PROTOCOL.test(urlNoProto)) return false;

  const matches = URL_REGEX_NO_PROTOCOL.exec(urlNoProto);
  // We only consider its one intention if its trying to go to .1
  if (!matches[1].endsWith(".1")) return false;

  try {
    // Only consider it's a one domain search page if the search query can be constructed into
    // a valid url after adding `.country` to the domain.
    const queryUrl = new URL(`${protocol}://${matches[1]}.country${matches[2]}`);
    return true;
  } catch (e) {
    return false;
  }
}

export function isOneDomainSearchPage(urlStr: string) {
  const searchQueryParam = getSearchQueryParam(urlStr);
  if (!isSearchEngineHost(urlStr)) return false;
  return isOneIntentionLink(searchQueryParam);
}

function hasDifferentDomain(urlOne: string, urlTwo: string) {
  try {
    return new URL(urlOne).hostname !== new URL(urlTwo).hostname;
  } catch (e) { }
  return false;
}

/**
 * Has intention to open .1, we consider user has intention to open .1 when any of following are true:
 * 1. Click a link to .1 (`http://all.1`) from any page
 * 2. Type a .1 link (`http://all.1`) to the address bar
 */
function hasOneIntention(url: string, historyUrls?: string[]) {
  console.log("check one intention, isNewSession: ", isNewSession(), " isOneDomainSearchPage: ", isOneDomainSearchPage(url), " historyUrls: ", historyUrls);
  if (isNewSession() && isOneDomainSearchPage(url)) return true;

  // TODO: may improve this with webNavigation api and webRequest history of the tab.
  // For now, we just treat it as one intention if a one domain search page appears after a different domain.
  // Here we use second last, as the last url in history will be the current url.
  // The edge case is:
  // 1. If user is on one of the default search result page, and then type the .1 url to the address bar.
  return isOneDomainSearchPage(url) && hasDifferentDomain(url, historyUrls[historyUrls.length - 2]);
}

export function legalizeUrl(urlStr: string) {
  const protocol = getProtocol(urlStr);
  const url = urlStr.replace(PROTOCOL_REGEXP, '');
  if (isOneIntentionLink(url)) {
    const matches = URL_REGEX_NO_PROTOCOL.exec(url);
    return `${protocol}://${matches[1]}.country${matches[2]}`;
  }
  return urlStr;
}

export function parseUrl(url: string, historyUrls?: string[]) {
  if (!hasOneIntention(url, historyUrls)) return;
  const query = getSearchQueryParam(url);
  return {
    redirectUrl: legalizeUrl(query)
  }
}

export function ready(fn) {
  if (document.readyState !== 'loading') {
    fn();
  } else {
    document.addEventListener('DOMContentLoaded', fn);
  }
}

export function getTabBasedCacheKey(windowId: number, tabId: number) {
  return `_one_direct_${windowId}_${tabId}`;
}