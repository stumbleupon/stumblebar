function DragNDrop(elem, origin, hash) {
	this.elem = elem;
	this.origin = origin;
	this.hash = hash;
	this.init();
}

DragNDrop.prototype = {
	dpos: {},
	mpos: { mouse: {} },
	oside: {
		left:   'right',
		right:  'left',
		top:    'bottom',
		bottom: 'top',
	},
	estyle: {},

	updateHash: function(hash) {
		this.hash = hash;
	},

	init: function() {
		this.communicateMouseMove = debounce(function() {
			this.sendToBackground({mouse: this.mpos, action: 'mouse'});
		}.bind(this), 100);

		window.addEventListener("mousemove", this.mouseMoveHandler = this.handleMouseMove.bind(this));
		window.addEventListener("message",   this.messageHandler = this.handleMessage.bind(this))
		chrome.storage.sync.get('redrawCache', function(res) {
			try {
				if (res.redrawCache) {
					this.handleRedrawMessage(res.redrawCache);
					return;
				}
			} catch (e) {}
			this.handleRepos({vside: 'bottom', hside: 'left', h: 0, v: 0});
		}.bind(this));
	},

	uninit: function() {
		window.removeEventListener("mousemove", this.mouseMoveHandler);
		window.removeEventListener("message",   this.messageHandler);
	},

	onMessageSendFail: function(cb) {
		this.messageSendFailCallback = cb;
	},

	sendToBackground: function(msg) {
		try {
			chrome.runtime.sendMessage(msg, function(response) {});
		} catch(e) {
			error(e);
			if (this.messageSendFailCallback)
				this.messageSendFailCallback(this);
		}
	},



	handleMouseMove: function(event) {
		if (!(event instanceof MouseEvent)/* || !event.isTrusted*/)
			return;

		this.mpos.mouse.x = event.clientX;
		this.mpos.mouse.y = event.clientY;
		this.mpos.from    = 'window';
		this.mpos.iframe  = { y: this.elem.offsetTop, x: this.elem.offsetLeft }

		this.updateIframePos();
		this.communicateMouseMove();
	},

	updateIframePos: function() {
		if (this.dpos.state == 'drag') {
			var zoom = (this.dpos.internal || {}).zoom || 1;
			//    last pos outside of iframe  - mousedown pos in iframe + change in mouse screen position from mouse down
			if (this.mpos.from == 'iframe') {
				this.mpos.iframe = {
					x: (this.dpos.iframe.x + (this.mpos.internal.screen.x - this.dpos.internal.screen.x)),
					y: (this.dpos.iframe.y + (this.mpos.internal.screen.y - this.dpos.internal.screen.y)),
					w: this.elem.offsetWidth,
					h: this.elem.offsetHeight
				}
			} else {
				this.mpos.iframe = {
					x: (this.mpos.mouse.x - this.dpos.internal.client.x),
					y: (this.mpos.mouse.y - this.dpos.internal.client.y),
					w: this.elem.offsetWidth,
					h: this.elem.offsetHeight
				};
			}

			this.elem.style.left = this.estyle.left = Math.min(window.innerWidth  * zoom - this.elem.offsetWidth , Math.max(0, this.mpos.iframe.x)) + 'px';
			this.elem.style.top  = this.estyle.top  = Math.min(window.innerHeight * zoom - this.elem.offsetHeight, Math.max(0, this.mpos.iframe.y)) + 'px';
			this.estyle['-stumble-dirty-style'] = '1';
		}
	},


	applyEstyle: function(rebuild) {
		var cssText = this.cachedCssText || '';
		if (rebuild || this.estyle['-stumble-dirty-style'] != '0') {
			cssText = '';
			this.estyle['-stumble-dirty-style'] = '0';
			for (var p in this.estyle)
				cssText += p+':'+this.estyle[p]+';';
			this.cachedCssText = cssText;
		}
		if (this.isFullscreen)
			cssText += 'display: none !important;';
		if (this.elem.style.cssText != cssText)
			this.elem.style.cssText = cssText;
	},


	useClassicTheme: function() {
		try {
			document.body.suMoved = true;
			document.body.style.marginTop = '56px';
			document.body.style.marginTop = '56px !important';
			document.body.style.position  = 'relative';
			this.estyle['border-radius'] = '0';
			this.estyle['border'] = '0';
			this.estyle['background'] = '#fff';
		} catch(e) {}

		this.moveFixedElements();
	},

	useFloatingTheme: function() {
		if (document.body.suMoved) {
			document.body.style.marginTop = '0';
			document.body.style.position  = '';
			document.body.suMoved = false;
			delete this.estyle['border-radius'];
			delete this.estyle['border'];
			delete this.estyle['background'];
		}

		this.restoreFixedElements();
	},


	handleTheme: function() {
		if (this.theme == 'classic' && this.estyle.display !== 'none') {
			this.useClassicTheme();
		} else {
			this.useFloatingTheme();
		}
	},
	

	handleRepos: function(rpos, noMargin) {
		this.estyle['-stumble-dirty-style'] = '1';

		if (this.theme == 'classic')
			var rpos = { vside: 'top', hside: 'left', v: '0', h: '0' };

		this.estyle[rpos.vside] = this.elem.style[rpos.vside] = rpos.v + '%';
		this.estyle[rpos.hside] = this.elem.style[rpos.hside] = rpos.h + '%';
		this.estyle[this.oside[rpos.vside]] = this.elem.style[this.oside[rpos.vside]] = 'initial';
		this.estyle[this.oside[rpos.hside]] = this.elem.style[this.oside[rpos.hside]] = 'initial';

		this.handleTrySnap(rpos)
	},

	handleTrySnap: function(rpos) {
		if (rpos.v <= 1) {
			this.estyle['margin-' + rpos.vside] = this.elem.style['margin-' + rpos.vside] = '-3px';
			this.estyle['margin-' + this.oside[rpos.vside]] = this.elem.style['margin-' + this.oside[rpos.vside]] = 'initial';
			this.estyle[rpos.vside] = this.elem.style[rpos.vside] = '0';
		} else {
			this.estyle['margin-' + rpos.vside] = this.elem.style['margin-' + rpos.vside] = 'initial';
		}
		if (rpos.h <= 1) {
			this.estyle['margin-' + rpos.hside] = this.elem.style['margin-' + rpos.hside] = '-3px';
			this.estyle['margin-' + this.oside[rpos.hside]] = this.elem.style['margin-' + this.oside[rpos.hside]] = 'initial';
			this.estyle[rpos.hside] = this.elem.style[rpos.hside] = '0';
		} else {
			this.estyle['margin-' + rpos.hside] = this.elem.style['margin-' + rpos.hside] = 'initial';
		}
		if (this.theme == 'classic') {
			this.estyle['margin-right'] = this.elem.style['margin-right'] = 0;
			this.estyle['margin-left'] = this.elem.style['margin-left'] = 0;
			this.estyle['margin-top'] = this.elem.style['margin-top'] = 0;
			this.estyle['right'] = this.elem.style['right'] = 0;
		}
		this.estyle['-stumble-dirty-style'] = '1';
	},

	handleMessage: function(event) {
		if (!event.data || !event.data.type || event.origin != this.origin)
			return;

		var handler = 'handle' + event.data.type[0].toUpperCase() + event.data.type.slice(1) + 'Message';
		this[handler](event.data.message, event.data);
	},

	handleDragMessage: function(message) {
		if (this.dpos.state == 'down') {
			['top', 'left', 'right', 'bottom'].forEach(function(side) {
				this.elem.style['margin-' + side] = 'initial';
			}.bind(this));
			this.dpos.state = 'drag';
		}
		this.mpos.internal = message;
		this.mpos.from = 'iframe';
		this.updateIframePos();
	},

	handleDownMessage: function(message) {
		if (this.dpos.state == 'down')
			return;
		this.dpos = { from: 'iframe', mouse: this.mpos.mouse, iframe: { y: this.elem.offsetTop, x: this.elem.offsetLeft }, internal: message };
		this.mpos = { from: 'iframe', mouse: this.mpos.mouse, iframe: { y: this.elem.offsetTop, x: this.elem.offsetLeft }, internal: message };
		this.dpos.state = 'down';
	},

	handleHideMessage: function(message) {
		this.elem.style.display = this.estyle.display = 'none';
		this.estyle['-stumble-dirty-style'] = '1';
	},

	handleUpMessage: function(message) {
		if (this.dpos.state != 'drag') {
			this.dpos.state = 'up';
			return;
		}
		this.dpos.state = 'up';
		var rpos = {
			v: Math.max((this.elem.offsetTop ) / window.innerHeight * 100, 0),
			h: Math.max((this.elem.offsetLeft) / window.innerWidth  * 100, 0),
			vside: 'top',
			hside: 'left',
		}
		if (rpos.v > 50) {
			rpos.v = Math.max(100 - rpos.v - 100 * this.elem.offsetHeight / window.innerHeight, 0);
			rpos.vside = 'bottom';
		}
		if (rpos.h > 50) {
			rpos.h = Math.max(100 - rpos.h - 100 * this.elem.offsetWidth  / window.innerWidth , 0);
			rpos.hside = 'right';
		}
		this.handleRepos(rpos);
		this.sendToBackground({action: 'repos', from: 'bar', data: { rpos: rpos } }, true);
	},

	handleHoverMessage: function(message) {
		//document.body.overflow = event.data.hover ? 'hidden' : 'initial';
	},


    moveFixedElements: function() {
		["div", "header"].forEach(function(tag) {
			var els = document.querySelectorAll(tag);
			for(var i=0; i<els.length; i++) {
				var elem = els[i];
				if(elem.suMoved)
					return;

				var style = window.getComputedStyle(elem);
				if(["fixed"].indexOf(style.position) !== -1 && elem != this.elem) {
					if(elem.getAttribute("id") != 'discoverbar') {
						var top = style.top;
						var nOldSpot = top ? parseInt(top) : 0;
						var nNewSpot = nOldSpot + 55;
						elem.style.top = nNewSpot + "px";
						elem.suMoved = true;
					}
				}
			}
		}.bind(this));
	},


    restoreFixedElements: function() {
		["div", "header"].forEach(function(tag) {
			var els = document.querySelectorAll(tag);
			for(var i=0; i<els.length; i++) {
				var elem = els[i];
				if(!elem.suMoved)
					return;

				var style = window.getComputedStyle(elem);
				if(["fixed"].indexOf(style.position) !== -1 && elem != this.elem) {
					if(elem.getAttribute("id") != 'discoverbar') {
						var top = style.top;
						var nOldSpot = top ? parseInt(top) : 0;
						var nNewSpot = nOldSpot - 55;
						els[i].style.top = nNewSpot + "px";
						els[i].suMoved = false;
					}
				}
			}
		}.bind(this));
	},


	handleRedrawMessage: function(message) {
		if (message.toolbar.theme)
			this.theme = message.toolbar.theme;

		if (message.toolbar.h && message.toolbar.w) {
			if (message.toolbar.theme == 'classic') {
				//message.toolbar.h = '54';
				message.toolbar.w = window.innerWidth;
			}
			this.elem.style.height = this.estyle.height = message.toolbar.h + 'px';
			this.elem.style.width  = this.estyle.width  = message.toolbar.w + 'px';
			this.updateIframePos();
		}

		if (message.toolbar.rpos)
			this.handleRepos(message.toolbar.rpos);

		if (message.toolbar.hidden)
			this.estyle.display = 'none';
		else
			this.estyle.display = 'block';

		if (this.theme)
			this.handleTheme(this.theme);

		this.estyle['-stumble-dirty-style'] = '1';
		if (!this.isFullscreen)
			this.elem.style.display = this.estyle.display;

		chrome.storage.sync.set({'redrawCache': {toolbar:message.toolbar}});
	},

	fullscreen: function(fullscreen) {
		this.isFullscreen = fullscreen;
		this.estyle['-stumble-dirty-style'] = '1';
		this.applyEstyle();
	}
}
