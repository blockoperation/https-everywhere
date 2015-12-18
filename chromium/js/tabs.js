"use strict";

function Tab(tabId) {
  this.tabId = tabId;
  this.rulesets = new Set();
}

Tab.prototype = {
  reset() {
    this.rulesets.clear();
  },
  addRuleset(rs) {
    if (this.tabId === -1)
      return;

    this.rulesets.add(rs);
  }
};

function TabMap() {
  this._tabs = new Map([[-1, new Tab(-1)]]);

  chrome.tabs.onRemoved.addListener((tabId) => {
    if (tabId === -1)
      return;

    this._tabs.delete(tabId);
  });
}

TabMap.prototype = {
  register(tabId) {
    if (tabId === -1)
      return this._tabs.get(-1);

    const tab = new Tab(tabId);
    this._tabs.set(tabId, tab);

    return tab;
  },
  get(tabId) {
    return this._tabs.get(tabId);
  }
};
