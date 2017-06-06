(function() {
	IframeBar = function(id, origin) {
		this.id = id || this.id;
		this.origin = origin || browser.extension.getURL('').slice(0, -1);

		this.init();
	}

	IframeBar.prototype = {
		id: 'discoverbar',
		theme: {
			url: "toolbar.html",
			//css:    '#discoverbar { transition: width 0.2s, height 0.2s; -webkit-transition-property: background-color, color; -webkit-backface-visibility: hidden; -webkit-perspective: 1000; -webkit-transform:translate3d(0,0,0); -webkit-tap-highlight-color: rgba(0,0,0,0); }',
			draggable: true,
		},

		canInject: function() {
			return (
				!location.ancestorOrigins
			    || !location.ancestorOrigins.contains(this.origin)
			) && (
				// No Stumble /su URLs
				location.hostname != "www.stumbleupon.com"
			    && !location.pathname.match(/^\/su\/[^\/]+/)
			) && (
				// No pop-ups
				window.opener !== window
			) && (
				// No iframes
				window.top == window.self
			);
		},

		getDocument: function() {
			return window.document;
		},

		createIframe: function() {
			var iframe = document.createElement('iframe');
			iframe.sandbox = "allow-scripts allow-forms allow-same-origin";
			iframe.src = browser.runtime.getURL(this.theme.url);
			iframe.style.cssText = '';
			iframe.allowTransparency = "true";
			iframe.scrolling = 'no';
			iframe.id = this.id;
			return iframe;
		},

		init: function() {
			if (this.canInject()) {
				this.document = this.getDocument();
				if (!this.document)
					return false;
				this.onHold = false;
				this.registerPingListener();
				this.iframe = this.createIframe();
				this.drag = new DragNDrop(this.iframe, this.origin, this.hash);
				this.drag.onMessageSendFail(this.handleMessageSendFail.bind(this))
				this.registerFullscreenListener();
				this.attemptInjection();
				return true;
			}
		},


		log: function() {
			//this.log.apply(arguments);
		},


		// Handle https://bugs.chromium.org/p/chromium/issues/detail?id=649947
		handleMessageSendFail: function(dnd) {
			this.log('UNINIT');
			if (IframeBar.pingListener) {
				try {
				browser.runtime.onMessage.removeListener(IframeBar.pingListener);
				} catch (e) {}
				IframeBar.pingListener = false;
			}
			dnd.uninit();
			this.remove();
			this.iframe = false;
		},

		remove: function() {
			if (document.getElementById(this.id))
				document.getElementById(this.id).parentNode.removeChild(document.getElementById(this.id));
			if (document.getElementById('__su__toolbar')) {
				document.getElementById('__su__toolbar').parentNode.removeChild(document.getElementById('__su__toolbar'));
				document.body.style.marginTop = 0;
			}
		},

		registerFullscreenListener: function() {
			['webkit', 'MS', '', 'mozilla'].forEach(function(platform) {
				document.addEventListener(platform + 'fullscreenchange', function(e) {
					try {
						this.drag.fullscreen(document.fullscreen || document.webkitIsFullScreen);
					} catch(ex) {
						this.log(document.webkitIsFullScreen || document.fullscreen, ex);
					}
				}.bind(this));
			}.bind(this));
		},

		registerPingListener: function() {
			browser.runtime.onMessage.addListener(
				IframeBar.pingListener = 
				function(request, sender, sendResponse) {
					if (request.type == "ping") {
						sendResponse({type: document.getElementById(this.id) ? "pong" : "nobar"});
					}
					if (request.type == "freshen") {
						this.init();
					}
					if (request.type == "remove") {
						this.remove();
						this.onHold = true;
					}
					if (request.type == "add") {
						this.onHold = false;
						this.attemptInjection();
					}
					if (request.hash) {
						this.drag.updateHash(this.hash = request.hash);
					}
					return true;
				}.bind(this)
			);
		},

		bodyInjectionWatcher: function() {
			document.addEventListener('animationstart',       this.handleBodyInjectionEvent.bind(this), false);
			document.addEventListener('MSAnimationStart',     this.handleBodyInjectionEvent.bind(this), false);
			document.addEventListener('webkitAnimationStart', this.handleBodyInjectionEvent.bind(this), false);
		},

		handleBodyInjectionEvent: function(e) {
			if (e && e.animationName == 'nodeInserted') {
				this.log('BODY appears, StumbleBar time');
				this.remove();
				this.attemptInjection();
				document.removeEventListener('animationstart',       this.handleBodyInjectionEvent.bind(this), false);
				document.removeEventListener('MSAnimationStart',     this.handleBodyInjectionEvent.bind(this), false);
				document.removeEventListener('webkitAnimationStart', this.handleBodyInjectionEvent.bind(this), false);
			}
		},

		attemptInjection: function() {
			if (!this.iframe || this.onHold)
				return false;
			this.iframe.className = '';
			var discoverbar = document.getElementById(this.id);
			if (!discoverbar) {
				if (!document.body)
					return setTimeout(this.attemptInjection.bind(this), 10);
				document.documentElement.appendChild(this.iframe);
				this.log('StumbleBar created');
				discoverbar = document.getElementById(this.id);
			}
			if (discoverbar && (discoverbar.nextSibling || !discoverbar.parentNode)) {
				this.log('StumbleBar relayered', (!!discoverbar.nextSibling && 'sibling') || (!discoverbar.parentNode && 'parent'));
				document.getElementsByTagName('html')[0].insertBefore(discoverbar, null);
			}
			this.drag.applyEstyle();
		}
	}

	var bar = new IframeBar;
	bar.bodyInjectionWatcher();
	setInterval(bar.attemptInjection.bind(bar), 1000);

})();
