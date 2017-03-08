(function() {
	IframeBar = function(id, origin) {
		this.id = id || this.id;
		this.origin = origin || chrome.extension.getURL('').slice(0, -1);

		this.init();
	}

	IframeBar.prototype = {
		id: 'discoverbar',
		theme: {
			url: "toolbar.html",
			iframe: 'position:fixed;bottom:0;left:0;display:none;' +
				'width:288px;height:90px;z-index:2147483647;border:0;' +
				'overflow:hidden;box-shadow: 0 0 16px -4px #000; border-radius:4px; border: 1px solid #aaa;' +
				'transition: width 0.2s, height 0.2s;' +
				'-webkit-backface-visibility: hidden; -webkit-perspective: 1000; -webkit-transform:translate3d(0,0,0); -webkit-tap-highlight-color: rgba(0,0,0,0);' +
				'',
			//css:    '#discoverbar { transition: width 0.2s, height 0.2s; -webkit-transition-property: background-color, color; -webkit-backface-visibility: hidden; -webkit-perspective: 1000; -webkit-transform:translate3d(0,0,0); -webkit-tap-highlight-color: rgba(0,0,0,0); }',
			draggable: true,
		},

		canInject: function() {
			return (!location.ancestorOrigins || !location.ancestorOrigins.contains(this.origin)) && (location.hostname != "www.stumbleupon.com" && !location.pathname.match(/^\/su\/[^\/]+/));
		},

		getDocument: function() {
			try {
				var document = window.top.document;
				if (window.document != document)
					return false;
			} catch (e) {
				return false;
				var document = window.document;
			}
			return document;
		},

		createIframe: function() {
			try {
				chrome.extension.getBackgroundPage().frames
			} catch (e) {
				var iframe = document.createElement('iframe');
			}
			iframe.src = chrome.runtime.getURL(this.theme.url);
			iframe.style.cssText = this.theme.iframe;
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
				this.iframe = this.createIframe();
				this.document.adoptNode(this.iframe);
				this.registerPingListener();
				this.drag = new DragNDrop(this.iframe, this.origin);
				this.attemptInjection();
			}
		},

		registerPingListener: function() {
			IframeBar.pingListener = chrome.runtime.onMessage.addListener(
				function(request, sender, sendResponse) {
					if (request.type == "ping")
						sendResponse({type: "pong"});
					return true;
				}
			);
		},

		attemptInjection: function() {
			if (!this.iframe)
				return false;
			var discoverbar = document.getElementById('discoverbar');
			if (!discoverbar) {
				document.documentElement.appendChild(this.iframe);
				discoverbar = document.getElementById('discoverbar');
			}
			if (discoverbar && discoverbar.nextSibling) {
				document.getElementsByTagName('html')[0].insertBefore(discoverbar, null);
			}
		}
	}

	var bar = new IframeBar;
	setInterval(bar.attemptInjection(bar), 1000);

})();
