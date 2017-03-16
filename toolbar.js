var Toolbar = {
	handleVersion: function(version) {
		document.querySelector("#toolbar-version").innerText = version;
	},

	handleInterests: function(interests) {
		document.querySelector('#interests-container').innerHTML = '';

		interests.forEach(function(entry) {
			var entryNode = document.querySelector("#stub-interests-entry").cloneNode('deep');

			entryNode.id = entry.id;
			entryNode.removeClass('stub');
			entryNode.setAttribute("interestid", entry.id);
			entryNode.setAttribute("keyword",    entry.name);

			entryNode.querySelector('.interests-entry-image').style       = "background-image: url(" + entry.pic_thumb + ")";
			entryNode.querySelector('.interests-entry-title').innerText   = entry.name || '???';

			document.querySelector('#interests-container').insertBefore(entryNode, null);
		});

		document.querySelector('.interests-loading').addClass('hidden');
	},

	handleError: function(error) {
		clearTimeout(Toolbar.state.errorMessageDisplay);
		document.querySelector('.error-message').removeClass('hidden');
		if (error.type)
			document.querySelector('.error-message').innerText = "Janky error sez...\n" + JSON.stringify(error).replace(/^{"|"}$/g, '').replace(/","/g, "\n").replace(/\\n/g, "\n       ").replace(/":"/g, " = ");
		else
			document.querySelector('.error-message').innerText = error;
		document.querySelector('.error-message').addEventListener('mousedown', function() { document.querySelector('.error-message').addClass('hidden') });
		//Toolbar.state.errorMessageDisplay = setTimeout(function() { document.querySelector('.error-message').addClass('hidden') }, 3000);
	},

	handleNotify: function(message) {
		clearTimeout(Toolbar.state.notifyMessageDisplay);
		document.querySelector('.notify-message').removeClass('hidden');
		document.querySelector('.notify-message').innerText = JSON.stringify(message).replace(/^{"|"}$/g, '').replace(/","/g, "\n").replace(/\\n/g, "\n       ").replace(/":"/g, " = ");
		document.querySelector('.notify-message').addEventListener('mousedown', function() { document.querySelector('.notify-message').addClass('hidden') });
		Toolbar.state.notifyMessageDisplay = setTimeout(function() { document.querySelector('.notify-message').addClass('hidden') }, 2000);
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

		var message = "";
		if (url.friend) {
			message += '<img src="' + url.friend.thumbnail + '" class="inline-info-thumb"> ';
			// @TODO "Discovered by X + Y Others" sounds bad
			//if (url.firstrater == url.friend.username)
			//	message += "Discovered";
			//else
			message += "Liked"
			message += " by " + (url.friend.name || url.friend.username || url.friend.userid);
		}
		if (url.likes) {
			if (message)
				message += " + " + String(url.likes).numberFormat() + " Other" + ((url.likes == 1) ? "s" : "");
			else
				message = "Liked by " + String(url.likes).numberFormat() + " " + ((url.likes == 1) ? "person" : "people");
		}
		if (!message) {
			message = "Be the first to like this!"
		}
		document.querySelector("#inline-info-body").innerHTML = message;

		document.querySelector("#info").removeClass("on");
		document.querySelector(".toolbar-entry-stumble-domain").changeClass('hidden', !url.urlid);
		if (url.urlid) {
			document.querySelector("#info").addClass("on");
			document.querySelector("#domain").innerText = uriToDomain(url.url);
			document.querySelector(".toolbar-entry-stumble-domain").changeClass('hidden', !uriToDomain(url.url));
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

	handleShare: function(shareResponse) {
		document.querySelector('.toolbar-share-sending-container').addClass('hidden');
		this.shareContactList = new ContactList(Toolbar.config.authed);
		this.shareContactList.reconstitute(shareResponse.contacts);
		this.updateShare();
	},

	handleNewConvo: function(newConvo) {
		document.querySelector('.toolbar-share-sending-container').addClass('hidden');
		var convo = newConvo.convo;
		return this.handleConvo(convo);
	},

	handleConvo: function(convo) {
		document.querySelector('.toolbar-share-sending-container').addClass('hidden');
		document.querySelector(".toolbar-container").addClass("convo-expanded");
		document.querySelector('.convo-loading').removeClass('hidden');

		if (!convo.position)
			document.querySelector('#convo-container').innerHTML = '';

		var currentOffset = document.querySelector('#convo-container').scrollHeight - document.querySelector('#convo-container').scrollTop;

		var personMap = {};
		var myConvoId = false;
		(convo.participants || []).forEach(function(person) {
			var name = "";
			var suname = ( person.suUserName || person.suUserId || person.email );
			if (person.name)
				name = person.name + ' (' + suname + ')';
			else
				name = suname;
			personMap[person.id] = name;
			if (person.suUserID == Toolbar.config.authed)
				myConvoId = person.id;
		});

		var added = 0;
		convo.events.forEach(function(entry) {
			var entryNode = document.querySelector('#conv-' + entry.id) || document.querySelector("#stub-convo-entry").cloneNode('deep');

			added += !entryNode.id;

			entryNode.removeClass('stub');

			var poster = null;
			entryNode.querySelector('.convo-entry-user').innerText = personMap[entry.createdBy];
			entryNode.changeClass('.convo-me', entry.createdBy == myConvoId);
			if (!convo.participants) {
				poster = 'You';
				entryNode.querySelector('.convo-entry-user').innerText = 'You';
				entryNode.addClass('.convo-me');
			}

			entryNode.querySelector('.convo-entry-date').innerText = reldate(entry.createdAt, 's').text;
			entryNode.querySelector('.convo-entry-date').value     = entry.createdAt;
			entryNode.querySelector('.convo-entry-body').innerText = entry.message;
			if (entry.type == 'invite') {
				var newppl = [];
				entry.invitedParticipants.forEach(function(id) {
					newppl.push(personMap[id]);
				});
				if (newppl.length <= 1)
					newppl = newppl.join(' and ');
				else {
					newppl[newppl.length - 1] = 'and ' + newppl[newppl.length - 1];
					newppm = newppl.join(', ');
				}
				entryNode.querySelector('.convo-entry-body').innerText = 'Invited ' + newppl;
			}
			entryNode.id = 'conv-' + entry.id;

			if (!entryNode.parentNode) {
				document.querySelector('#convo-container').insertBefore(entryNode, (convo.position == 'prepend') ? document.querySelector('#convo-container').firstChild : null);
			}

			Toolbar.state.listenConvoBackoff = 15000;
		});

		document.querySelectorAll('#convo-container .convo-entry-date').forEach(function(elem) {
			elem.innerText = reldate(elem.value, 's').text;
		});

		if (convo.id && !convo.position) {
			document.querySelector('#convo-id').value = convo.id;

			Toolbar.listenConvoHelper();
		}

		// @TODO FIXME
		//if (convo.position == 'prepend' && !convo.events.length) {
		if (convo.position == 'prepend' && !added) {
			document.querySelector('#convo-container').setAttribute('infinite-scroll-disabled', null);
		}

		this.convoContactList = new ContactList(Toolbar.config.authed);
		this.convoContactList.reconstitute(convo.contacts);
		var participants = (convo.participants || []).filter(function(participant) {
			return participant.suUserId != Toolbar.config.authed;
		}).forEach(function _eachParticipant(participant) {
			var contact = this.convoContactList.get(participant.suUserId);
			// @TODO handle contact not found
			contact.setParticipant(true);
		}.bind(this));
		this.updateConvoParticipants();
		document.querySelector('.convo-loading').addClass('hidden');

		if (convo.position) // Remember scroll position
			document.querySelector('#convo-container').scrollTop = document.querySelector('#convo-container').scrollHeight - currentOffset;
		else // Scroll to the bottom
			document.querySelector('#convo-container').scrollTop = document.querySelector('#convo-container').scrollHeight;
	},
	updateConvoParticipants: function updateConvoParticipants() {
		var attributeMap = [
			{attributeName: 'value', propertyName: 'userid'}, // the contact id goes into the stub's value attribute
			{attributeName: 'innerHTML', propertyName: 'name'} // the contact name goes into the stub's innerHTML
		];
		this.convoContactList.render('convo-recipient-stub', attributeMap, 'convo-recipients-list', {isParticipant: true});
		this.convoContactList.render('convo-add-contact-stub', attributeMap, 'convo-contacts-list', {isParticipant: false});
	},

	handleConvoContacts: function(convoContacts) {
		this.convoContactList = this.convoContactList || new ContactList(Toolbar.config.authed);
		this.convoContactList.addMultiple(convoContacts.contacts.values);
		this.updateConvoParticipants();
	},

	listenConvoHelper: function() {
			console.log('RECHECK START', Toolbar.state.listenConvoBackoff);
		clearTimeout(Toolbar.state.listenConvoTimeout);
		Toolbar.state.listenConvoTimeout = setTimeout(function() {
			console.log('RECHECK');
			Toolbar.dispatch('load-convo', { value: document.querySelector('#convo-id').value, stamp: Array.prototype.slice.call(document.querySelectorAll('#convo-container .convo-entry-date'), -1)[0].value });
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

		document.querySelector('.action-stay-expanded').changeClass('enabled', config.stayExpanded);

		if (config.interests && config.interests.length)
			Toolbar.handleInterests(config.interests);

		if (config.mode && config.mode != Toolbar.config.mode) {
			//document.querySelector(".toolbar-mode-selection").addClass("hidden");
			//document.querySelector(".toolbar-mode").removeClass("hidden");
			document.querySelector("#mode").innerText = config.modes[config.mode].name;
			if (config.mode == "domain")
				document.querySelector("#mode").innerText = config.modes[config.mode].name + " " + (config.modeinfo.domains || [])[0];
			if (config.mode == "interest")
				document.querySelector("#mode").innerText = config.modeinfo.keyword;
			if (config.mode == "keyword")
				document.querySelector("#mode").innerText = config.modeinfo.keyword.replace(/(^| +)/g, '$1#');
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

	handleLists: function(lists) {
		if (!lists.position)
			document.querySelector('#lists-container').innerHTML = '';

		lists.entries.forEach(function(entry) {
			var entryNode = document.querySelector("#stub-lists-entry").cloneNode('deep');

			entryNode.id = entry.id;
			entryNode.removeClass('stub');
			entryNode.setAttribute("values", "listid,listname")
			entryNode.setAttribute("listid", entry.id);
			entryNode.setAttribute("listname", entry.name || 'No Title');

			entryNode.querySelector('.lists-entry-image').style       = "background-image: url(" + entry.thumbnail + ")";
			entryNode.querySelector('.lists-entry-title').innerText   = entry.name || 'No Title';
			entryNode.querySelector('.lists-entry-snippet').innerText = '';

			document.querySelector('#lists-container').insertBefore(entryNode, null);
		});

		document.querySelector('.lists-loading').addClass('hidden');
	},

	handleInbox: function(inbox) {
		if (!inbox.position)
			document.querySelector('#inbox-container').innerHTML = '';

		inbox.messages.forEach(function(entry) {
			var entryNode = document.querySelector("#stub-inbox-entry").cloneNode('deep');

			entryNode.setAttribute('convourl', entry.conversationDetails.originator.conversationUrl);
			entryNode.id = entry.conversationDetails.id;
			entryNode.setAttribute('actionid', entry.id);
			entryNode.setAttribute('values', 'urlid,id,actionid,url=convourl');
			if (entry.urlId)
				entryNode.setAttribute('urlid',  entry.urlId);
			entryNode.removeClass('stub');
			entryNode.querySelector('.inbox-entry-image').style       = "background-image: url(" + entry.conversationDetails.thumbnail + ")";
			entryNode.querySelector('.inbox-entry-title').innerText   = entry.conversationDetails.title;
			if (entry.sourceUserId == Toolbar.config.authed)
				entryNode.querySelector('.inbox-entry-user').innerText = 'You';
			else
				entryNode.querySelector('.inbox-entry-user').innerText = entry.conversationDetails.originator.suUserName || entry.conversationDetails.originator.suUserId || entry.conversationDetails.originator.email;
			//else if (entry.conversationDetails.participants)
			//	entryNode.querySelector('.inbox-entry-user').innerText = (entry.conversationDetails.participants[0].suUserName || entry.conversationDetails.participants[0].suUserId || entry.conversationDetails.participants[0].email) + ((entry.conversationDetails.participants.length > 1) ? '...' : '');
			entryNode.querySelector('.inbox-entry-date').innerText    = reldate(entry.occurred, 's').text;
			entryNode.querySelector('.inbox-entry-date').value        = entry.occurred;
			entryNode.querySelector('.inbox-entry-snippet').innerText = entry.message;

			entryNode.changeClass('unread', !entry.read);

			document.querySelector('#inbox-container').insertBefore(entryNode, (inbox.position == 'prepend') ? document.querySelector('#inbox-container').firstChild : null);
		});

		if (!inbox.messages.length) {
			document.querySelector('#inbox-container').setAttribute('infinite-scroll-disabled', null);
		}

		document.querySelector('.inbox-loading').addClass('hidden');
	},

	handleComment: function(comment) {
		Toolbar.handleConvo({ events:[ comment ], position: 'append' });
	},

	handleList: function(list) {
		Toolbar.handleLists({ lists: [ r.list ], position: 'append' });
	},

	handleHash: function(hash) {
		Toolbar.state.hash = hash;
	},

	_handleResponse: function(r) {
		console.log('Toolbar.handleResponse', r);
		if (r && r.config)
			Toolbar.handleConfig(r.config);
		if (r && r.url)
			Toolbar.handleUrl(r.url);
		Object.keys(r || {}).forEach(function _eachResponseKey(key) {
			if (['config', 'url', 'all', 'data', 'event'].includes(key))
				return;
			var method = 'handle' + key.replace(/^./, function(x) { return x.toUpperCase() });
			try {
				if (Toolbar[method])
					Toolbar[method](r[key]);
				else
					console.log("No handler found", method, r[key]);
			} catch(e) {
				console.log("Exception caught in _handleResponse", method, r[key], e);
			}
		});
		/*
		if (r && r.config)
			Toolbar.handleConfig(r.config);
		if (r && r.url)
			Toolbar.handleUrl(r.url);
		if (r && r.state)
			Toolbar.handleState(r.state);
		if (r && r.inbox)
			Toolbar.handleInbox(r.inbox, r.position);
		if (r && r.lists)
			Toolbar.handleLists(r.lists);
		if (r && r.share == true && r.contacts)
		 Toolbar.handleContacts(r.contacts);
		if (r && r.list)
			Toolbar.handleList({ lists: [ r.list ] }, 'append');
		if (r && r.convo && r.requestedAction !== 'convo-show-contacts')
			Toolbar.handleConvo(r.convo, r.position);
		if (r && r.comment)
			Toolbar.handleConvo({events:[r.comment]}, 'append');
        if (r && r.contacts && r.requestedAction === 'convo-show-contacts')
            Toolbar.handleConvoContacts(r.contacts);
		 if (r && r.requestedAction === 'convo-add-recipient') {
		 // expect the background to set conversationId on the response
		 Toolbar.dispatch('loadConvo', {value: r.response.conversationId});
		 }
		*/

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

	handleZoom: function(zoom) {
		Toolbar.state.zoom = zoom;
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
		var value = Toolbar.elemToValue(elem);
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

	elemToValue: function(elem) {
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
		return value;
	},

	handleMiscatInfo: function(info) {
		var select = document.querySelector('#miscat-suggested-interest');
		select.innerHTML = '';

		document.querySelector('#miscat-current-interest').innerText = info.current_category;

		info.category_list.forEach(function(cat) {
			var option = document.createElement('option');
			option.value = cat.tagid;
			option.innerText = cat.tag;
			select.appendChild(option);
		});
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
		if (action == 'stumble' || action == 'mode') {
			document.querySelector(".action-stumble").toggleClass("enabled");
			document.querySelector(".toolbar-container").removeClass("mode-expanded");
		}
		if (action == 'expand') {
			document.querySelector(".toolbar-container").toggleClass(value + "-expanded");
		}
		if (action == 'inbox') {
			document.querySelector(".toolbar-container").toggleClass("inbox-expanded");
			document.querySelector('.inbox-loading').removeClass('hidden');
		}
		if (action == 'show-miscat') {
			Toolbar.dispatch('report-info');
			Toolbar.handleImmediateAction('expand', 'miscat');
		}
		if (action == 'lists') {
			document.querySelector(".toolbar-container").toggleClass("lists-expanded");
			document.querySelector('.lists-loading').removeClass('hidden');
		}
		if (action == 'interests') {
			document.querySelector(".toolbar-container").toggleClass("interests-expanded");
		}
		if (action == 'keywords') {
			document.querySelector(".toolbar-container").toggleClass("keywords-expanded");
		}
		if (action == 'expand' && value == 'mode') {
			document.querySelector(".toolbar-container").removeClass("interests-expanded");
		}
		if (action == 'expand' && value == 'social') {
			//document.querySelector(".toolbar-social-container .toolbar-expand-icon").toggleClass("enabled");
			//document.querySelector(".action-inbox").toggleClass("enabled");
		}
		if (['dislike-menu', 'report-missing', 'report-spam', 'report-miscat', 'block-site'].includes(action)) {
			document.querySelector(".toolbar-container").toggleClass("dislike-menu-expanded");
		}
		if (action == 'share') {
			document.querySelector(".toolbar-share-container").toggleClass("hidden");
			document.querySelector(".toolbar-container").toggleClass("share-expanded");
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
		if (action == 'add-list') {
			Toolbar.handleImmediateAction('toggle', document.querySelector("#list-add-cancel").getAttribute('value'));
		}
		if (action == 'add-list' || action == 'add-to-list') {
			document.querySelector(".toolbar-container").removeClass("lists-expanded");
		}
		if (action == 'toggle') {
			value.split(',').forEach(function(name) {
				Array.prototype.slice.call(document.querySelectorAll("." + name)).forEach(function(elem) { elem.toggleClass('hidden'); });
			});
		}
		if (action == 'close-convo') {
			document.querySelector(".toolbar-container").removeClass("convo-expanded");
			document.querySelector("#convo-reply").value = '';
		}
		if (action == 'reply-convo') {
			document.querySelector("#convo-reply").value = '';
		}
		if (action == 'convo-show-contacts') {
			document.querySelector('.convo-contacts-container').toggleClass("hidden");
		}
		if (action == 'convo-add-recipient') {
			document.querySelector('.convo-contacts-container').toggleClass("hidden");
			return this.getNewConvoParticipantData(value);
		}
		if (action == 'save-share') {
			if(this.validateShare()) {
				document.querySelector('.toolbar-share-sending-container').removeClass('hidden');
				document.querySelector("[action=share]").toggleClass("enabled");
				document.querySelector(".toolbar-share-container").toggleClass("hidden");
				document.querySelector(".toolbar-container").toggleClass("share-expanded");
				Toolbar.handleRedraw();
				return this.getShareData();
			} else {
				return false;
			}
		}
		return true;
	},
	getNewConvoParticipantData: function getNewConvoParticipantData(userid) {
		var data = {
			conversationId:document.querySelector('#convo-id').value,
			suUserIds:[userid]
		};
		return data;
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
		var id = sourceEl.getAttribute('value'),
			contact = this.shareContactList.get(id);
			contact.setParticipant(true);
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
		if (e.target) {
			var node = e.target;
			do {
				if (node.hasClass('no-drag') || node.tagName == 'INPUT' || node.tagName == 'TEXTAREA')
					return false;
				node = node.parentNode;
			} while (node);
		}
		Toolbar.mouse = { state: 'down', pos: { x: e.screenX, y: e.screenY } };
		window.top.postMessage({ type: "down", message: { zoom: Toolbar.state.zoom, screen: { x: e.screenX, y: e.screenY }, client: { x: e.clientX, y: e.clientY } } }, "*");
	},

	handleInfiniteScroll: function(node) {
		Toolbar.handlingInfiniteScroll = Toolbar.handlingInfiniteScroll || {};
		if (Toolbar.handlingInfiniteScroll[node.id])
			return false;
		Toolbar.handlingInfiniteScroll[node.id] = true;

		switch (node.id) {
			case 'convo-container':
				document.querySelector('.convo-loading').removeClass('hidden');
				Toolbar.dispatch('load-convo', {
					value: document.querySelector('#convo-id').value,
					stamp: Array.prototype.slice.call(document.querySelectorAll('#convo-container .convo-entry-date'), 0)[0].value,
					//stamp: parseInt(new Date(Array.prototype.slice.call(document.querySelectorAll('#convo-container .convo-entry-date'), 0)[0].value).getTime()/1000),
					limit: 20,
					type: 'before'
				})
				.then(function() {
					Toolbar.handlingInfiniteScroll[node.id] = false;
				});
				break;

			case 'inbox-container':
				document.querySelector('.inbox-loading').removeClass('hidden');
				Toolbar.dispatch('inbox', {
					limit: 20,
					// @TODO
					//position: Array.prototype.slice.call(document.querySelectorAll('#inbox-container .inbox-entry-date'), -1)[0].value,
					//position: parseInt(new Date(Array.prototype.slice.call(document.querySelectorAll('#inbox-container .inbox-entry-date'), -1)[0].value).getTime()/1000),
					//type: 'before'
					position: document.querySelectorAll('#inbox-container .inbox-entry').length
				})
				.then(function() {
					Toolbar.handlingInfiniteScroll[node.id] = false;
				});
				break;

			default:
				warning("Can't find infinite scroll handler", node);
				return false;
				break;
		}
		Toolbar.handleRedraw();

		return true;
	},
	handleInfiniteScrollThrottled: debounce(function (node) { Toolbar.handleInfiniteScroll(node) }, 250),

	handleMouseWheel: function(e) {
		if (e.target) {
			var node = e.target;
			do {
				if (node.hasClass('scrollable')) {
					if (node.hasAttribute('infinite-scroll') && !node.hasAttribute('infinite-scroll-disabled')) {
						var nearTop = node.scrollTop <= (node.getAttribute('infinite-scroll-offset') || 32);
						var nearBottom = node.scrollTop + node.offsetHeight >= node.scrollHeight - (node.getAttribute('infinite-scroll-offset') || 32);

						if (((node.getAttribute('infinite-scroll-trigger') || 'bottom') == 'bottom') ? nearBottom : nearTop) {
							Toolbar.handleInfiniteScrollThrottled(node);
						}
					}

					var atTop = node.scrollTop <= 0 && e.deltaY <= 0;
					var atBottom = node.scrollTop + node.offsetHeight >= node.scrollHeight && e.deltaY >= 0;
					if (atTop || atBottom) {
						e.stopPropagation();
						e.preventDefault();
						return false;
					}
					return true;
				}
				node = node.parentNode;
			} while (node);
		}
		return true;
	},
	handleMouseMove: function(e) {
		//window.top.postMessage({ type: "hover", hover: true }, '*');
		if (!e.button && !e.buttons)
			Toolbar.mouse.state = 'up';
		if (Toolbar.mouse.state == 'down' && Math.max(Math.abs(Toolbar.mouse.pos.x - e.screenX), Math.abs(Toolbar.mouse.pos.y - e.screenY)) >= 8)
			Toolbar.mouse.state = 'drag';
		if (Toolbar.mouse.state == 'drag')
			window.top.postMessage({ type: "drag", message: { zoom: Toolbar.state.zoom, screen: { x: e.screenX, y: e.screenY }, client: { x: e.clientX, y: e.clientY } } }, "*");
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
		if (Toolbar.state.canMiniMode && !Toolbar.config.stayExpanded && !Toolbar.state.inMiniMode && Toolbar.state.lastMouse && Date.now() - Toolbar.state.lastMouse >= (Toolbar.config.miniModeTimeout || 10)) {
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
			zoom: Toolbar.state.zoom,
		} } }, "*");
	},
	handleIframeEvent: function(e) {
		if (e.data.hash != Toolbar.state.hash)
			return false;
		if (!e.data.action)
			return false;
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
		window.addEventListener("message", Toolbar.handleIframeEvent, true);

		// Toolbar initialization
		Toolbar.dispatch('init');
		Toolbar.dispatch('urlChange');
		window.setInterval(Toolbar.tryMiniMode, 1000);

		// Drag-n-drop logic
		document.addEventListener("mousedown",      Toolbar.handleMouseDown,  true);
		document.addEventListener("mousemove",      Toolbar.handleMouseMove,  true);
		document.addEventListener("mouseup",        Toolbar.handleMouseUp,    true);
		document.addEventListener("mousewheel",     Toolbar.handleMouseWheel, true);
		document.addEventListener("wheel",          Toolbar.handleMouseWheel, true);
		document.addEventListener("DOMMouseScroll", Toolbar.handleMouseWheel, true);

		// Enter-on-send
		document.querySelector('#convo-reply').addEventListener("keypress", function(e) {
			console.log(e);
			if (e.keyCode == 13 && !e.shiftKey)
				Toolbar.handleEvent({ target: document.querySelector('#convo-send') });
		});

		// share contacts search
		document.querySelector('#share-contacts-search').addEventListener('input', function(e) {
			console.log(e.target.value);
			if(this.shareContactList) {
				var contactIds = this.shareContactList.search(e.target.value),
					attributeMap = [
						{attributeName: 'value', propertyName: 'userid'}, // the contact id goes into the stub's value attribute
						{attributeName: 'innerHTML', propertyName: 'name'} // the contact name goes into the stub's innerHTML
					];
				this.shareContactList.render('toolbar-share-add-contact-stub', attributeMap, 'toolbar-share-contacts-list', {contactIds: contactIds, isParticipant: false});
			}
		}.bind(this));

		// convo contacts search
		document.querySelector('#convo-contacts-search').addEventListener('input', function(e) {
			console.log(e.target.value);
			if(this.convoContactList) {
				var contactIds = this.convoContactList.search(e.target.value),
					attributeMap = [
						{attributeName: 'value', propertyName: 'userid'}, // the contact id goes into the stub's value attribute
						{attributeName: 'innerHTML', propertyName: 'name'} // the contact name goes into the stub's innerHTML
					];
				this.convoContactList.render('convo-add-contact-stub', attributeMap, 'convo-contacts-list', {contactIds: contactIds, isParticipant: false});
			}
		}.bind(this));

		// Redraw
		//Toolbar.handleRedraw();
		//Toolbar._events.forEach(function(entry) {
		//	document.getElementById(entry.id).addEventListener(entry.ev, Toolbar[entry.cb])
		//});
	},
	_events: [{ ev: 'click', id: 'stumble', cb: 'stumble' }]
}
Toolbar.init();

