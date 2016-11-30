var currentTab;
var currentBookmark;

/*
 * Updates the browserAction icon to reflect whether the current page
 * is already bookmarked.
 */
function updateIcon() {
  return;
  chrome.browserAction.setIcon({
    path: currentBookmark ? {
      19: "icons/star-filled-19.png",
      38: "icons/star-filled-38.png"
    } : {
      19: "icons/star-empty-19.png",
      38: "icons/star-empty-38.png"
    },
    tabId: currentTab.id
  });
}

/*
 * Add or remove the bookmark on the current page.
function discoverIt() {
console.log(currentTab);
//  currentTab.url = "http://www.stumbleupon.com/su";
   chrome.tabs.update(currentTab.id, {
     "url": "http://www.stumbleupon.com/su"
   });
   //chrome.tabs.open({
   //  "url": "http://www.stumbleupon.com/su"
   //});
  return;
  if (currentBookmark) {
    chrome.bookmarks.remove(currentBookmark.id);
    currentBookmark = null;
    updateIcon();
  } else {
    chrome.bookmarks.create({title: currentTab.title, url: currentTab.url}, function(bookmark) {
      currentBookmark = bookmark;
      updateIcon();
    });
  }
}

chrome.browserAction.onClicked.addListener(discoverIt);

/*
 * Switches currentTab and currentBookmark to reflect the currently active tab
 *


function updateTab() {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (tabs[0]) {
      currentTab = tabs[0];
    }
  });
//console.log(currentTab);
  var iframe = document.createElement("iframe");
  iframe.style.position = 'fixed';
  iframe.style.top = '50px';
  iframe.style.right = '50px';
  iframe.style.width = "100px;";
  iframe.style.height = "30px;";
  iframe.srcdoc = '<div><a href="">Stumble</a> | <a href="">Like</a></div>';
  this.document.body.addEventListener('load', function() {
    document.body.innerHTML = 'fOO';
    document.body.appendChild(iframe);
  });
}
*/

// TODO listen for bookmarks.onCreated and bookmarks.onRemoved once Bug 1221764 lands

// listen to tab URL changes
chrome.tabs.onUpdated.addListener(Page.handleTabUpdate);

// listen to tab switching
chrome.tabs.onActivated.addListener(Page.handleTabSwitch);

// update when the extension loads initially
//updateTab();


