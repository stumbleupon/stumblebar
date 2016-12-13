Element.prototype.addClass = function(name) {
	if (!this.hasClass(name))
		this.className += ' ' + name;
}

Element.prototype.removeClass = function(name) {
	this.className = this.className.replace(RegExp('(\\s|^)' + name + '(\\s|$)'), ' ').trim();
}

Element.prototype.hasClass = function(name) {
	return this.className.match(RegExp('(\\s|^)' + name + '(\\s|$)'))
}

Element.prototype.toggleClass = function(name) {
	this.hasClass(name) ? this.removeClass(name) : this.addClass(name);
}

String.prototype.numberFormat = function() {
	if (this < 1000)
		return this;
	else if (this < 10000)
		return Math.floor(parseInt(this) / 1000) + '.' + Math.floor(parseInt(this) / 100)%10 + 'k';
	else if (this < 1000000)
		return Math.floor(parseInt(this) / 1000) + 'k';
	else
		return Math.floor(parseInt(this) / 1000000, 1) + '.' + Math.floor(parseInt(this) / 100000)%10 + 'm';
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
		if (url.userRating) {
			if (url.userRating.type >= 1)
				document.querySelector("#like").addClass("enabled");
			if (url.userRating.type <= -1)
				document.querySelector("#dislike").addClass("enabled");
		}
		var message = "Be the first to like this!"
		if (url.likes) {
			message = "Liked by " + url.likes.numberFormat() + " people";
		}
		document.querySelector("#social").innerHTML = message;
	},

	handleConfig: function(config) {
		Toolbar.config = config;

		Toolbar.handleRedraw();
	},

	handleResponse: function(r) {
		console.log('Toolbar.handleResponse', r);
		if (r && r.url) {
			Toolbar.handleUrl(r.url);
		}
		if (r && r.config) {
			Toolbar.handleConfig(r.config);
		}
		return true;
	},
	dispatch: function(a, data) {
		return new Promise(function (resolve, reject) {
			chrome.runtime.sendMessage({
				action: a,
				url: Toolbar.url || {},
				data: data || {}
			}, resolve);
		});
	},
	handleEvent: function(e) {
		if (Toolbar.mouse.state == 'up') {
			Toolbar.mouse.state = null;
			return;
		}
		var action = e.target.getAttribute('action');
		if (!action)
			return;
		console.log(action);
		Toolbar.dispatch(action)
			.then(Toolbar.handleResponse);
		if (action == 'extra') {
			document.querySelector(".toolbar-social-container").toggleClass("hidden");
		}
		if (action == 'expand-social') {
			document.querySelector(".toolbar-social-container .toolbar-expand-icon").toggleClass("enabled");
		}
		if (action == 'settings') {
			document.querySelector(".toolbar-settings-container").toggleClass("hidden");
		}
		if (action.indexOf('theme-') === 0) {
			var classes = document.querySelector("#toolbar").classList;
			for (var i = 0; i < classes.length; i++)
				if (classes[i].indexOf('theme-') === 0)
					document.querySelector("#toolbar").removeClass(classes[i]);
			document.querySelector("#toolbar").addClass(action);
		}
		Toolbar.handleRedraw();
	},
	mouse: {},
	config: {},
	state: {
		lastMouse: 0,
		canMiniMode: false,
		inMiniMode: false,
	},
	handleMouseDown: function(e) {
		Toolbar.mouse = { state: 'down', pos: { x: e.screenX, y: e.screenY } };
		window.top.postMessage({ type: "down", message: { screen: { x: e.screenX, y: e.screenY }, client: { x: e.clientX, y: e.clientY } } }, "*");
	},
	handleMouseMove: function(e) {
		if (Toolbar.mouse.state == 'down' && Math.max(Math.abs(Toolbar.mouse.pos.x - e.screenX), Math.abs(Toolbar.mouse.pos.y - e.screenY)) >= 4)
			Toolbar.mouse.state = 'drag';
		if (Toolbar.mouse.state == 'drag')
			window.top.postMessage({ type: "drag", message: { screen: { x: e.screenX, y: e.screenY }, client: { x: e.clientX, y: e.clientY } } }, "*");
		Toolbar.state.lastMouse = Date.now();
		Toolbar.state.canMiniMode = false;
		if (Toolbar.state.inMiniMode)
			Toolbar.handleNormalMode(e);
	},
	tryMiniMode: function(e) {
		if (Toolbar.state.canMiniMode && !Toolbar.state.inMiniMode && Date.now() - Toolbar.state.lastMouse >= (Toolbar.config.miniModeTimeout || 10)) {
			Toolbar.handleMiniMode(e);
		}
	},
	handleMiniMode: function(e) {
		Toolbar.state.inMiniMode = true;
		document.querySelector("#toolbar").addClass("mini-mode");
		Toolbar.handleRedraw();
	},
	handleNormalMode: function(e) {
		Toolbar.state.inMiniMode = false;
		document.querySelector("#toolbar").removeClass("mini-mode");
		Toolbar.handleRedraw();
	},
	handleMouseUp: function(e) {
		if (Toolbar.mouse.state == 'drag')
			Toolbar.mouse.state = 'up';
		else
			Toolbar.mouse.state = null;
		e.stopPropagation();
		window.top.postMessage({ type: "up", message: { screen: { x: e.screenX, y: e.screenY }, client: { x: e.clientX, y: e.clientY } } }, "*");
	},
	handleRedraw: function() {
		window.top.postMessage({ type: "redraw", message: { toolbar: {
			w: document.querySelector(".toolbar-section-container").offsetWidth,
			h: document.querySelector(".toolbar-section-container").offsetHeight,
			rpos: Toolbar.config.rpos,
		} } }, "*");
	},
	handleIframeEvent: function(e) {
		if (e.data.action == 'mouse')
			return Toolbar.state.canMiniMode = true;
		Toolbar.dispatch(e.data.action, e.data.data).then(Toolbar.handleResponse);
	},
	init: function() {
		// Event and message handling
		document.getElementById("toolbar").addEventListener("click", Toolbar.handleEvent);
		chrome.runtime.onMessage.addListener(Toolbar.handleResponse);
		window.addEventListener("message", Toolbar.handleIframeEvent, false);

		// Toolbar initialization
		Toolbar.dispatch('init')
			   .then(Toolbar.handleResponse);
		Toolbar.dispatch('urlChange')
			   .then(Toolbar.handleResponse);
		window.setInterval(Toolbar.tryMiniMode, 1000);

		// Drag-n-drop logic
		document.addEventListener("mousedown", Toolbar.handleMouseDown);
		document.addEventListener("mousemove", Toolbar.handleMouseMove);
		document.addEventListener("mouseup",   Toolbar.handleMouseUp);

		// Redraw
		//Toolbar.handleRedraw();
		//Toolbar._events.forEach(function(entry) {
		//	document.getElementById(entry.id).addEventListener(entry.ev, Toolbar[entry.cb])
		//});
	},
	_events: [{ ev: 'click', id: 'stumble', cb: 'stumble' }]
}
Toolbar.init();

