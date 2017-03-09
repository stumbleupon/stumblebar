var Toolbar = {
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

		var message = "";
		if (url.friend) {
			message += '<img src="' + url.friend.thumbnail + '" class="inline-info-thumb"> ';
			if (url.firstrater == url.friend.username)
				message += "Discovered";
			else
				message += "Liked"
			message += " by " + (url.friend.name || url.friend.username || url.friend.userid);
		}
		if (url.likes) {
			if (message)
				message += " + " + String(url.likes).numberFormat() + " Others";
			else
				message = "Liked by " + String(url.likes).numberFormat() + " people";
		}
		if (!message) {
			message = "Be the first to like this!"
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

	handleState: function(state) {
		document.querySelector(".toolbar-container").changeClass("convo-expanded", state.convo);
		document.querySelector('.convo-loading').changeClass('hidden', state.convo);
		if (state.convo) {
			Toolbar.dispatch('loadConvo', { value: state.convo });
		}
	},

	handleContacts: function(contacts) {
		this.shareContactList = this.shareContactList || new ContactList(contacts.values);
		this.updateShare();
	},

	handleConvo: function(convo, position) {
		document.querySelector(".toolbar-container").addClass("convo-expanded");
		document.querySelector('.convo-loading').removeClass('hidden');

		if (!position)
			document.querySelector('#convo-container').innerHTML = '';

		convo.events.forEach(function(entry) {
			var entryNode = document.querySelector('#conv-' + entry.id) || document.querySelector("#stub-convo-entry").cloneNode('deep');

			entryNode.removeClass('stub');

			(convo.participants || []).forEach(function(person) {
				if (person.id == entry.createdBy) {
					entryNode.querySelector('.convo-entry-user').innerText = person.name || person.email;
					if (person.id == Toolbar.config.authed)
						entryNode.addClass('.convo-me');
				}
			});
			if (!convo.participants) {
				entryNode.querySelector('.convo-entry-user').innerText = 'You';
				entryNode.addClass('.convo-me');
			}

			entryNode.querySelector('.convo-entry-date').innerText = reldate(entry.createdAt, 's').text;
			entryNode.querySelector('.convo-entry-date').value     = entry.createdAt;
			entryNode.querySelector('.convo-entry-body').innerText = entry.message;
			entryNode.id = 'conv-' + entry.id;

			if (!entryNode.parentNode) {
				document.querySelector('#convo-container').insertBefore(entryNode, (position == 'prepend') ? document.querySelector('#convo-container').firstChild : null);
			}

			Toolbar.state.listenConvoBackoff = 15000;
		});

		document.querySelectorAll('#convo-container .convo-entry-date').forEach(function(elem) {
			elem.innerText = reldate(elem.value, 's').text;
		});

		if (convo.id && !position) {
			document.querySelector('#convo-id').value = convo.id;

			document.querySelector('#convo-reply').addEventListener("keypress", function(e) {
				if (e.keyCode == 13)
					Toolbar.handleEvent({ target: document.querySelector('#convo-send') });
			});

			Toolbar.listenConvoHelper();
		}

		document.querySelector('.convo-loading').addClass('hidden');

		document.querySelector('#convo-container').scrollTop = document.querySelector('#convo-container').scrollHeight;
	},

	listenConvoHelper: function() {
			console.log('RECHECK START', Toolbar.state.listenConvoBackoff);
		Toolbar.state.listenConvoTimeout = setTimeout(function() {
			console.log('RECHECK');
			Toolbar.dispatch('load-convo', { value: document.querySelector('#convo-id').value, since: Array.prototype.slice.call(document.querySelectorAll('#convo-container .convo-entry-date'), -1)[0].value });
			// Backoff -- 15s => 30s => 1m => 2m => 4m => 8m => 16m => ...
			Toolbar.state.listenConvoBackoff = 2 * (Toolbar.state.listenConvoBackoff || 15000);
			Toolbar.listenConvoHelper();
		}, Toolbar.state.listenConvoBackoff);
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

	handleInbox: function(inbox, r) {
		document.querySelector('#inbox-container').innerHTML = '';

		inbox.forEach(function(entry) {
			var entryNode = document.querySelector("#stub-inbox-entry").cloneNode('deep');

			entryNode.setAttribute('convourl', entry.conversationDetails.originator.conversationUrl);
			entryNode.id = entry.conversationDetails.id;
			entryNode.setAttribute('values', 'urlid,id,url=convourl');
			if (entry.urlId)
				entryNode.setAttribute('urlid',  entry.urlId);
			entryNode.removeClass('stub');
			entryNode.querySelector('.inbox-entry-image').style       = "background-image: url(" + entry.conversationDetails.thumbnail + ")";
			entryNode.querySelector('.inbox-entry-title').innerText   = entry.conversationDetails.title;
			if (entry.sourceUserId == r.me)
				entryNode.querySelector('.inbox-entry-user').innerText = 'You';
			else
				entryNode.querySelector('.inbox-entry-user').innerText = entry.conversationDetails.originator.suUserName || entry.conversationDetails.originator.suUserId || entry.conversationDetails.originator.email;
			//else if (entry.conversationDetails.participants)
			//	entryNode.querySelector('.inbox-entry-user').innerText = (entry.conversationDetails.participants[0].suUserName || entry.conversationDetails.participants[0].suUserId || entry.conversationDetails.participants[0].email) + ((entry.conversationDetails.participants.length > 1) ? '...' : '');
			entryNode.querySelector('.inbox-entry-date').innerText    = reldate(entry.occurred, 's').text;
			entryNode.querySelector('.inbox-entry-snippet').innerText = entry.message;

			entryNode.changeClass('unread', entry.read);

			document.querySelector('#inbox-container').appendChild(entryNode);
		});

		document.querySelector('.inbox-loading').addClass('hidden');
	},

	_handleResponse: function(r) {
		console.log('Toolbar.handleResponse', r);
		if (r && r.url)
			Toolbar.handleUrl(r.url);
		if (r && r.config)
			Toolbar.handleConfig(r.config);
		if (r && r.state)
			Toolbar.handleState(r.state);
		if (r && r.inbox)
			Toolbar.handleInbox(r.inbox);
		if (r && r.contacts)
			Toolbar.handleContacts(r.contacts);
		if (r && r.convo)
			Toolbar.handleConvo(r.convo, r.position);
		if (r && r.comment)
			Toolbar.handleConvo({events:[r.comment]}, 'append');
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
		}).then(Toolbar._handleResponse);
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
		var value  = {value : elem.getAttribute('value')};
		if (elem.getAttribute('values')) {
			// decode the values into an object to send to dispatch
			value = {};
			elem.getAttribute('values').split(',').forEach(function(name) {
				parts = name.split('=');
				target = parts[1] || parts[0];
				var attr = target;
				var source = elem;
				if (target[0] == '#') {
					source = document.querySelector(target.split('.')[0]);
					attr = target.split('.')[1] || 'value';
				}
				value[parts[0]] = source.getAttribute(attr) || source[attr] || null;
			});
		}
		var val = Toolbar.handleImmediateAction(action, value.value || value, elem);
		if(val) {
			if(typeof val === "object") {
				// handleImmediateAction is replacing data;
				value = val;
			}
			Toolbar.dispatch(action, value);
			Toolbar.handleRedraw();
		}
	},

	/**
	 * Called by top-level event delegate before dispatching to background
	 * @param {string} action -- action attribute of the source element
	 * @param {string} value -- value attribute from the source element
	 * @param {HTMLElement} elem -- the source of the event
	 * @returns {boolean|Object} -- return false to cancel dispatching event to background and redrawing
	 *                              OR return an Object to replace the data object sent to dispatch.
	 */
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
			document.querySelector('.inbox-loading').removeClass('hidden');
		}
		if (action == 'expand' && value == 'mode') {
			document.querySelector(".toolbar-container").toggleClass("mode-expanded");
		}
		if (action == 'expand' && value == 'social') {
			//document.querySelector(".toolbar-social-container .toolbar-expand-icon").toggleClass("enabled");
			//document.querySelector(".action-inbox").toggleClass("enabled");
		}
		if (action == 'share') {
			elem.toggleClass("enabled");
			document.querySelector(".toolbar-share-container").toggleClass("hidden");
		}
		if (action == 'share-add-contact') {
			// make the contact a participant
			this.addParticipant(value, elem);
			elem.toggleClass("enabled");
		}
		if (action == 'share-delete-contact') {
			// make the contact a participant
			this.deleteParticipant(value, elem);
			elem.toggleClass("enabled");
		}
		if (action == 'settings') {
			elem.toggleClass("enabled");
			document.querySelector(".toolbar-settings-container").toggleClass("hidden");
		}
		if (action == 'hide') {
		}
		if (action == 'reply-convo') {
			document.querySelector("#convo-reply").value = '';
		}
		if (action == 'save-share') {
			if(this.validateShare()) {
				document.querySelector("[action=share]").toggleClass("enabled");
				document.querySelector(".toolbar-share-container").toggleClass("hidden");
				return this.getShareData();
			} else {
				return false;
			}
		}
		return true;
	},
	getShareData: function getShareData() {
		var data = {
			contentType:'url',
			contentId:null,
			suUserIds:null,
			initialMessage:null
		};
		data.contentId = Toolbar.url.urlid;
		data.suUserIds = this.shareContactList.find({isParticipant: true}).map(function(contact) {
			return contact.userid;
		});
		data.initialMessage = document.querySelector('#toolbar-share-comment').value;
		return data;
	},
	validateShare: function validateShare() {
		// make sure there are some recipients
		var recipients = this.shareContactList.find({isParticipant: true});
		if(recipients.length === 0) {
			newFromTemplate('toolbar-share-empty-recipient', {}, 'toolbar-share-recipients-list');
			return false;
		}
		return true;
	},
	mouse: {},
	config: {},
	state: {
		lastMouse:     Date.now(),
		canMiniMode:   false,
		inMiniMode:    false,
	},
	addParticipant: function toolbarAddParticipant(value, sourceEl) {
		var id = sourceEl.getAttribute('value');
		console.log('adding participant', id);
		this.shareContactList.get(id).setParticipant(true);
		this.updateShare();
	},
	deleteParticipant: function toolbarDeleteParticipant(value, sourceEl) {
		var id = sourceEl.getAttribute('value');
		console.log('deleting participant', id);
		this.shareContactList.get(id).setParticipant(false);
		this.updateShare();
	},
	/**
	 * Redraw the share section's lists of contacts and recipients using current state of the contact list.
	 */
	updateShare: function updateShare() {
		var attributeMap = [
			{attributeName: 'value', propertyName: 'userid'}, // the contact id goes into the stub's value attribute
			{attributeName: 'innerHTML', propertyName: 'name'} // the contact name goes into the stub's innerHTML
		];
		this.shareContactList.render('toolbar-share-add-contact-stub', attributeMap, 'toolbar-share-contacts-list', {isParticipant: false});
		this.shareContactList.render('toolbar-share-contact-stub', attributeMap, 'toolbar-share-recipients-list', {isParticipant: true});
	},
	handleMouseDown: function(e) {
		Toolbar.mouse = { state: 'down', pos: { x: e.screenX, y: e.screenY } };
		window.top.postMessage({ type: "down", message: { screen: { x: e.screenX, y: e.screenY }, client: { x: e.clientX, y: e.clientY } } }, "*");
	},
	handleMouseMove: function(e) {
		//window.top.postMessage({ type: "hover", hover: true }, '*');
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
			var hover = data && data.iframe && ( // We can do mini mode if the mouse isn't hovering over the frame
				   data.iframe.x >= data.mouse.x && data.iframe.x + Toolbar.state.w <= data.mouse.x
				&& data.iframe.y >= data.mouse.y && data.iframe.y + Toolbar.state.h <= data.mouse.y
			);
			Toolbar.state.canMiniMode = !hover;
			//window.top.postMessage({ type: "hover", hover: hover }, '*');
			return;
		}
		Toolbar.dispatch(e.data.action, e.data.data);
	},
	init: function() {
		// Event and message handling
		document.getElementById("toolbar").addEventListener("click", Toolbar.handleEvent);
		chrome.runtime.onMessage.addListener(Toolbar._handleResponse);
		window.addEventListener("message", Toolbar.handleIframeEvent, false);

		// Toolbar initialization
		Toolbar.dispatch('init');
		Toolbar.dispatch('urlChange');
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

