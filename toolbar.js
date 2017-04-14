var Toolbar = {
	handleVersion: function(version) {
		document.querySelector("#toolbar-version").innerText = version;
	},

	handleInterests: function(interests) {
		document.querySelector('#interests-container').innerHTML = '';

		var addNode = document.querySelector(".interests-create-action.stub").cloneNode('deep');
		addNode.removeClass('stub');
		document.querySelector('#interests-container').insertBefore(addNode, null);

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

	_stateCleanup: function() {
		document.querySelector("#stumble").removeClass("enabled");
	},

	handleError: function(error, sourceEl) {
		this._errorIsShowing = true;
		Toolbar._stateCleanup();
		clearTimeout(Toolbar.state.errorMessageDisplay);
		document.querySelector('.error-message').removeClass('hidden');
		if (error.type)
			document.querySelector('.error-message').innerText = "Janky error sez...\n" + JSON.stringify(error).replace(/^{"|"}$/g, '').replace(/","/g, "\n").replace(/\\n/g, "\n       ").replace(/":"/g, " = ");
		else
			document.querySelector('.error-message').innerText = error;
		document.querySelector('.error-message').addEventListener('mousedown', function() { document.querySelector('.error-message').addClass('hidden') });
		//Toolbar.state.errorMessageDisplay = setTimeout(function() { document.querySelector('.error-message').addClass('hidden') }, 3000);
	},

	clearError: function _clearError(error, sourceEl) {
		if(!this._errorIsShowing) {
			return;
		}
		this._errorIsShowing = false;
		document.querySelector("#stumble").addClass("enabled");
		document.querySelector('.error-message').addClass('hidden');
		document.querySelector('.error-message').innerText = '';

	},

	handleNotify: function(message) {
		Toolbar._stateCleanup();
		clearTimeout(Toolbar.state.notifyMessageDisplay);
		document.querySelector('.notify-message').removeClass('hidden');
		document.querySelector('.notify-message').innerText = message;
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

		document.querySelector("#inline-info-body").innerHTML = '';
		var message = "";
		if (url.friend) {
			var img = document.createElement('img');
			img.src = url.friend.thumbnail;
			img.className = "inline-info-thumb";
			document.querySelector("#inline-info-body").appendChild(img);
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
		var messageElem = document.createElement('span');
		messageElem.innerText = message;
		document.querySelector("#inline-info-body").appendChild(messageElem);

		document.querySelector("#info").removeClass("on");
		document.querySelector("#dislike-menu").removeClass("on");
		document.querySelector(".toolbar-entry-stumble-domain").changeClass('hidden', !url.urlid);
		if (url.urlid) {
			document.querySelector("#info").addClass("on");
			document.querySelector("#dislike-menu").addClass("on");
			document.querySelector("#domain").innerText = uriToDomain(url.url);
			document.querySelector(".toolbar-entry-stumble-domain").changeClass('hidden', !uriToDomain(url.url));
		}

		if (url.hasOwnProperty('sponsored')) {
			document.querySelector("#sponsored").changeClass("hidden", !url.sponsored);
			document.querySelector(".toolbar-container").changeClass("inline-info-expanded", url.sponsored);
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
		document.querySelector('.convo-loading').addClass('hidden');
		if(convo.status && convo.status === "OK") {
			return true;
		}
		document.querySelector(".toolbar-container").addClass("convo-expanded");

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
			if (person.suUserId == Toolbar.config.authed)
				myConvoId = person.id;
		});

		var added = 0;
		convo.events.forEach(function(entry) {
			var entryNode = document.querySelector('#conv-' + entry.id) || document.querySelector("#stub-convo-entry").cloneNode('deep');

			added += !entryNode.id;

			entryNode.removeClass('stub');

			var poster = null;
			var me = !convo.participants || entry.createdBy == myConvoId;
			entryNode.querySelector('.convo-entry-user').innerText = personMap[entry.createdBy];
			entryNode.changeClass('convo-me', me);
			entryNode.changeClass('entry-background',           me);
			entryNode.changeClass('entry-background-secondary', !me);
			if (me) {
				poster = 'Me';
				entryNode.querySelector('.convo-entry-user').innerText = 'Me';
				entryNode.addClass('convo-me');
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

		document.querySelector('.convo-loading').addClass('hidden');

		if (convo.position != 'append') // Remember scroll position
			document.querySelector('#convo-container').scrollTop = document.querySelector('#convo-container').scrollHeight - currentOffset;
		else // Scroll to the bottom
			document.querySelector('#convo-container').scrollTop = document.querySelector('#convo-container').scrollHeight;

		this.convoContactList = new ContactList(Toolbar.config.authed);
		this.convoContactList.reconstitute(convo.contacts);
		this.updateConvoParticipants();
	},
	updateConvoParticipants: function _updateConvoParticipants() {
		var searchEl = document.querySelector('#convo-contacts-search'),
			contactsEl = document.querySelector('#convo-contacts-container'),
			contactIds = this.convoContactList.search(searchEl.value),
			i = 0,
			attributeMap = [{attributeName: 'title', propertyName: 'name'}]; // the name goes into the stub's title attribute
		this.convoContactList.render('convo-recipient-thumb-stub', attributeMap, 'convo-recipients-thumbs-container', function(contact) {
			return (3 > i++) && contact.isParticipant();
		}, false);

		attributeMap = [
			{attributeName: 'value', propertyName: 'userid'}, // the contact id goes into the stub's value attribute
			{attributeName: 'innerHTML', propertyName: 'name'} // the contact name goes into the stub's innerHTML
		];
		this.convoContactList.render('convo-recipient-stub', attributeMap, 'convo-recipients-list', function(contact) {
			return contact.isParticipant();
		}, true);
		this.convoContactList.render('convo-add-contact-stub', attributeMap, 'convo-contacts-list', function(contact) {
			return (contactIds.indexOf(contact.id) > -1) && !contact.isParticipant() && contact.isMine();
		});
		if (searchEl.value.length > 0) {
			contactsEl.removeClass('hidden');
		} else {
			contactsEl.addClass('hidden');
		}
		this.handleRedraw();
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
				try {
					document.querySelector("#" + elem.id + "-radio").checked = null;
					delete document.querySelector("#" + elem.id + "-radio").checked;
				} catch(e) {}
			});
			try {
				document.querySelector("#theme-" + config.theme + "-radio").checked = "checked";
				document.querySelector("#theme-" + config.theme).addClass('enabled');
			} catch(e) {}
		}

		document.querySelector('.action-stay-expanded').changeClass('enabled', config.stayExpanded);
		document.querySelector('#action-stay-expanded-checkbox').checked = config.stayExpanded ? "checked" : null;
		document.querySelector('.action-one-bar').changeClass('enabled', config.unloadNonVisibleBars);
		document.querySelector('#action-one-bar-checkbox').checked = config.unloadNonVisibleBars ? "checked" : null;

		if (config.interests && config.interests.length)
			Toolbar.handleInterests(config.interests);

		if (config.mode) {
			//document.querySelector(".toolbar-mode-selection").addClass("hidden");
			//document.querySelector(".toolbar-mode").removeClass("hidden");
			document.querySelector("#mode").innerText = config.modes[config.mode].name;
			if (config.mode == "domain")
				document.querySelector("#mode").innerText = config.modes[config.mode].name + " " + (config.modeinfo.domains || [])[0];
			if (config.mode == "interest")
				document.querySelector("#mode").innerText = config.modeinfo.keyword || '';
			if (config.mode == "keyword")
				document.querySelector("#mode").innerText = (config.modeinfo.keyword || '').replace(/(^| +)/g, '$1#');
		}

		if (config.hasOwnProperty('numShares')) {
			document.querySelector("#inbox .badge").innerText = config.numShares ? parseInt(config.numShares) : '';
			document.querySelector("#inbox").changeClass('enabled', parseInt(config.numShares) || document.querySelector(".toolbar-container").hasClass("inbox-expanded"));
		}
		var el = document.querySelector('.toolbar-container');
		if(el) {
			el.classList.toggle('authed', false);
		}
		if (config.hasOwnProperty('authed')) {
			if(el) {
				el.classList.toggle('authed', !!config.authed);
			}
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
			entryNode.setAttribute('values', 'urlid,id,actionid,url=convourl,read');
			if (entry.urlId)
				entryNode.setAttribute('urlid',  entry.urlId);
			entryNode.removeClass('stub');
			entryNode.querySelector('.inbox-entry-image').style       = "background-image: url(" + entry.conversationDetails.thumbnail + ")";
			entryNode.querySelector('.inbox-entry-title').innerText   = entry.conversationDetails.title;
			if (entry.sourceUserId == Toolbar.config.authed)
				entryNode.querySelector('.inbox-entry-user').innerText = 'Me';
			else
				entryNode.querySelector('.inbox-entry-user').innerText = entry.conversationDetails.originator.suUserName || entry.conversationDetails.originator.suUserId || entry.conversationDetails.originator.email;
			entryNode.querySelector('.inbox-entry-date').innerText    = reldate(entry.occurred, 's').text;
			entryNode.querySelector('.inbox-entry-date').value        = entry.occurred;
			entryNode.querySelector('.inbox-entry-snippet').innerText = entry.message;

			entryNode.changeClass('read', entry.read);
			entryNode.setAttribute('read', entry.read ? "1" : "0");

			document.querySelector('#inbox-container').insertBefore(entryNode, (inbox.position == 'prepend') ? document.querySelector('#inbox-container').firstChild : null);
		});

		if (!inbox.messages.length) {
			document.querySelector('#inbox-container').setAttribute('infinite-scroll-disabled', null);
			if (!inbox.position)
				document.querySelector('.inbox-no-entries').removeClass('hidden');
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
			if (['action', 'config', 'url', 'all', 'data', 'event'].includes(key))
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
				if (!value[parts[0]] && source.hasAttribute('validate')) {
					source.addClass('invalid');
					var clearInvalid = function() {
						source.removeClass('invalid');
						source.removeEventListener("keydown", clearInvalid, true);
					}
					source.addEventListener("keydown", clearInvalid, true);
					throw "Validation failed for " + parts[0];
				}
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
		document.querySelector(".toolbar-container").className.split(/ /).forEach(function(c) {
			var section = c.split(/-/).slice(0, -1).join('-');
			if (c.split(/-/).slice(-1) == 'expanded' && ['mode','share','convo','inline-info',action,value].indexOf(section) === -1) {
				document.querySelector(".toolbar-container").removeClass(c);
				var v = document.querySelector('#' + section);
				if (v)
					v.removeClass('enabled');
			}
		});
		if (action == 'expand' && value == 'dislike-menu' && !Toolbar.url.urlid) {
			return false;
		}
		if (action == 'cancel-bubble') {
			return false;
		}
		if (action == 'open-convo') {
			if (!elem.hasClass('read'))
				document.querySelector("#inbox .badge").innerText = (document.querySelector("#inbox .badge").innerText <= 1) ? '' : (parseInt(document.querySelector("#inbox .badge").innerText) - 1);
			elem.addClass('read');
			elem.setAttribute('read', "1");
		}
		if (action == 'stumble' || action == 'mode') {
			document.querySelector("#stumble").addClass("enabled");
			document.querySelector(".toolbar-container").removeClass("mode-expanded");
		}
		if (action == 'expand') {
			document.querySelector(".toolbar-container").toggleClass(value + "-expanded");
		}
		if (action == 'toggle-class') {
			elem.toggleClass(value);
			this.handleRedraw();
			return false;
		}
		if (action == 'inbox') {
			document.querySelector(".toolbar-container").toggleClass("inbox-expanded");
			document.querySelector('.inbox-loading').removeClass('hidden');
			document.querySelector("#inbox").changeClass('enabled', document.querySelector(".toolbar-container").hasClass("inbox-expanded") || document.querySelector("#inbox .badge").innerText);
		}
		if (action == 'show-miscat') {
			Toolbar.dispatch('report-info');
			Toolbar.handleImmediateAction('expand', 'miscat');
		}
		if (action == 'lists') {
			document.querySelector(".toolbar-container").toggleClass("lists-expanded");
			document.querySelector('.lists-loading').removeClass('hidden');
		}
		if (action == 'miscat') {
			document.querySelector(".toolbar-container").removeClass("miscat-expanded");
			document.querySelector(".toolbar-container").removeClass("dislike-menu-expanded");
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
			document.querySelector("#dislike-menu").removeClass("enabled");
		}
		if (action == 'expand' && value == 'dislike-menu') {
			document.querySelector("#dislike-menu").toggleClass("enabled");
		}
		if (action == 'share') {
			document.querySelector(".toolbar-share-container").toggleClass("hidden");
			document.querySelector(".toolbar-container").toggleClass("share-expanded");
		}
		if (action == 'share-add-contact') {
			// make the contact a participant
			this.addParticipant(value);
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
			document.querySelector("#list-name").value = '';
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
			elem.toggleClass('active');
			var el = document.querySelector('.convo-contacts-search-container');
			el.toggleClass("hidden");
			if(!el.hasClass('hidden')) {
				document.querySelector('#convo-contacts-search').focus();
			}
		}
		if (action == 'convo-add-recipient-button') {
			if(elem.hasClass('disabled')) {
				return false;
			}
			document.querySelector('#convo-show-contacts').removeClass("active");
			document.querySelector('#convo-contacts-search-container').removeClass("hidden");
			var el = document.querySelector('#convo-contacts-search');
			this.addConvoParticipant(el.value);
			elem.addClass('disabled');
			el.value = '';
			el.focus();
			return false;
		}
		if (action == 'convo-add-recipient') {
			document.querySelector('#convo-contacts-container').toggleClass("hidden");
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
		if ( action == 'expand-convo-recipients') {
			document.querySelector('.convo-recipients-container').toggleClass('expanded');
			return false;
		}
		return true;
	},
	getNewConvoParticipantData: function getNewConvoParticipantData(userid) {
		var data = null,
			contact = this.convoContactList.get(userid)
		if(contact && contact.source === "mutual") {
			data = {
				conversationId:document.querySelector('#convo-id').value,
				suUserIds:[userid]
			};
		} else if(contact && contact.source === "email") {
			data = {
				conversationId:document.querySelector('#convo-id').value,
				emails:[contact.name]
			};
		}
		return data;
	},
	getShareData: function _getShareData() {
		var data = {
			contentType:'url',
			contentId:null,
			suUserIds:null,
			initialMessage:null
		};
		if(Toolbar.url && Toolbar.url.urlid) {
			data.contentId = Toolbar.url.urlid;
		}
		data.suUserIds = this.shareContactList.find(function(contact) {return contact.participant && contact.source === "mutual"}).map(function(contact) {
			return contact.userid;
		});
		data.emails = this.shareContactList.find(function(contact) {return contact.participant && contact.source === "email"}).map(function(contact) {
			return contact.name;
		});
		data.initialMessage = document.querySelector('#toolbar-share-comment').value;
		return data;
	},
	validateShare: function _validateShare() {
		// make sure there are some recipients
		var recipients = this.shareContactList.find(function(contact) {
			return contact.isParticipant() && contact.isMine();
		});
		if(recipients.length === 0) {
			document.getElementById('toolbar-share-recipients-list').innerText = '';
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
	/**
	 * use html5 input validation api to manage the search input for share participants
	 */
	validateShareSearch: function _validateShareSearch() {
		var searchEl = document.querySelector('#share-contacts-search'),
			qs = searchEl.value,
			contactIds = this.shareContactList.search(qs);
		if(isEmailAddress(qs) || contactIds.length === 1) {
			searchEl.setCustomValidity('');
		} else {
			searchEl.setCustomValidity('input requires a valid email address or an existing contact');
		}
	},
	/**
	 * use html5 input validation api to manage the search input for conversation participants
	 */
	validateConvoSearch: function _validateConvoSearch() {
		var searchEl = document.querySelector('#convo-contacts-search'),
			qs = searchEl.value,
			contactIds = this.convoContactList.search(qs);
		if(isEmailAddress(qs) || contactIds.length === 1) {
			searchEl.setCustomValidity('');
			document.querySelector('#convo-new-email-add').removeClass('disabled');
		} else {
			searchEl.setCustomValidity('input requires a valid email address or an existing contact');
			document.querySelector('#convo-new-email-add').addClass('disabled');
		}
	},
	/**
	 * Add a contact from the existing contacts to the participants
	 * @param {string} id -- id of the contact to add
	 */
	addParticipant: function _addParticipant(id) {
		var contact = this.shareContactList.get(id);
		if(contact) {
			contact.setParticipant(true);
			this.updateShare();
		}
	},
	/**
	 * Validate the input is a username or email address and call the correct method to add the person to the participants
	 * @param nameOrEmail
	 */
	addShare: function _addShare(nameOrEmail) {
		var contactIds = this.shareContactList.search(nameOrEmail);
		if(contactIds.length === 1) {
			this.addParticipant(contactIds[0]);
		} else if(isEmailAddress(nameOrEmail)) {
			this.addShareEmail(nameOrEmail);
		}
	},
	addShareEmail: function _addShareEmail(emailAddress) {
		Toolbar.dispatch('newEmailContact', emailAddress); // signal the background to add this asynchronously to the cached contacts list
		var contact = this.shareContactList.add(encodeURIComponent(emailAddress), emailAddress, true, 'email');
		contact.setParticipant(true);
		this.updateShare();
	},
	addConvoParticipant: function _addConvoParticipant(nameOrEmail) {
		var contactIds = this.convoContactList.search(nameOrEmail);
		if(contactIds.length === 1) {
			this.addParticipantToConvo(contactIds[0]);
		} else if(isEmailAddress(nameOrEmail)) {
			this.addConvoEmail(nameOrEmail);
		}
	},
	addParticipantToConvo: function _addParticipantToConvo(id) {
		var data = this.getNewConvoParticipantData(id);
		Toolbar.dispatch('convo-add-recipient', data);
	},
	addConvoEmail: function _addConvoEmail(emailAddress) {
		Toolbar.dispatch('newEmailContact', emailAddress); // signal the background to add this asynchronously to the cached contacts list
		var contact = this.convoContactList.add(encodeURIComponent(emailAddress), emailAddress, true, 'email');
		contact.setParticipant(true);
		this.updateConvoParticipants();
	},
	/**
	 * delete a participant from the 'share' contact list -- the list of contacts for a sharing
	 * @param value
	 * @param sourceEl
	 */
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
		var searchEl = document.querySelector('#share-contacts-search'),
			contactsEl = document.querySelector('.toolbar-share-contacts-container'),
			attributeMap = [
				{attributeName: 'value', propertyName: 'userid'}, // the contact id goes into the stub's value attribute
				{attributeName: 'innerHTML', propertyName: 'name'} // the contact name goes into the stub's innerHTML
			];
		this.shareContactList.render('toolbar-share-add-contact-stub', attributeMap, 'toolbar-share-contacts-list', function(contact) {
			return !contact.isParticipant() && contact.isMine();
		});
		this.shareContactList.render('toolbar-share-contact-stub', attributeMap, 'toolbar-share-recipients-list', function(contact) {
			return contact.isParticipant() && contact.isMine();
		});
		if (searchEl.value.length > 0) {
			contactsEl.removeClass('hidden');
		} else {
			contactsEl.addClass('hidden');
		}
		searchEl.value = '';
		searchEl.focus();
		this.handleRedraw();
	},
	handleMouseDown: function(e) {
		if (e.target) {
			var node = e.target;
			do {
				if (node.hasClass('scrollable') || node.hasClass('no-drag') || node.tagName == 'INPUT' || node.tagName == 'TEXTAREA')
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
			document.querySelector('body').changeClass('top-handed',   Toolbar.config.rpos.vside == 'top');
			document.querySelector('body').changeClass('right-handed', Toolbar.config.rpos.hside == 'right');
		}
		window.top.postMessage({ type: "redraw", message: { toolbar: {
			w: Toolbar.state.w = document.querySelector(".toolbar-section-container").offsetWidth,
			h: Toolbar.state.h = document.querySelector(".toolbar-section-container").offsetHeight,
			rpos: Toolbar.config.rpos,
			hidden: Toolbar.config.hidden,
			zoom: Toolbar.state.zoom,
		} } }, "*");
	},

	handleMouse: function(mouse) {
		var hover = mouse && mouse.iframe && ( // We can do mini mode if the mouse isn't hovering over the frame
			   mouse.iframe.x >= mouse.mouse.x && mouse.iframe.x + Toolbar.state.w <= mouse.mouse.x
			&& mouse.iframe.y >= mouse.mouse.y && mouse.iframe.y + Toolbar.state.h <= mouse.mouse.y
		);
		Toolbar.state.canMiniMode = !hover;
	},

	/**
	 * initialize DOM event listeners for share contacts elements
	 * @private
	 */
	_initShareContacts: function _initShareContacts() {
		// share contacts search
		document.querySelector('#share-contacts-search').addEventListener('input', function(e) {
			this.clearError();
			this.validateShareSearch();
			if(this.shareContactList) {
				var contactIds = this.shareContactList.search(e.target.value),
					attributeMap = [
						{attributeName: 'value', propertyName: 'userid'}, // the contact id goes into the stub's value attribute
						{attributeName: 'innerHTML', propertyName: 'name'} // the contact name goes into the stub's innerHTML
					];
				this.shareContactList.render('toolbar-share-add-contact-stub', attributeMap, 'toolbar-share-contacts-list', function(contact) {
					return contactIds.indexOf(contact.id) !== -1 && !contact.isParticipant() && contact.isMine();
				});
			}
		}.bind(this));

		// share contacts new email
		document.querySelector('#share-contacts-search').addEventListener('keyup', function(e) {
			if(e.keyCode === 13) {
				if(e.target.validity.customError || e.target.validity.valueMissing) {
					// enter key
					this.handleError(new Error('Invalid Email Address'));
					return false;
				}
				this.addShare(e.target.value);
				e.target.value = '';
				e.target.focus();
			} else if(e.keyCode === 27) {
				// escape key
				e.target.value = '';
				e.target.focus();
			}
			var el = document.querySelector('.toolbar-share-contacts-container');
			if (e.target.value.length > 0) {
				el.removeClass('hidden');
			} else {
				el.addClass('hidden');
			}
		}.bind(this));

		document.querySelector('#share-contacts-search').addEventListener('focus', function(e) {
			var el = document.querySelector('.toolbar-share-contacts-container');
			if (e.target.value.length > 0) {
				el.removeClass('hidden');
			} else {
				el.addClass('hidden');
			}
			document.querySelector('.toolbar-share-recipients-container').classList.toggle('active', true);
		}.bind(this));
		document.querySelector('#share-contacts-search').addEventListener('blur', function(e) {
			document.querySelector('.toolbar-share-recipients-container').classList.toggle('active', false);
		}.bind(this));
	},

	/**
	 * initialize DOM event listeners for conversation contacts elements
	 * @private
	 */
	_initConvoContacts: function _initConvoContacts() {
		// convo contacts search
		document.querySelector('#convo-contacts-search').addEventListener('input', function(e) {
			this.clearError();
			this.validateConvoSearch();
			if(this.convoContactList) {
				var contactIds = this.convoContactList.search(e.target.value),
					attributeMap = [
						{attributeName: 'value', propertyName: 'userid'}, // the contact id goes into the stub's value attribute
						{attributeName: 'innerHTML', propertyName: 'name'} // the contact name goes into the stub's innerHTML
					];
				this.convoContactList.render('convo-add-contact-stub', attributeMap, 'convo-contacts-list', function(contact) {
					return contactIds.indexOf(contact.id) !== -1 && !contact.isParticipant() && contact.isMine();
				});
			}
			var el = document.querySelector('#convo-contacts-container');
			if(e.target.value.length > 0) {
				el.removeClass('hidden');
			} else {
				el.addClass('hidden');
			}
		}.bind(this));

		// convo contacts new email
		document.querySelector('#convo-contacts-search').addEventListener('keyup', function(e) {
			if(e.keyCode === 27) {
				// escape key
				e.target.value = '';
				e.target.focus();
			}
		}.bind(this));


		document.querySelector('#convo-contacts-search').addEventListener('focus', function(e) {
			document.querySelector('.convo-recipients-container').classList.toggle('active', true);
		}.bind(this));
		document.querySelector('#convo-contacts-search').addEventListener('blur', function(e) {
		}.bind(this));
	},

	init: function() {
		// Event and message handling
		document.getElementById("toolbar").addEventListener("click", Toolbar.handleEvent);
		chrome.runtime.onMessage.addListener(Toolbar._handleResponse);
		//window.addEventListener("message", Toolbar.handleIframeEvent, true);

		// Toolbar initialization
		Toolbar.dispatch('init');
		//Toolbar.dispatch('urlChange');
		window.setInterval(function(e) { Toolbar.tryMiniMode(e); }, 1000);

		// Drag-n-drop logic
		document.addEventListener("mousedown",      Toolbar.handleMouseDown,  true);
		document.addEventListener("mousemove",      Toolbar.handleMouseMove,  true);
		document.addEventListener("mouseup",        Toolbar.handleMouseUp,    true);
		document.addEventListener("mousewheel",     Toolbar.handleMouseWheel, true);
		document.addEventListener("wheel",          Toolbar.handleMouseWheel, true);
		document.addEventListener("DOMMouseScroll", Toolbar.handleMouseWheel, true);

		// Action-on-enter
		document.querySelectorAll('[action-on-enter]').forEach(function(elem) {
			elem.addEventListener("keypress", function(e) {
				if (e.keyCode == 13 && !e.shiftKey) {
					var target = e.target.getAttribute('action-on-enter');
					if (target)
						target = document.querySelector(target);
					else
						target = e.target;
					Toolbar.handleEvent({ target: target });
				}
			});
		});

		this._initShareContacts();
		this._initConvoContacts();

		// Hack for chrome to handle disappearing SVG background images
		if( /webkit/gi.test(navigator.userAgent.toLowerCase()) ){
			(svg || []).forEach(function(svgpath) {
				var obj = document.createElement("img");
				obj.setAttribute("type", "image/svg+xml");
				obj.setAttribute("src", svgpath);
				obj.setAttribute("width", "1");
				obj.setAttribute("height", "1");
				obj.setAttribute("style", "width: 0px; height: 0px; position: absolute;visibility : hidden");
				document.getElementsByTagName("html")[0].appendChild(obj);
			});
		}

	},
	// @TODO: documentation -- why?  what depends on this?  -- please don't make me search.
	_events: [{ ev: 'click', id: 'stumble', cb: 'stumble' }]
}
Toolbar.init();

