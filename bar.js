setTimeout(function() {
var Toolbar = {
	id: 'discoverbar',
	theme: {},
};
Toolbar.theme = {
  url: "toolbar.html",
	iframe: 'position:fixed;bottom:0;left:0;display:none;' +
        	'width:288px;height:90px;z-index:2147483647;border:0;' +
			'overflow:hidden;box-shadow: 0 0 16px -4px #000; border-radius:4px; border: 1px solid #aaa;',
	css:    '#discoverbar { transition: height .2s,width .2s; }',
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
	try {
		var document = window.top.document;
		if (window.document != document)
			return false;
	} catch (e) {
		return false;
		var document = window.document;
	}
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
	iframe.scrolling = 'no';
    iframe.id = Toolbar.id;

	document.addEventListener("readystatechange", function() {
		var node = document.createElement('style');
		node.innerHTML = Toolbar.theme.css;
		document.body.appendChild(node);
	});

	var itop = iframe.offsetTop, ileft = iframe.offsetLeft;
	var dtop = 0, dleft = 0, dstate = false;
	var mtop = 0, mleft = 0, mstate = false;
	var dpos = {};
	var mpos = { mouse: {} }
	iframe.style.bottom = 'inherit';
	iframe.style.top = itop + 'px';

function throttle(fn, threshhold, scope) {
  threshhold || (threshhold = 250);
  var last,
      deferTimer;
  return function () {
    var context = scope || this;

    var now = +new Date,
        args = arguments;
    if (last && now < last + threshhold) {
      // hold on to it
      clearTimeout(deferTimer);
      deferTimer = setTimeout(function () {
        last = now;
        fn.apply(context, args);
      }, threshhold);
    } else {
      last = now;
      fn.apply(context, args);
    }
  };
}
function debounce(fn, delay) {
  var timer = null;
  return function () {
    var context = this, args = arguments;
    clearTimeout(timer);
    timer = setTimeout(function () {
      fn.apply(context, args);
    }, delay || 250);
  };
}

function sendToIframe(msg) {
	if (iframe.contentWindow) {
		iframe.contentWindow.postMessage(msg, extensionOrigin);
	} else {
		//console.log('Missing iframe', iframe);
	}
}

var communicateMouseMove = debounce(function() {
	sendToIframe({action: 'mouse', data: mpos })
}, 1);

window.addEventListener("mousemove", function(event) {
	if (!(event instanceof MouseEvent)/* || !event.isTrusted*/)
		return;
	mpos.mouse.x = event.clientX;
	mpos.mouse.y = event.clientY;
	mpos.from    = 'window';
	updateIframePos();
	communicateMouseMove();
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

function handleRepos(rpos, noMargin) {
	['top', 'left', 'right', 'bottom'].forEach(function(side) {
		iframe.style[side] = 'initial';
		iframe.style['margin-' + side] = 'initial';
	});
	iframe.style[rpos.vside] = rpos.v + '%';
	iframe.style[rpos.hside] = rpos.h + '%';

	handleTrySnap(rpos)
}

function handleTrySnap(rpos) {
	if (rpos.v <= 1) {
		iframe.style['margin-' + rpos.vside] = '-3px';
		iframe.style[rpos.vside] = '0';
	}
	if (rpos.h <= 1) {
		iframe.style['margin-' + rpos.hside] = '-3px';
		iframe.style[rpos.hside] = '0';
	}
}


var lastEvent = null;
window.addEventListener("message", function(event) {
	if (!event.data || !event.data.type/* || event.origin != extensionOrigin/* || event.isTrusted !== true*/) {
		return
	}
	//if (lastEvent != event.data.type)
	//	console.log(event.data.type, event.data);
	//lastEvent = event.data.type;
	if (event.data.type == 'drag') {
		if (dpos.state == 'down') {
			['top', 'left', 'right', 'bottom'].forEach(function(side) {
				iframe.style['margin-' + side] = 'initial';
			});
			dpos.state = 'drag';
		}
		mpos.internal = event.data.message;
		mpos.from = 'iframe';
		updateIframePos();
		return;
	}
	if (event.data.type == 'down' && dpos.state != 'down') {
		dpos = { from: 'iframe', mouse: mpos.mouse, iframe: { y: iframe.offsetTop, x: iframe.offsetLeft }, internal: event.data.message };
		mpos = { from: 'iframe', mouse: mpos.mouse, iframe: { y: iframe.offsetTop, x: iframe.offsetLeft }, internal: event.data.message };
		dpos.state = 'down';
		return;
	}
	if (event.data.type == 'up') {
		dpos.state = 'up';
		var rpos = {
			v: Math.max((iframe.offsetTop ) / window.innerHeight * 100, 0),
			h: Math.max((iframe.offsetLeft) / window.innerWidth  * 100, 0),
			vside: 'top',
			hside: 'left',
		}
		if (rpos.v > 50) {
			rpos.v = Math.max(100 - rpos.v - 100 * iframe.offsetHeight / window.innerHeight, 0);
			rpos.vside = 'bottom';
		}
		if (rpos.h > 50) {
			rpos.h = Math.max(100 - rpos.h - 100 * iframe.offsetWidth  / window.innerWidth , 0);
			rpos.hside = 'right';
		}
		handleRepos(rpos);
		sendToIframe({action: 'repos', from: 'bar', data: { rpos: rpos } });
//		chrome.runtime.sendMessage({action: 'repos', from: 'bar', data: { rpos: rpos } }, function(response) {
//		});
		return;
	}
	if (event.data.type == 'redraw') {
		if (event.data.message.toolbar.h && event.data.message.toolbar.w) {
			iframe.style.height = event.data.message.toolbar.h + 'px';
			iframe.style.width  = event.data.message.toolbar.w + 'px';
			updateIframePos();
		}
		if (event.data.message.toolbar.rpos)
			handleRepos(event.data.message.toolbar.rpos);
		iframe.style.display = 'block';
		return;
	}
});
		var tryInjection = function() {
			if (!document.getElementById('discoverbar'))
				document.documentElement.appendChild(iframe);
		}
		setInterval(tryInjection, 1000);
}
}, 0);
