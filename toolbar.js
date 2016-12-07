Element.prototype.addClass = function(name) {
	this.className += ' ' + name;
}

Element.prototype.removeClass = function(name) {
	this.className = this.className.replace(RegExp('(\\s|^)' + name + '(\\s|$)'), ' ');
}

var Toolbar = {
	event: function(e) {
		/*
		console.log(e);
		//chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
		//console.log(tabs[0])
		//  chrome.tabs.sendMessage(tabs[0].id, {greeting: "hello"}, function(response) {
		//    console.log(response);
		//  });
		//});
		//  chrome.tabs.getSelected(null, function(tab) {
		chrome.runtime.sendMessage({greeting: "stumble"}, function(response) {
			console.log('moop',response);
		});
		//  });
		*/
	},

	handleUrl: function(url) {
		Toolbar.url = url;
		document.querySelector("#like")   .removeClass("enabled");
		document.querySelector("#dislike").removeClass("enabled");
		if (url.userRating.type >= 1)
			document.querySelector("#like").addClass("enabled");
		if (url.userRating.type <= -1)
			document.querySelector("#dislike").addClass("enabled");
	},

	handleResponse: function(r) {
		console.log('HANDLE', r);
		if (r.url) {
			Toolbar.handleUrl(r.url);
		}
		return true;
	},
	dispatch: function(a) {
		return new Promise(function (resolve, reject) {
			chrome.runtime.sendMessage({
				action: a,
				url: Toolbar.url || {}
			}, resolve);
		});
	},
	handleEvent: function(e) {
		if (Toolbar.mouse.state == 'up') {
			Toolbar.mouse.state = null;
			return;
		}
		if (!e.target.getAttribute('action'))
			return;
		console.log(e.target.getAttribute('action'));
		Toolbar.dispatch(e.target.getAttribute('action'))
			.then(Toolbar.handleResponse);
	},
	mouse: {},
	handleMouseDown: function(e) {
		Toolbar.mouse = { state: 'down', pos: { x: e.screenX, y: e.screenY } };
		window.top.postMessage({ type: "down", message: { screen: { x: e.screenX, y: e.screenY }, client: { x: e.clientX, y: e.clientY } } }, "*");
	},
	handleMouseMove: function(e) {
		if (Toolbar.mouse.state == 'down' && Math.max(Math.abs(Toolbar.mouse.pos.x - e.screenX), Math.abs(Toolbar.mouse.pos.y - e.screenY)) >= 4)
			Toolbar.mouse.state = 'drag';
		if (Toolbar.mouse.state == 'drag')
			window.top.postMessage({ type: "drag", message: { screen: { x: e.screenX, y: e.screenY }, client: { x: e.clientX, y: e.clientY } } }, "*");
	},
	handleMouseUp: function(e) {
		Toolbar.mouse = { state: 'up' };
		e.stopPropagation();
		window.top.postMessage({ type: "up", message: { screen: { x: e.screenX, y: e.screenY }, client: { x: e.clientX, y: e.clientY } } }, "*");
	},
	init: function() {
		document.getElementById("toolbar").addEventListener("click", Toolbar.handleEvent);
		chrome.runtime.onMessage.addListener(Toolbar.handleResponse);
		this.dispatch('urlChange');
		document.addEventListener("mousedown", Toolbar.handleMouseDown)
		document.addEventListener("mousemove", Toolbar.handleMouseMove)
		document.addEventListener("mouseup",   Toolbar.handleMouseUp)
		//Toolbar._events.forEach(function(entry) {
		//	document.getElementById(entry.id).addEventListener(entry.ev, Toolbar[entry.cb])
		//});
	},
	_events: [{ ev: 'click', id: 'stumble', cb: 'stumble' }]
}
Toolbar.init();

