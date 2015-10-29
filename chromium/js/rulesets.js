(function() {
"use strict";

const reStripTrivial = /[\^\\$]/g;
const reTrivialHost = /^\^([0-9a-z-]|\\\.)*[0-9a-z]\$/;
const reTrivialName = /^\^[0-9a-zA-Z_-]+\$$/;
const reTrivialUrl = /^\^https?:\/\/([0-9a-z-]|\\\.)+\/([#&0-9a-zA-Z_\/-]|\\\.|\\\?)*\$?$/;

class StartMatcher {
  constructor(pattern) {
    this.pattern = pattern;
  }
  apply(s, s2) {
    return this.test(s) ? s2 + s.substr(this.pattern.length) : s;
  }
  test(s) {
    return startsWith(s, this.pattern);
  }
}

class ExactMatcher {
  constructor(pattern) {
    this.pattern = pattern;
  }
  apply(s, s2) {
    return this.test(s) ? s2 : s;
  }
  test(s) {
    return (s === this.pattern);
  }
}

class RegexMatcher {
  constructor(pattern) {
    this.s = pattern;
    this.re = null;
  }
  compile() {
    if (this.re !== null)
      return;

    this.re = new RegExp(this.s);
    this.s = null;
  }
  apply(s, s2) {
    this.compile();
    return s.replace(this.re, s2);
  }
  test(s) {
    this.compile();
    return this.re.test(s);
  }
}

class InsensitiveRegexMatcher {
  constructor(pattern) {
    this.s = pattern;
    this.re = null;
  }
  compile() {
    if (this.re !== null)
      return;

    this.re = new RegExp(this.s, "i");
    this.s = null;
  }
  apply(s, s2) {
    this.compile();
    return s.replace(this.re, s2);
  }
  test(s) {
    this.compile();
    return this.re.test(s);
  }
}

function createUrlMatcher(s) {
  if (reTrivialUrl.test(s))
    return /\$$/.test(s) ? new ExactMatcher(s.replace(reStripTrivial, ""))
                         : new StartMatcher(s.replace(reStripTrivial, ""));
  else
    return new RegexMatcher(s);
}

const httpToHttpsRule = {
  apply(url) {
    if (url.protocol === "http:") {
      url.protocol = "https:";
      return true;
    }

    return false;
  },
  test: (url) => (url.protocol === "http:")
};

class Rule {
  constructor(from, to) {
    this.from = createUrlMatcher(from);
    this.to = to;
  }
  apply(url) {
    const newurl = this.from.apply(url.href, this.to);

    if (newurl !== url.href) {
      url.href = newurl;
      return true;
    }

    return false;
  }
  test(url) {
    return this.from.test(url.href);
  }
}

class HostnameRule {
  constructor(host) {
    this.host = host;
  }
  apply(url) {
    if (this.test(url)) {
      url.protocol = "https:";
      return true;
    }

    return false;
  }
  test(url) {
    return (url.host === this.host);
  }
}

function compileRule(s) {
  if (s === "") {
    return httpToHttpsRule;
  } else if (s.indexOf("\n") === -1) {
    return new HostnameRule(s);
  } else {
    const params = s.split("\n");
    return new Rule(params[0], params[1]);
  }
}

class Rules {
  constructor() {
    this._ = [];
  }
  apply(url) {
    for (let i = 0, len = this._.length; i < len; ++i)
      if (this._[i].apply(url))
        return true;

    return false;
  }
  test(url) {
    for (let i = 0, len = this._.length; i < len; ++i )
      if (this._[i].test(url))
        return true;

    return false;
  }
  static create(rules) {
    if (rules.length > 1) {
      const result = new Rules();
      for (let i = 0, len = rules.length; i < len; ++i)
        result._.push(compileRule(rules[i]));
      return result;
    } else if (rules.length === 1) {
      return compileRule(rules[0]);
    }

    return null;
  }
}

class Exclusion {
  constructor(pattern) {
    this.pattern = createUrlMatcher(pattern);
  }
  test(url) {
    return this.pattern.test(url.href);
  }
}

class Exclusions {
  constructor() {
    this._ = [];
  }
  test(url) {
    for (let i = 0, len = this._.length; i < len; ++i)
      if (this._[i].test(url))
        return true;

    return false;
  }
  static create(exclusions) {
    if (exclusions.length > 1) {
      const result = new Exclusions();
      for (let i = 0, len = exclusions.length; i < len; ++i)
        result._.push(new Exclusion(exclusions[i]));
      return result;
    } else if (exclusions.length === 1) {
      return new Exclusion(exclusions[0]);
    }

    return null;
  }
}

const allMatchCookieRule = {
  test: (cookie) => true
};

class CookieRule {
  constructor(host, name) {
    if (reTrivialHost.test(host))
      this.host = new ExactMatcher(host.replace(reStripTrivial, ""));
    else
      this.host = new InsensitiveRegexMatcher(host);

    if (reTrivialName.test(name))
      this.name = new ExactMatcher(name.replace(reStripTrivial, ""));
    else
      this.name = new RegexMatcher(name);
  }
  test(cookie) {
    return (this.host.test(cookie.domain) && this.name.test(cookie.name));
  }
}

class HostnameCookieRule {
  constructor(host) {
    if (reTrivialHost.test(host))
      this.host = new ExactMatcher(host.replace(reStripTrivial, ""));
    else
      this.host = new InsensitiveRegexMatcher(host);
  }
  test(cookie) {
    return this.host.test(cookie.domain);
  }
}

function compileCookieRule(s) {
  if (s === "") {
    return allMatchCookieRule;
  } else if (s.indexOf("\n") === -1) {
    return new HostnameCookieRule(s);
  } else {
    const params = s.split("\n");
    return new CookieRule(params[0], params[1]);
  }
}

class CookieRules {
  constructor() {
    this._ = [];
  }
  test(cookie) {
    for (let i = 0, len = this._.length; i < len; ++i)
      if (this._[i].test(cookie))
        return true;

    return false;
  }
  static create(cookierules) {
    if (cookierules.length > 1) {
      const result = new CookieRules();
      for (let i = 0, len = cookierules.length; i < len; ++i)
        result._.push(compileCookieRule(cookierules[i]));
      return result;
    } else if (cookierules.length === 1) {
      return compileCookieRule(cookierules[0]);
    }

    return null;
  }
}

class Ruleset {
  constructor(id, name, default_state, note) {
    this.id = id;
    this.name = name;
    this.active = default_state;
    this.default_state = default_state;
    this.note = note;
    this.rules = null;
    this.exclusions = null;
    this.cookierules = null;
    this.compiled = false;
  }
  compile() {
    if (this.compiled)
      return;

    this.rules = Rules.create(JSON.parse(this.rules));

    if (this.exclusions !== null)
      this.exclusions = Exclusions.create(JSON.parse(this.exclusions));

    if (this.cookierules !== null)
      this.cookierules = CookieRules.create(JSON.parse(this.cookierules));

    this.compiled = true;
  }
  apply(url) {
    if (!this.compiled)
      this.compile();

    return (!this.testExclusion(url) && this.rules.apply(url));
  }
  test(url) {
    if (!this.compiled)
      this.compile();

    return this.rules.test(url);
  }
  testExclusion(url) {
    if (!this.compiled)
      this.compile();

    return (this.exclusions !== null && this.exclusions.test(url));
  }
  testCookie(cookie) {
    if (!this.compiled)
      this.compile();

    return (this.cookierules !== null && this.cookierules.test(cookie));
  }
}

class HttpToHttpsOnlyRuleset {
  constructor(id, name, default_state, note) {
    this.id = id;
    this.name = name;
    this.active = default_state;
    this.default_state = default_state;
    this.note = note;
  }
  apply(url) {
    return httpToHttpsRule.apply(url);
  }
  test(url) {
    return httpToHttpsRule.test(url);
  }
  testExclusion(url) {
    return false;
  }
  testCookie(cookie) {
    return false;
  }
}

class Rulesets {
  constructor() {
    this.unloadedRulesets = new WeakSet();
    this.targets = new Map();
    this.ruleCache = Object.create(null);
    this.cookieCache = Object.create(null);
  }
  addTarget(host, rs) {
    const old = this.targets.get(host);

    if (old === undefined)
      this.targets.set(host, rs);
    else if (old instanceof Array)
      old.push(rs);
    else
      this.targets.set(host, [old, rs]);
  }
  addUserRule(params) {
    const name = params.target + " (user rule)";
    let rs;

    if (params.from === "^http:" && params.to === "https:") {
      rs = new HttpToHttpsOnlyRuleset(-1, name, true, "user rule");
    } else {
      rs = new Ruleset(-1, name, true, "user rule");
      rs.rules = new Rule(params.from, params.to);
      rs.compiled = true;
    }

    if (HTTPSe.ruleStates[name] !== undefined)
      rs.active = HTTPSe.ruleStates[name];

    delete this.ruleCache[params.target];
    delete this.cookieCache[params.target];
    this.addTarget(params.target, rs);
  }
  toggleRuleset(rs, active) {
    rs.active = active;

    if (rs.active !== rs.default_state)
      HTTPSe.ruleStates[rs.name] = rs.active;
    else
      delete HTTPSe.ruleStates[rs.name];

    HTTPSe.storage.setOptions({ruleStates: HTTPSe.ruleStates});
  }
  enableRuleset(rs, callback) {
    if (this.unloadedRulesets.has(rs)) {
      HTTPSe.storage.loadRuleset(rs.id, (obj) => {
        rs.rules = obj.rules;
        rs.exclusions = obj.exclusions || null;
        rs.cookierules = obj.cookierules || null;

        this.unloadedRulesets.delete(rs);
        this.ruleCache = Object.create(null);
        this.cookieCache = Object.create(null);

        this.toggleRuleset(rs, true);

        if (callback !== undefined)
          callback();
      });
    } else {
      this.toggleRuleset(rs, true);

      if (callback !== undefined)
        callback();
    }
  }
  disableRuleset(rs, callback) {
    this.toggleRuleset(rs, false);

    if (callback !== undefined)
      callback();
  }
  addRuleset(obj) {
    if (!obj.targets)
      return;

    const default_state = (!obj.default_off && (!obj.platform || !/chromium/.test(obj.platform)));
    const note = default_state ? "" : "default off";

    let active = default_state;
    if (HTTPSe.ruleStates[obj.name] !== undefined)
      active = HTTPSe.ruleStates[obj.name];

    let rs;

    if (obj.httpToHttpsOnly) {
      rs = new HttpToHttpsOnlyRuleset(obj.id, obj.name, default_state, note);
    } else {
      if (!obj.rules)
        return;

      rs = new Ruleset(obj.id, obj.name, default_state, note);

      if (active) {
        rs.rules = obj.rules;
        rs.exclusions = obj.exclusions || null;
        rs.cookierules = obj.cookierules || null;
      } else {
        this.unloadedRulesets.add(rs);
      }
    }

    rs.active = active;

    for (let i = 0, len = obj.targets.length; i < len; ++i)
      this.addTarget(obj.targets[i], rs);
  }
  applicableRulesets(host) {
    const cached = this.ruleCache[host];
    if (cached !== undefined)
      return cached;

    log(DBUG, "Rule cache miss for " + host);

    const targets = this.targets.get(host);
    let results;

    if (targets instanceof Array)
      results = targets.slice();
    else if (targets !== undefined)
      results = [targets];
    else
      results = [];

    // Replace each portion of the domain with a * in turn
    const segmented = host.split(".");
    for (let i = 0, len = segmented.length; i < len; ++i) {
      const tmp = segmented[i];
      segmented[i] = "*";
      setInsert(results, this.targets.get(segmented.join(".")));
      segmented[i] = tmp;
    }

    // Now eat away from the left, with *, so that for x.y.z.google.com we
    // check *.z.google.com and *.google.com (we did *.y.z.google.com above)
    for (let i = 2, len = segmented.length; i <= len - 2; ++i)
      setInsert(results, this.targets.get("*." + segmented.slice(i, len).join(".")));

    if (results.length === 0) 
      results = null;

    this.ruleCache[host] = results;
    return results;
  }
  shouldSecureCookie(cookie) {
    const host = removeLeadingChar(cookie.domain, ".");

    if (!this.safeToSecureCookie(host))
      return false;

    const rs = this.applicableRulesets(host);
    if (rs === null)
      return false;

    for (let i = 0, len = rs.length; i < len; ++i)
      if (rs[i].active && rs[i].testCookie(cookie))
        return true;

    return false;
  }
  safeToSecureCookie(host) {
    if (HTTPSe.domainBlacklist.has(host)) {
      log(INFO, "Cookies for " + host + "blacklisted");
      return false;
    }

    const cached = this.cookieCache[host];
    if (cached !== undefined)
      return cached;

    log(DBUG, "Cookie cache miss for " + host);

    const rs = this.applicableRulesets(host);
    if (rs === null) {
      this.cookieCache[host] = false;
      return false;
    }

    const test_url = new URL("");
    test_url.protocol = "http:";
    test_url.hostname = host;
    const nonce_path = "/" + Math.random().toString();
    test_url.pathname = nonce_path + nonce_path;

    for (let i = 0, len = rs.length; i < len; ++i) {
      if (rs[i].active && rs[i].test(test_url)) {
        this.cookieCache[host] = true;
        return true;
      }
    }

    this.cookieCache[host] = false;
    return false;
  }
}

HTTPSe.rulesets = new Rulesets();

})();
