"use strict";

var VERB = 1;
var DBUG = 2;
var INFO = 3;
var NOTE = 4;
var WARN = 5;

var DEFAULT_LOG_LEVEL = NOTE;

console.log("Hey developer! Want to see more verbose logging?");
console.log("Type this into the console: DEFAULT_LOG_LEVEL=1");

function log(level, s) {
  if (level >= DEFAULT_LOG_LEVEL) {
    if (level === WARN)
      console.warn(s);
    else
      console.log(s);
  }
}

function setInsert(into, from) {
  if (!from)
    return;

  if (from instanceof Array) {
    for (let i = 0, len = from.length; i < len; ++i) {
      if (into.indexOf(from[i]) == -1)
        into.push(from[i]);
    }
  } else {
    if (into.indexOf(from) == -1)
      into.push(from);
  }
}

// String.prototype.startsWith is horribly slow in V8. Use this for now.
// https://stackoverflow.com/a/23709550
function startsWith(s, prefix) {
  const len = prefix.length;

  if (s.length < len)
    return false;

  let i;
  for (i = 0; (i < len) && (s[i] === prefix[i]); ++i)
    continue;

  return (i === len);
}

function removeLeadingChar(s, c) {
  for (let i = 0, len = s.length; i < len; ++i) {
    if (s[i] !== c)
      return s.substr(i);
    else if (i + 1 === len)
      return "";
  }

  return s;
}

function removeTrailingChar(s, c) {
  for (let i = s.length - 1; i >= 0; --i) {
    if (s[i] !== c)
      return s.substr(0, i + 1);
    else if (i === 0)
      return "";
  }

  return s;
}

function i18nReplace() {
  [].forEach.call(document.querySelectorAll("[i18n]"), (el) => {
    el.innerHTML = chrome.i18n.getMessage(el.getAttribute("i18n"));
  });
}

function updateIcon(httpNowhere) {
  chrome.browserAction.setIcon({path: httpNowhere ? "icon38-red.png"
                                                  : "icon38.png"});
}
