(function() {
"use strict";

const reAllMatch = /^(\.[+*])?$/;
const reHttpToHttpsDomain = /^\^http:\/\/(([0-9a-z-]|\\\.)+)\/$/;

function parseXmlRule(rule) {
  const from = rule.getAttribute("from");
  const to = rule.getAttribute("to");

  if (from === "^http:" && to === "https:") {
    return "";
  } else if (reHttpToHttpsDomain.test(from)) {
      let domain = from.match(reHttpToHttpsDomain);
      if (domain.length > 1) {
        domain = domain[1].replace(/\\\./gi, ".");
        return (to === "https://" + domain + "/") ? domain : from + "\n" + to;
      } else {
        return from + "\n" + to;
      }
  } else {
    return from + "\n" + to;
  }
}

function parseXmlCookieRule(cookierule) {
  let host = cookierule.getAttribute("host");
  if (reAllMatch.test(host))
    host = "";

  let name = cookierule.getAttribute("name");
  if (reAllMatch.test(name))
    name = "";

  return (name === "") ? host : host + "\n" + name;
}

function parseXmlRuleset(xml, id) {
  const name = xml.getAttribute("name");
  const default_off = xml.getAttribute("default_off") || "";
  const platform = xml.getAttribute("platform") || "";

  const rules = [].map.call(
    xml.getElementsByTagName("rule"),
    parseXmlRule
  );
  const exclusions = [].map.call(
    xml.getElementsByTagName("exclusion"),
    (e) => e.getAttribute("pattern")
  );
  const cookierules = [].map.call(
    xml.getElementsByTagName("securecookie"),
    parseXmlCookieRule
  );
  const targets = [].map.call(
    xml.getElementsByTagName("target"),
    (t) => t.getAttribute("host")
  );

  const httpToHttpsOnly = (
    rules.length === 1 && rules[0] === "" &&
    exclusions.length === 0 && cookierules.length === 0
  );

  const rs = {
    id,
    name,
    default_off,
    platform,
    httpToHttpsOnly,
    targets
  };

  if (!httpToHttpsOnly) {
    rs.rules = (rules.length > 0) ? JSON.stringify(rules) : "";
    rs.exclusions = (exclusions.length > 0) ? JSON.stringify(exclusions) : "";
    rs.cookierules = (cookierules.length> 0) ? JSON.stringify(cookierules) : "";
  }

  return rs;
}

function parseXmlRulesets(xml) {
  const result = [];

  const sets = xml.getElementsByTagName("ruleset");
  for (let i = 0, len = sets.length; i < len; ++i)
    result.push(parseXmlRuleset(sets[i], i));

  return result;
}

HTTPSe.parser = {
  parseXmlRulesets
};

})();
