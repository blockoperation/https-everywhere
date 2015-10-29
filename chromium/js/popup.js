(function() {
"use strict";

const HTTPSe = chrome.extension.getBackgroundPage().HTTPSe;

function escapeForRegex(s) {
  return s.replace(/[\-\[\]{}()*+?.,\\\^$|#\s]/g, "\\$&");
}

function hide(elem) {
  elem.style.display = "none";
}

function show(elem) {
  elem.style.display = "block";
}

function e(id) {
  return document.getElementById(id);
}

function toggleRuleLine(checkbox, rs) {
  if (!rs.active && checkbox.checked)
    HTTPSe.rulesets.enableRuleset(rs, chrome.tabs.reload);
  else if (rs.active && !checkbox.checked)
    HTTPSe.rulesets.disableRuleset(rs, chrome.tabs.reload);
}

function createRuleLine(rs) {
  const line = document.createElement("div");
  line.className = "rule checkbox";

  const label = document.createElement("label");

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";

  if (rs.active)
    checkbox.setAttribute("checked", "");

  checkbox.onchange = (ev) => {
    toggleRuleLine(checkbox, rs);
  };

  label.appendChild(checkbox);

  const favicon = document.createElement("img");
  favicon.src = "chrome://favicon/";
  label.appendChild(favicon);

  const text = document.createElement("span");
  text.innerText = rs.name;

  if (rs.note !== null && rs.note.length > 0)
    text.title = rs.note;

  label.appendChild(text);
  line.appendChild(label);

  return line;
}

document.addEventListener("DOMContentLoaded", () => {
  const stableRules = e("StableRules");
  const unstableRules = e("UnstableRules");

  chrome.tabs.getSelected(null, (tab) => {
    const tab_ = HTTPSe.tabs.get(tab.id);

    if (tab_ !== undefined) {
      for (const rs of tab_.rulesets) {
        const listDiv = rs.default_state ? stableRules : unstableRules;
        listDiv.appendChild(createRuleLine(rs));
        listDiv.style.position = "static";
        listDiv.style.visibility = "visible";
      }
    }

    if (startsWith(tab.url, "https:"))
      show(e("add-rule-link"));
  });

  e("current-version").innerText = HTTPSe.version;

  const httpNowhereCheckbox = e("http-nowhere-checkbox");
  httpNowhereCheckbox.addEventListener("click", () => {
    HTTPSe.storage.setOptions({httpNowhere: !HTTPSe.httpNowhere});
  }, false);

  if (HTTPSe.httpNowhere)
    httpNowhereCheckbox.setAttribute("checked", "");

  i18nReplace();
  e("whatIsThis").setAttribute("title", chrome.i18n.getMessage("chrome_what_is_this_title"));
  e("add-rule-link").addEventListener("click", addUserRule);
});

function addUserRule() {
  chrome.tabs.getSelected(null, (tab) => {
    hide(e("add-rule-link"));
    show(e("add-new-rule-div"));

    const newUrl = new URL(tab.url);
    newUrl.protocol = "https:";
    e("new-rule-host").value = newUrl.host;

    const oldUrl = new URL(tab.url);
    oldUrl.protocol = "http:";

    const oldMatcher = "^" + escapeForRegex(oldUrl.protocol + "//" + oldUrl.host+ "/");
    e("new-rule-regex").value = oldMatcher;

    const redirectPath = newUrl.protocol + "//" + newUrl.host + "/";
    e("new-rule-redirect").value = redirectPath;
    e("new-rule-name").value = "Manual rule for " + oldUrl.host;

    e("add-new-rule-button").addEventListener("click", () => {
      const params = {
        target: e("new-rule-host").value,
        from: e("new-rule-regex").value,
        to: e("new-rule-redirect").value
      };

      HTTPSe.rulesets.addUserRule(params);
      HTTPSe.userRules.push(params);
      HTTPSe.storage.setOptions({userRules: HTTPSe.userRules});
      location.reload();
    });

    e("cancel-new-rule").addEventListener("click", () => {
      show(e("add-rule-link"));
      hide(e("add-new-rule-div"));
    });

    e("new-rule-show-advanced-link").addEventListener("click", () => {
      show(e("new-rule-advanced"));
      hide(e("new-rule-regular-text"));
    });

    e("new-rule-hide-advanced-link").addEventListener("click", () => {
      hide(e("new-rule-advanced"));
      show(e("new-rule-regular-text"));
    });
  });
}

})();
