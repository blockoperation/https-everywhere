(function() {
"use strict";

HTTPSe.storage.addListener("httpNowhere", (changes) => {
  HTTPSe.httpNowhere = changes.newValue || false;
  updateIcon(HTTPSe.httpNowhere);
});

HTTPSe.storage.addListener("ruleStates", (changes) => {
  HTTPSe.ruleStates = changes.newValue || Object.create(null);
});

HTTPSe.storage.addListener("userRules", (changes) => {
  HTTPSe.userRules = changes.newValue || [];
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "devtools-page") {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === "purgeRulesetCache")
        HTTPSe.storage.purgeRulesetCache();
    });
  }
});

const defaultOptions = {
  httpNowhere: false,
  userRules: [],
  ruleStates: Object.create(null)
};

HTTPSe.storage.getOptions(defaultOptions, (items) => {
  HTTPSe.httpNowhere = items.httpNowhere;
  updateIcon(HTTPSe.httpNowhere);

  HTTPSe.userRules = items.userRules;
  HTTPSe.ruleStates = items.ruleStates;

  HTTPSe.userRules.forEach((r) => HTTPSe.rulesets.addUserRule(r));

  HTTPSe.storage.loadRulesets(HTTPSe.rulesetFile, (rs) => {
    rs.forEach((r) => HTTPSe.rulesets.addRuleset(r));
    HTTPSe.requests.startListeners();
  });
});

})();
