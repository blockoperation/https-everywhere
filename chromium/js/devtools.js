(function() {
"use strict";

chrome.devtools.panels.create(chrome.i18n.getMessage("about_ext_name"),
                              "icon48.png", "panel.html");

})();
