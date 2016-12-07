var Toolbar = {
	id: 'discoverbar',
  theme: {},
};
Toolbar.theme = {
  url: "toolbar.html",
	iframe: 'position:fixed;bottom:69px;left:69px;display:block;' +
        	'width:288px;height:90px;z-index:2147483647;border:0;' +
			'overflow:hidden;box-shadow: 0 0 16px #000; border-radius:4px; border: 1px solid #aaa;',
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
console.log(		  chrome.extension.onRequest);
    iframe.src = chrome.runtime.getURL(Toolbar.theme.url);
    iframe.style.cssText = Toolbar.theme.iframe;
	iframe.allowTransparency = "true";
    iframe.id = Toolbar.id;
	var itop = iframe.offsetTop, ileft = iframe.offsetLeft;
	var dtop = 0, dleft = 0, dstate = false;
	var mtop = 0, mleft = 0, mstate = false;
	var dpos = {};
	var mpos = { mouse: {} }
	iframe.style.bottom = 'inherit';
	iframe.style.top = itop + 'px';
window.top.addEventListener("mousemove", function(event) {
	if (!(event instanceof MouseEvent) || !event.isTrusted)
		return;
	mpos.mouse.x = event.clientX;
	mpos.mouse.y = event.clientY;
	mpos.from    = 'window';
	updateIframePos();
});

function updateIframePos() {
	if (dpos.state == 'drag') {
		//    last pos outside of iframe  - mousedown pos in iframe + change in mouse screen position from mouse down
		if (mpos.from == 'iframe') {
			mpos.iframe = {
				x: (dpos.iframe.x + (mpos.internal.screen.x - dpos.internal.screen.x)),
				y: (dpos.iframe.y + (mpos.internal.screen.y - dpos.internal.screen.y))
			}
		} else {
			mpos.iframe = {
				x: (mpos.mouse.x - dpos.internal.client.x),
				y: (mpos.mouse.y - dpos.internal.client.y)
			};
		}
		iframe.style.left = Math.min(window.innerWidth  - iframe.offsetWidth , Math.max(0, mpos.iframe.x)) + 'px';
		iframe.style.top  = Math.min(window.innerHeight - iframe.offsetHeight, Math.max(0, mpos.iframe.y)) + 'px';
		//iframe.style.left = (mpos.mouse.x + (mpos.internal.client.x - dpos.internal.client.x)) + 'px';
		//iframe.style.top  = (mpos.mouse.y + (mpos.internal.client.y - dpos.internal.client.y)) + 'px';
		//iframe.style.top  = (mpos.y - dpos.iframe.y + (mpos.y - dpos.mouse.y) + (mpos.internal.client.y - dpos.internal.client.y)) + 'px';
	}
}

window.top.addEventListener("message", function(event) {
	if (!event.data || !event.data.type) {
		return
	}
	if (event.data.type == 'down' && dpos.state != 'down') {
		dpos = { from: 'iframe', mouse: mpos.mouse, iframe: { y: iframe.offsetTop, x: iframe.offsetLeft }, internal: event.data.message };
		mpos = { from: 'iframe', mouse: mpos.mouse, iframe: { y: iframe.offsetTop, x: iframe.offsetLeft }, internal: event.data.message };
		dpos.state = 'down';
		return;
	}
	if (event.data.type == 'up') {
		dpos.state = 'up';
	}
	if (event.data.type == 'drag') {
		if (dpos.state == 'down')
			dpos.state = 'drag';
		mpos.internal = event.data.message;
		mpos.from = 'iframe';
		updateIframePos();
	}
	return;
		iframe.style.bottom = 'inherit';
		console.log(event);
		console.log(event.data.message.screenX, iframe.offsetWidth, event.data.message.screenX - iframe.offsetWidth,event.data.message.screenY - iframe.offsetHeight)
		iframe.style.top  = (event.data.message.screenX - iframe.offsetWidth ) + 'px';
		iframe.style.left = (event.data.message.screenY - iframe.offsetHeight) + 'px';
});
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
