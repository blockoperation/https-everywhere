// Stubs so this runs under nodejs. They get overwritten later by util.js
var DBUG = 1;
function log(){};

var MATCH_START = 0;
var MATCH_EXACT = 1;
var MATCH_REGEX = 2;

var httpRegex = /^http:/;
var allMatchRegex = /^(\.[+*])?$/;

function getUrlMatchType(pattern) {
  if (/^\^https?:(\/\/([0-9a-z\-]|\\\.)+\/([#&0-9a-zA-Z_\/\-]|\\\.|\\\?)*\$?)?$/.test(pattern)) {
    return /\$$/.test(pattern) ? MATCH_EXACT : MATCH_START;
  }

  return MATCH_REGEX;
}

/**
 * A single rule
 * @param from
 * @param to
 * @constructor
 */
function Rule(from, to) {
  this.to = to;

  if (from == "^http:") {
    // This is by far the most common case, so use the same regex every time.
    this.from_type = MATCH_REGEX;
    this.from = httpRegex;
  } else {
    this.from_type = getUrlMatchType(from);
    this.from = (this.from_type === MATCH_REGEX) ? new RegExp(from)
                                                 : from.replace(/[\^\\$]/g, "");
  }
}

Rule.prototype = {
  /**
   * Apply this rule to a URL
   * @param urispec The URL to modify
   * @returns {string} The modified URL
   */
  apply: function(urispec) {
    switch (this.from_type) {
      case MATCH_START:
        if (urispec.indexOf(this.from) == 0) {
          return this.to + urispec.substr(this.from.length);
        }
        break;
      case MATCH_EXACT:
        if (urispec == this.from) {
          return this.to;
        }
        break;
      case MATCH_REGEX:
        return urispec.replace(this.from, this.to);
    }

    return urispec;
  }
};


/**
 * Regex-Compile a pattern
 * @param pattern The pattern to compile
 * @constructor
 */
function Exclusion(pattern) {
  this.pattern_type = getUrlMatchType(pattern);
  this.pattern = (this.pattern_type === MATCH_REGEX) ? new RegExp(pattern)
                                                     : pattern.replace(/[\^\\$]/g, "");
}

Exclusion.prototype = {
  /**
   * Test a URL against this exclusion
   * @param urispec The URL to test
   * @returns {boolean}
   */
  test: function(urispec) {
    switch (this.pattern_type) {
      case MATCH_START:
        return (urispec.indexOf(this.pattern) == 0);
      case MATCH_EXACT:
        return (urispec == this.from);
      case MATCH_REGEX:
        return this.pattern.test(urispec);
    }

    return false;
  }
};

/**
 * Generates a CookieRule
 * @param host The host regex to compile
 * @param cookiename The cookie name Regex to compile
 * @constructor
 */
function CookieRule(host, cookiename) {
  if (!allMatchRegex.test(host)) {
    if (/^\^([0-9a-z\-]|\\\.)*[0-9a-z]\$/.test(host)) {
      this.host_type = MATCH_EXACT;
      this.host = host.replace(/[\^\\$]/g, "");
    } else {
      this.host_type = MATCH_REGEX;
      this.host = new RegExp(host);
    }
  }

  if (!allMatchRegex.test(cookiename)) {
    if (/^\^[0-9a-zA-Z_\-]+\$$/.test(cookiename)) {
      this.name_type = MATCH_EXACT;
      this.name = cookiename.replace(/[\^\\$]/g, "");
    } else {
      this.name_type = MATCH_REGEX;
      this.name = new RegExp(cookiename);
    }
  }
}

CookieRule.prototype = {
  /**
   * Test a cookie against this cookie rule
   * @param cookie The cookie to test
   * @returns {boolean}
   */
  test: function(cookie) {
    if (this.host) {
      if (this.host_type === MATCH_EXACT && cookie.domain != this.host) {
        return false;
      } else if (this.host_type === MATCH_REGEX && !this.host.test(cookie.domain)) {
        return false;
      }
    }

    if (this.name) {
      if (this.name_type === MATCH_EXACT && cookie.name != this.name) {
        return false;
      } else if (this.name_type === MATCH_REGEX && !this.name.test(cookie.name)) {
        return false;
      }
    }

    return true;
  }
};

/**
 *A collection of rules
 * @param set_name The name of this set
 * @param match_rule Quick test match rule
 * @param default_state activity state
 * @param note Note will be displayed in popup
 * @constructor
 */
function RuleSet(set_name, match_rule, default_state, note) {
  this.name = set_name;
  if (match_rule)
    this.ruleset_match_c = new RegExp(match_rule);
  else
    this.ruleset_match_c = null;
  this.rules = [];
  this.exclusions = null;
  this.cookierules = null;
  this.active = default_state;
  this.default_state = default_state;
  this.note = note;
}

RuleSet.prototype = {
  /**
   * Check if a URI can be rewritten and rewrite it
   * @param urispec The uri to rewrite
   * @returns {*} null or the rewritten uri
   */
  apply: function(urispec) {
    // If we're covered by an exclusion, go home
    if (this.exclusions) {
      for(var i = 0; i < this.exclusions.length; ++i) {
        if (this.exclusions[i].test(urispec)) {
          log(DBUG,"excluded uri " + urispec);
          return null;
        }
      }
    }
    // If a ruleset has a match_rule and it fails, go no further
    if (this.ruleset_match_c && !this.ruleset_match_c.test(urispec)) {
      log(VERB, "ruleset_match_c excluded " + urispec);
      return null;
    }

    // Okay, now find the first rule that triggers
    for(var i = 0; i < this.rules.length; ++i) {
      var returl = this.rules[i].apply(urispec);
      if (returl != urispec) {
        return returl;
      }
    }

    if (this.ruleset_match_c) {
      // This is not an error, because we do not insist the matchrule
      // precisely describes to target space of URLs ot redirected
      log(DBUG,"Ruleset "+this.name
              +" had an applicable match-rule but no matching rules");
    }
    return null;
  }
};

/**
 * Initialize Rule Sets
 * @param userAgent The browser's user agent
 * @param cache a cache object (lru)
 * @param ruleActiveStates default state for rules
 * @constructor
 */
function RuleSets(userAgent, cache, ruleActiveStates) {
  // Load rules into structure
  var t1 = new Date().getTime();
  this.targets = {};
  this.userAgent = userAgent;

  // A cache for potentiallyApplicableRulesets
  // Size chosen /completely/ arbitrarily.
  this.ruleCache = new cache(1000);

  // A cache for cookie hostnames.
  this.cookieHostCache = new cache(100);

  // A hash of rule name -> active status (true/false).
  this.ruleActiveStates = ruleActiveStates;
}


RuleSets.prototype = {
  /**
   * Iterate through data XML and load rulesets
   */
  addFromObjects: function(sets) {
    for (var i = 0; i < sets.length; ++i) {
      this.parseOneRuleset(sets[i]);
    }
  },

  /**
   * Return the RegExp for the local platform
   */
  localPlatformRegexp: (function() {
    var isOpera = /(?:OPR|Opera)[\/\s](\d+)(?:\.\d+)/.test(this.userAgent);
    if (isOpera && isOpera.length === 2 && parseInt(isOpera[1]) < 23) {
      // Opera <23 does not have mixed content blocking
      log(DBUG, 'Detected that we are running Opera < 23');
      return new RegExp("chromium|mixedcontent");
    } else {
      log(DBUG, 'Detected that we are running Chrome/Chromium');
      return new RegExp("chromium");
    }
  })(),

  /**
   * Load a user rule
   * @param params
   * @returns {boolean}
   */
  addUserRule : function(params) {
    log(INFO, 'adding new user rule for ' + JSON.stringify(params));
    var new_rule_set = new RuleSet(params.host, null, true, "user rule");
    var new_rule = new Rule(params.urlMatcher, params.redirectTo);
    new_rule_set.rules.push(new_rule);
    if (!(params.host in this.targets)) {
      this.targets[params.host] = [];
    }
    this.ruleCache.remove(params.host);
    // TODO: maybe promote this rule?
    this.targets[params.host].push(new_rule_set);
    if (new_rule_set.name in this.ruleActiveStates) {
      new_rule_set.active = (this.ruleActiveStates[new_rule_set.name] == "true");
    }
    log(INFO, 'done adding rule');
    return true;
  },

  /**
   * Does the loading of a ruleset.
   * @param obj An object representing a <ruleset> tag
   */
  parseOneRuleset: function(obj) {
    var default_state = true;
    var note = "";
    if (obj.default_off) {
      default_state = false;
      note += obj.default_off + "\n";
    }

    // If a ruleset declares a platform, and we don't match it, treat it as
    // off-by-default
    if (obj.platform) {
      if (obj.platform.search(this.localPlatformRegexp) == -1) {
        default_state = false;
      }
      note += "Platform(s): " + obj.platform + "\n";
    }

    var rule_set = new RuleSet(obj.name, obj.match_rule, default_state, note.trim());

    // Read user prefs
    if (rule_set.name in this.ruleActiveStates) {
      rule_set.active = (this.ruleActiveStates[rule_set.name] == "true");
    }

    for (var i = 0; i < obj.rules.length; ++i) {
      rule_set.rules.push(new Rule(obj.rules[i].from, obj.rules[i].to));
    }

    if (obj.exclusions) {
      rule_set.exclusions = [];
      for (var i = 0; i < obj.exclusions.length; ++i) {
        rule_set.exclusions.push(new Exclusion(obj.exclusions[i]));
      }
    }

    if (obj.cookierules) {
      rule_set.cookierules = [];
      for (var i = 0; i < obj.cookierules.length; ++i) {
        rule_set.cookierules.push(new CookieRule(obj.cookierules[i].host,
                                                 obj.cookierules[i].name));
      }
    }

    for (var i = 0; i < obj.targets.length; ++i) {
       var host = obj.targets[i];
       if (!(host in this.targets)) {
         this.targets[host] = [];
       }
       this.targets[host].push(rule_set);
    }
  },

  /**
   * Insert any elements from fromList into intoList, if they are not
   * already there.  fromList may be null.
   * @param intoList
   * @param fromList
   */
  setInsert: function(intoList, fromList) {
    if (!fromList) return;
    for (var i = 0; i < fromList.length; i++)
      if (intoList.indexOf(fromList[i]) == -1)
        intoList.push(fromList[i]);
  },

  /**
   * Return a list of rulesets that apply to this host
   * @param host The host to check
   * @returns {*} (empty) list
   */
  potentiallyApplicableRulesets: function(host) {
    // Have we cached this result? If so, return it!
    var cached_item = this.ruleCache.get(host);
    if (cached_item !== undefined) {
        log(DBUG, "Ruleset cache hit for " + host + " items:" + cached_item.length);
        return cached_item;
    }
    log(DBUG, "Ruleset cache miss for " + host);

    var tmp;
    var results = [];
    if (this.targets[host]) {
      // Copy the host targets so we don't modify them.
      results = this.targets[host].slice();
    }

    // Replace each portion of the domain with a * in turn
    var segmented = host.split(".");
    for (var i = 0; i < segmented.length; ++i) {
      tmp = segmented[i];
      segmented[i] = "*";
      this.setInsert(results, this.targets[segmented.join(".")]);
      segmented[i] = tmp;
    }
    // now eat away from the left, with *, so that for x.y.z.google.com we
    // check *.z.google.com and *.google.com (we did *.y.z.google.com above)
    for (var i = 2; i <= segmented.length - 2; ++i) {
      t = "*." + segmented.slice(i,segmented.length).join(".");
      this.setInsert(results, this.targets[t]);
    }
    log(DBUG,"Applicable rules for " + host + ":");
    if (results.length == 0)
      log(DBUG, "  None");
    else
      for (var i = 0; i < results.length; ++i)
        log(DBUG, "  " + results[i].name);

    // Insert results into the ruleset cache
    this.ruleCache.set(host, results);
    return results;
  },

  /**
   * Check to see if the Cookie object c meets any of our cookierule citeria for being marked as secure.
   * knownHttps is true if the context for this cookie being set is known to be https.
   * @param cookie The cookie to test
   * @param knownHttps Is the context for setting this cookie is https ?
   * @returns {*} ruleset or null
   */
  shouldSecureCookie: function(cookie, knownHttps) {
    var hostname = cookie.domain;
    // cookie domain scopes can start with .
    while (hostname.charAt(0) == ".")
      hostname = hostname.slice(1);

    if (!knownHttps && !this.safeToSecureCookie(hostname)) {
        return null;
    }

    var rs = this.potentiallyApplicableRulesets(hostname);
    for (var i = 0; i < rs.length; ++i) {
      var ruleset = rs[i];
      if (ruleset.active && ruleset.cookierules) {
        for (var j = 0; j < ruleset.cookierules.length; j++) {
          if (ruleset.cookierules[j].test(cookie)) {
            return ruleset;
          }
        }
      }
    }
    return null;
  },

  /**
   * Check if it is secure to secure the cookie (=patch the secure flag in).
   * @param domain The domain of the cookie
   * @returns {*} true or false
   */
  safeToSecureCookie: function(domain) {
    // Check if the domain might be being served over HTTP.  If so, it isn't
    // safe to secure a cookie!  We can't always know this for sure because
    // observing cookie-changed doesn't give us enough context to know the
    // full origin URI.

    // First, if there are any redirect loops on this domain, don't secure
    // cookies.  XXX This is not a very satisfactory heuristic.  Sometimes we
    // would want to secure the cookie anyway, because the URLs that loop are
    // not authenticated or not important.  Also by the time the loop has been
    // observed and the domain blacklisted, a cookie might already have been
    // flagged as secure.

    if (domain in domainBlacklist) {
      log(INFO, "cookies for " + domain + "blacklisted");
      return false;
    }
    var cached_item = this.cookieHostCache.get(domain);
    if (cached_item !== undefined) {
        log(DBUG, "Cookie host cache hit for " + domain);
        return cached_item;
    }
    log(DBUG, "Cookie host cache miss for " + domain);

    // If we passed that test, make up a random URL on the domain, and see if
    // we would HTTPSify that.

    var nonce_path = "/" + Math.random().toString();
    var test_uri = "http://" + domain + nonce_path + nonce_path;

    log(INFO, "Testing securecookie applicability with " + test_uri);
    var rs = this.potentiallyApplicableRulesets(domain);
    for (var i = 0; i < rs.length; ++i) {
      if (!rs[i].active) continue;
      if (rs[i].apply(test_uri)) {
        log(INFO, "Cookie domain could be secured.");
        this.cookieHostCache.set(domain, true);
        return true;
      }
    }
    log(INFO, "Cookie domain could NOT be secured.");
    this.cookieHostCache.set(domain, false);
    return false;
  },

  /**
   * Rewrite an URI
   * @param urispec The uri to rewrite
   * @param host The host of this uri
   * @returns {*} the new uri or null
   */
  rewriteURI: function(urispec, host) {
    var newuri = null;
    var rs = this.potentiallyApplicableRulesets(host);
    for(var i = 0; i < rs.length; ++i) {
      if (rs[i].active && (newuri = rs[i].apply(urispec)))
        return newuri;
    }
    return null;
  }
};

// Export for HTTPS Rewriter if applicable.
if (typeof exports != 'undefined') {
  exports.RuleSets = RuleSets;
}
