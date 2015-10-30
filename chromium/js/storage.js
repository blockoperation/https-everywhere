(function() {
"use strict";

function loadXmlFile(file) {
  const xhr = new XMLHttpRequest();

  xhr.open("GET", chrome.extension.getURL(file), false);
  xhr.send(null);

  return (xhr.readyState === 4) ? xhr.responseXML : null;
}

function loadRulesets(file, callback) {
  chrome.storage.local.get({rulesets: null, version: null}, (items) => {
    let rs = items.rulesets;

    if (items.version === null || items.version != HTTPSe.version || rs === null) {
      log(INFO, "Regenerating ruleset cache");

      const xml = loadXmlFile(file);
      if (xml === null) {
        log(WARN, "Failed to load ruleset file: " + file);
        return;
      }

      rs = HTTPSe.parser.parseXmlRulesets(xml);
      chrome.storage.local.set({rulesets: rs, version: HTTPSe.version});
    }

    callback(rs);
  });
}

function loadRuleset(id, callback) {
  if (id === -1)
    return;

  chrome.storage.local.get({rulesets: null}, (items) => {
    if (items.rulesets === null)
      return;

    callback(items.rulesets[id]);
  });
}

function purgeRulesetCache() {
  log(INFO, "Purging ruleset cache");
  chrome.storage.local.remove("rulesets");
}

const changeListeners = Object.create(null);

function addListener(key, callback) {
  if (changeListeners[key] === undefined)
    changeListeners[key] = [];

  changeListeners[key].push(callback);
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "sync")
    return;

  for (let key in changes)
    if (changeListeners[key] !== undefined)
      for (let i = 0, len = changeListeners[key].length; i < len; ++i)
        changeListeners[key][i](changes[key]);
});

HTTPSe.storage = {
  setOptions: (items, callback) => chrome.storage.sync.set(items, callback),
  getOptions: (items, callback) => chrome.storage.sync.get(items, callback),
  loadRulesets,
  loadRuleset,
  purgeRulesetCache,
  addListener
};

})();
