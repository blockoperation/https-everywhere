"use strict";

var HTTPSe = {
  version: chrome.runtime.getManifest().version,
  rulesetFile: "rules/default.rulesets",
  urlBlacklist: Object.create(null),
  domainBlacklist: Object.create(null),
  httpNowhere: false,
  ruleStates: localStorage
};
