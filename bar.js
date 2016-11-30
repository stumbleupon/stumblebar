var Toolbar = {
	id: 'discoverbar',
  theme: {},
};
Toolbar.theme = {
  url: "toolbar.html",
	iframe: 'position:fixed;bottom:0;left:0;display:block;' +
        	'width:200px;height:200px;z-index:2147483647;border:0;' +
					'overflow:hidden;',
  draggable: true,
}


var dragAndDropStart = function(e) {
}
var dragAndDropEnd = function(e) {
}
var dragAndDrop = function(e) {
console.log(e);
}
var dragStart = function(e) {
console.log(e);
}

var extensionOrigin = 'chrome-extension://' + chrome.runtime.id;
//if (!window.top.location.ancestorOrigins.contains(extensionOrigin)) {
if ((!location.ancestorOrigins || !location.ancestorOrigins.contains(extensionOrigin)) && location.hostname != "www.stumbleupon.com") {
    var document = window.top.document;
		try {
			console.log(chrome.extension.getBackgroundPage().frames)
		} catch (e) {
    	var iframe = document.createElement('iframe');
console.log("NEW IFRAME", location.href);
		}
		document.adoptNode(iframe);
    iframe.src = chrome.runtime.getURL(Toolbar.theme.url);
    iframe.style.cssText = Toolbar.theme.iframe;
    iframe.id = Toolbar.id;
		if (Toolbar.theme.draggable) {
      iframe.draggable = "true";
  		iframe.addEventListener('dragstart', dragStart);
		}
		//addEventListener('mousedown', dragAndDropStart);
		//addEventListener('mouseup', dragAndDropEnd);
		var tryInjection = function() {
						//document.body.style.marginTop = '50px';
						//document.body.style.height = (window.innerHeight - 50) + 'px';
						if (document.getElementById('discoverbar')) {
										//clearTimeout(timeout);
										return;
						}
						//document.getElementsByTagName('body')[0].style.marginTop = '50px';
						//try {
						//				if (document.body.parentNode.firstChild)
						//								return document.body.parentNode.insertBefore(iframe, document.body.parentNode.firstChild);
						//} catch (e) {}
						//if (document.body.firstChild)
						//				document.body.insertBefore(iframe, document.body.firstChild);
						//else
						//				document.body.appendChild(iframe);
						document.documentElement.appendChild(iframe);
		}
		tryInjection();
		//var timeout = setInterval(tryInjection, 100);
}
