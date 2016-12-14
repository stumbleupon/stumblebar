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
			message = "Liked by " + String(url.likes).numberFormat() + " people";
		}
		document.querySelector("#social").innerHTML = message;

		document.querySelector("#info").removeClass("enabled");
		if (url.urlid) {
			document.querySelector("#info").addClass("enabled");
		}
	},

	handleConfig: function(config) {
		if (config.theme && config.theme != Toolbar.config.theme) {
			var classes = document.querySelector("#toolbar").classList;
			for (var i = 0; i < classes.length; i++)
				if (classes[i].indexOf('theme-') === 0)
					document.querySelector("#toolbar").removeClass(classes[i]);
			document.querySelector("#toolbar").addClass('theme-' + config.theme);
			document.querySelectorAll(".action-theme").forEach(function(elem) {
				elem.removeClass('enabled');
			});
			document.querySelector("#theme-" + config.theme).addClass('enabled');
		}

		for (var key in config) {
			Toolbar.config[key] = config[key];
		}

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
		var elem   = e.target;
		var action = elem.getAttribute('action');
		var value  = elem.getAttribute('value');
		if (!action)
			return;
		console.log(action);
		Toolbar.dispatch(action, {value: value})
			.then(Toolbar.handleResponse);
		//if (action == 'info') {
		//	chrome.tabs.create({ url: Toolbar.config.url.info.form(Toolbar.url) });
		//}
		if (action == 'expand' && value == 'extra') {
			document.querySelector(".action-extra").toggleClass("enabled");
			document.querySelector(".toolbar-container-extra").toggleClass("hidden");
			document.querySelector(".toolbar-social-container").toggleClass("hidden");
		}
		if (action == 'expand' && value == 'social') {
			//document.querySelector(".toolbar-social-container .toolbar-expand-icon").toggleClass("enabled");
			//document.querySelector(".action-inbox").toggleClass("enabled");
		}
		if (action == 'settings') {
			elem.toggleClass("enabled");
			document.querySelector(".toolbar-settings-container").toggleClass("hidden");
		}
		//if (action == 'theme') {
		//	var classes = document.querySelector("#toolbar").classList;
		//	for (var i = 0; i < classes.length; i++)
		//		if (classes[i].indexOf('theme-') === 0)
		//			document.querySelector("#toolbar").removeClass(classes[i]);
		//	document.querySelector("#toolbar").addClass(action + '-' + value);
		//}
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

