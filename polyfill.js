/**
 * Use window.browser for all WebExtensions calls
 */
window.browser = (function () {
	return window.msBrowser
		|| window.browser
		|| window.chrome;
})();


/**
 * Edge needs to be able to iterate over NodeLists
 */
try {
NodeList.prototype.forEach = NodeList.prototype.forEach || Array.prototype.forEach;
} catch(e) {}

/**
 * Edge doesn't support the Zoom apis
 */
try {
browser.tabs.getZoom = browser.tabs.getZoom || function() {};
browser.tabs.onZoomChange = browser.tabs.onZoomChange || { addListener: function() {} };
} catch(e) {}


/**
 * Object.assign
 */
if (typeof Object.assign != 'function') {
  Object.assign = function(target, varArgs) { // .length of function is 2
    'use strict';
    if (target == null) { // TypeError if undefined or null
      throw new TypeError('Cannot convert undefined or null to object');
    }

    var to = Object(target);

    for (var index = 1; index < arguments.length; index++) {
      var nextSource = arguments[index];

      if (nextSource != null) { // Skip over if undefined or null
        for (var nextKey in nextSource) {
          // Avoid bugs when hasOwnProperty is shadowed
          if (Object.prototype.hasOwnProperty.call(nextSource, nextKey)) {
            to[nextKey] = nextSource[nextKey];
          }
        }
      }
    }
    return to;
  };
}
