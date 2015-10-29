(function() {
"use strict";

class Tab {
  constructor(tabId) {
    this.tabId = tabId;
    this.redirects = Object.create(null);
    this.rulesets = new Set();
  }
  incrementRedirect(requestId) {
    if (this.tabId === -1)
      return;

    if (this.redirects[requestId] === undefined)
      this.redirects[requestId] = 0;

    ++this.redirects[requestId];
  }
  overRedirectLimit(requestId) {
    return (this.redirects[requestId] >= 8);
  }
  addRuleset(rs) {
    if (this.tabId === -1)
      return;

    this.rulesets.add(rs);
  }
}

const backgroundTab = new Tab(-1);
const tabMap = Object.create(null);

chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === -1)
    return;

  const tab = tabMap[tabId];
  if (tab !== undefined)
    delete tabMap[tabId];
});

HTTPSe.tabs = {
  register(tabId) {
    if (tabId === -1)
      return backgroundTab;

    tabMap[tabId] = new Tab(tabId);
    return tabMap[tabId];
  },
  get: (tabId) => (tabId === -1) ? backgroundTab : tabMap[tabId]
};

})();
