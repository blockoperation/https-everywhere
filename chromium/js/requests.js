(function() {
"use strict";

const cancelFilter = {cancel: true};
const dontCancelFilter = {cancel: false};

function onBeforeHttpRequest(details) {
  const url = new URL(details.url);
  const filter = (HTTPSe.httpNowhere) ? cancelFilter : dontCancelFilter;

  const raw_hostname = url.hostname
  if (raw_hostname[raw_hostname.length - 1] === ".")
    url.hostname = removeTrailingChar(raw_hostname, ".");

  const username = url.username || "";
  url.username = "";

  const password = url.password || "";
  url.password = "";

  if (HTTPSe.urlBlacklist.has(url.href))
    return filter;

  let tab = HTTPSe.tabs.get(details.tabId);
  if (tab !== undefined && details.type === "main_frame")
    tab.rulesets.clear();

  const rs = HTTPSe.rulesets.applicableRulesets(url.hostname);
  if (rs === null)
    return filter;

  if (tab === undefined)
    tab = HTTPSe.tabs.register(details.tabId);

  if (tab.overRedirectLimit(details.requestId)) {
    log(NOTE, "Redirect counter hit for " + url.href);
    HTTPSe.urlBlacklist.add(url.href);
    HTTPSe.domainBlacklist.add(url.hostname);
    log(WARN, "Domain blacklisted: " + url.hostname);
    return filter;
  }

  let applied = false;
  for (let i = 0, len = rs.length; i < len; ++i) {
    tab.addRuleset(rs[i]);
    if (!applied && rs[i].active && rs[i].apply(url))
      applied = true;
  }

  if (!applied)
    return filter;

  if (HTTPSe.httpNowhere && url.protocol === "http:")
    return cancelFilter;

  if (username !== "")
    url.username = username;

  if (password !== "")
    url.password = password;

  return {redirectUrl: url.href};
}

function onBeforeHttpsRequest(details) {
  const url = new URL(details.url);

  const raw_hostname = url.hostname
  if (raw_hostname[raw_hostname.length - 1] === ".")
    url.hostname = removeTrailingChar(raw_hostname, ".");

  let tab = HTTPSe.tabs.get(details.tabId);
  if (tab !== undefined && details.type === "main_frame")
    tab.rulesets.clear();

  const rs = HTTPSe.rulesets.applicableRulesets(url.hostname);
  if (rs === null)
    return;

  if (tab === undefined)
    tab = HTTPSe.tabs.register(details.tabId);

  for (let i = 0, len = rs.length; i < len; ++i)
    tab.addRuleset(rs[i]);
}

function onCookieChanged(changeInfo) {
  if (changeInfo.removed || changeInfo.cookie.secure)
    return;

  if (!HTTPSe.rulesets.shouldSecureCookie(changeInfo.cookie))
    return;

  const cookie = {
    name: changeInfo.cookie.name,
    value: changeInfo.cookie.value,
    path: changeInfo.cookie.path,
    httpOnly: changeInfo.cookie.httpOnly,
    expirationDate: changeInfo.cookie.expirationDate,
    storeId: changeInfo.cookie.storeId,
    secure: true
  };

  if (!changeInfo.cookie.hostOnly)
    cookie.domain = changeInfo.cookie.domain;

  if (changeInfo.cookie.domain[0] === ".")
    cookie.url = "https://www" + changeInfo.cookie.domain + cookie.path;
  else
    cookie.url = "https://" + changeInfo.cookie.domain + cookie.path;

  chrome.cookies.set(cookie);
}

function onBeforeRedirect(details) {
  if (!startsWith(details.redirectUrl, "http"))
    return;

  let tab = HTTPSe.tabs.get(details.tabId);
  if (tab === undefined)
    tab = HTTPSe.tabs.register(details.tabId);

  tab.incrementRedirect(details.requestId);
}

HTTPSe.requests = {
  startListeners() {
    const wr = chrome.webRequest;
    wr.onBeforeRequest.addListener(onBeforeHttpRequest, {urls: ["http://*/*"]},
                                   ["blocking"]);
    wr.onBeforeRequest.addListener(onBeforeHttpsRequest, {urls: ["https://*/*"]});
    wr.onBeforeRedirect.addListener(onBeforeRedirect, {urls: ["https://*/*"]});
    chrome.cookies.onChanged.addListener(onCookieChanged);
  }
};

})();
