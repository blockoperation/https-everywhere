(function() {
"use strict";

document.addEventListener("DOMContentLoaded", () => {
  i18nReplace();

  chrome.runtime.connect({name: "devtools-page"});

  document.getElementById("PurgeCacheButton").addEventListener("click", () => {
    chrome.runtime.sendMessage({
      type: "purgeRulesetCache",
      tabId: chrome.devtools.inspectedWindow.tabId
    });
  });
});

})();
