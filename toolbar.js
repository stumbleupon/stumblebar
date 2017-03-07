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
		document.querySelector("#stumble").removeClass("enabled");
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
		document.querySelector("#inline-info-body").innerHTML = message;

		document.querySelector("#info").removeClass("on");
		if (url.urlid) {
			document.querySelector("#info").addClass("on");
		}

		if (url.hasOwnProperty('sponsored')) {
			document.querySelector("#sponsored").changeClass("hidden", !url.sponsored);
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
		if (config.mode && config.mode != Toolbar.config.mode) {
			//document.querySelector(".toolbar-mode-selection").addClass("hidden");
			//document.querySelector(".toolbar-mode").removeClass("hidden");
			document.querySelector("#mode").innerText = config.modes[config.mode].name;
		}

		if (config.hasOwnProperty('numShares')) {
			document.querySelector("#inbox .badge").innerText = config.numShares ? parseInt(config.numShares) : '';
			document.querySelector("#inbox").changeClass('enabled', parseInt(config.numShares));
		}

		if (config.hasOwnProperty('authed')) {
			document.querySelector("#stumble").changeClass('hidden', !config.authed);
			document.querySelector("#signin") .changeClass('hidden', config.authed);
			if (!config.authed)
				Toolbar.handleMiniMode();
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
		if (!r || r.from != 'bar')
			Toolbar.handleRedraw();
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
		while (elem && elem.getAttribute && !elem.getAttribute('action')) {
			elem = elem.parentNode;
		}
		if (!elem || !elem.getAttribute)
			return;
		var action = elem.getAttribute('action');
		var value  = elem.getAttribute('value');

		Toolbar.handleImmediateAction(action, value, elem);
		Toolbar.dispatch(action, {value: value})
			.then(Toolbar.handleResponse);
		Toolbar.handleRedraw();
	},

	handleImmediateAction: function(action, value, elem) {
		if (action == "su") {
			chrome.tabs.create({ url: Toolbar.config.suPages[value].form(Toolbar.config) });
		}
		if (action == 'stumble' || action == 'mode') {
			document.querySelector(".action-stumble").toggleClass("enabled");
			document.querySelector(".toolbar-container").removeClass("mode-expanded");
		}
		if (action == 'expand' && value == 'inline-info') {
			document.querySelector(".toolbar-container").toggleClass("inline-info-expanded");
		}
		if (action == 'inbox') {
			document.querySelector(".toolbar-container").toggleClass("inbox-expanded");
		}
		if (action == 'expand' && value == 'mode') {
			document.querySelector(".toolbar-container").toggleClass("mode-expanded");
		}
		if (action == 'expand' && value == 'social') {
			//document.querySelector(".toolbar-social-container .toolbar-expand-icon").toggleClass("enabled");
			//document.querySelector(".action-inbox").toggleClass("enabled");
		}
		if (action == 'settings') {
			elem.toggleClass("enabled");
			document.querySelector(".toolbar-settings-container").toggleClass("hidden");
		}
		if (action == 'hide') {
		}
	},
	mouse: {},
	config: {},
	state: {
		lastMouse:     Date.now(),
		canMiniMode:   false,
		inMiniMode:    false,
	},
	handleMouseDown: function(e) {
		Toolbar.mouse = { state: 'down', pos: { x: e.screenX, y: e.screenY } };
		window.top.postMessage({ type: "down", message: { screen: { x: e.screenX, y: e.screenY }, client: { x: e.clientX, y: e.clientY } } }, "*");
	},
	handleMouseMove: function(e) {
		if (!e.button && !e.buttons)
			Toolbar.mouse.state = 'up';
		if (Toolbar.mouse.state == 'down' && Math.max(Math.abs(Toolbar.mouse.pos.x - e.screenX), Math.abs(Toolbar.mouse.pos.y - e.screenY)) >= 8)
			Toolbar.mouse.state = 'drag';
		if (Toolbar.mouse.state == 'drag')
			window.top.postMessage({ type: "drag", message: { screen: { x: e.screenX, y: e.screenY }, client: { x: e.clientX, y: e.clientY } } }, "*");
		Toolbar.state.lastMouse = Date.now();
		Toolbar.state.canMiniMode = false;
		if (Toolbar.state.inMiniMode)
			Toolbar.handleNormalMode(e);
	},
	handleMouseUp: function(e) {
		if (Toolbar.mouse.state == 'drag')
			Toolbar.mouse.state = 'up';
		else
			Toolbar.mouse.state = null;
		e.stopPropagation();
		window.top.postMessage({ type: "up", message: { screen: { x: e.screenX, y: e.screenY }, client: { x: e.clientX, y: e.clientY } } }, "*");
	},
	tryMiniMode: function(e) {
		if (Toolbar.state.canMiniMode && !Toolbar.state.inMiniMode && Toolbar.state.lastMouse && Date.now() - Toolbar.state.lastMouse >= (Toolbar.config.miniModeTimeout || 10)) {
			Toolbar.handleMiniMode(e);
		}
	},
	handleMiniMode: function(e) {
		Toolbar.state.inMiniMode = true || !Toolbar.config.authed;
		document.querySelector("#toolbar").addClass("mini-mode");
		Toolbar.handleRedraw();
	},
	handleNormalMode: function(e) {
		if (!Toolbar.config.authed)
			return false;
		Toolbar.state.inMiniMode = false;
		document.querySelector("#toolbar").removeClass("mini-mode");
		Toolbar.handleRedraw();
	},
	handleRedraw: function() {
		if (Toolbar.config.rpos) {
			document.querySelector('#toolbar').changeClass('top-handed',   Toolbar.config.rpos.vside == 'top');
			document.querySelector('#toolbar').changeClass('right-handed', Toolbar.config.rpos.hside == 'right');
		}
		window.top.postMessage({ type: "redraw", message: { toolbar: {
			w: Toolbar.state.w = document.querySelector(".toolbar-section-container").offsetWidth,
			h: Toolbar.state.h = document.querySelector(".toolbar-section-container").offsetHeight,
			rpos: Toolbar.config.rpos,
			hidden: Toolbar.config.hidden,
		} } }, "*");
	},
	handleIframeEvent: function(e) {
		if (e.data.action == 'mouse') {
			var data = e.data.data;
			Toolbar.state.canMiniMode = !data || !data.iframe || !( // We can do mini mode if the mouse isn't hovering over the frame
				   data.iframe.x < data.mouse.x && data.iframe.x + Toolbar.state.w > data.mouse.x
				&& data.iframe.y < data.mouse.y && data.iframe.y + Toolbar.state.h > data.mouse.y
			);
			return;
		}
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

