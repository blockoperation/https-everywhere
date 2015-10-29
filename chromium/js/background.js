"use strict";

var HTTPSe = {
  version: chrome.runtime.getManifest().version,
  rulesetFile: "rules/default.rulesets",
  urlBlacklist: new Set(),
  domainBlacklist: new Set(),
  httpNowhere: false,
  userRules: [],
  ruleStates: Object.create(null)
};
