function StumbleUponApi(config, cache, userCache) {
	this.config = config;
	this.cache = cache;
	this.userCache = userCache || null;
	this.state = {
		loggedIn: false,
		accessToken: null,
		user: {},
	};
	this.requests = {};
	this.seen = {};
	this.cookie = new Cookie(config);
	this.api = new Api(config);
	this.contactsKey = 'contacts';
	//this.cookie.get('su_accesstoken')
	//					 .then(this.extractAccessToken.bind(this))
}

StumbleUponApi.expectSuccess = function(result) {
	if (!result || !result._success || result._error)
		return Promise.reject(new ToolbarError("SUAPI", "error", result && result._error || result, result && result._code));
	return result;
}

StumbleUponApi.prototype = {
	ping: function() {
		return this.api
			.raw(this.config.endpoint.ping, null, {proto: 'https', headers: {[this.config.accessTokenHeader]: null}})
			.then(JSON.parse)
			.then(function(r) { return StumbleUponApi.expectSuccess(r); })
			.then(this._extractAccessToken.bind(this));
	},

	setUserCache: function setUserCache(userCache) {
		this.userCache = userCache;
	},

	reportInfo: function(urlid) {
		return this.api.get(this.config.endpoint.report.form({ report: 'info' }), { urlid: urlid })
			.then(function(r) { return StumbleUponApi.expectSuccess(r); });
	},

	reportMissing: function(urlid) {
		return this.api.req(this.config.endpoint.report.form({ report: 'notAvailable' }), { urlid: urlid })
			.then(function(r) { return StumbleUponApi.expectSuccess(r); });
	},

	reportSpam: function(urlid, catid, note) {
		return this.rate(urlid, -1, -5);
	},

	reportMiscat: function(urlid, catid, note) {
		return this.api.req(this.config.endpoint.report.form({ report: 'misclassified' }), { urlid: urlid, catid: catid, note: note })
			.then(function(r) { return StumbleUponApi.expectSuccess(r); });
	},

	rate: function(urlid, score, subtype) {
		return this.api.req(this.config.endpoint.rate, Object.assign({ urlid: urlid, type: score }, subtype && { subtype: subtype }), { method: 'POST' })
			.then(function(r) { return StumbleUponApi.expectSuccess(r); });
	},

	like: function(urlid) {
		return this.rate(urlid, 1);
	},

	dislike: function(urlid) {
		return this.rate(urlid, -1);
	},

	unrate: function(urlid) {
		return this.api.req(this.config.endpoint.unrate.form({ urlid: urlid }), {}, { method: 'DELETE' })
			.then(function(r) { return StumbleUponApi.expectSuccess(r); });
	},

	/**
	 * manage the contacts. contacts consist of email contacts (stored locally) and mutual follow contacts
	 * (stored in api and refreshed after 5 minutes) -- these heterogenous types need to sort, display,
	 * and react to user events as if there is no difference.
	 * @returns {Promise<ContactList>}
	 */
	getContacts: function apiGetContacts() {
		var userCache = this.userCache,
			mutualRefreshFlag = 'mutalIsCurrent',
			mutualTtl = 300000,
			contactList, // contactList will be used to produce the json response that will be reconstituted in the iframe context.
			userId;
		return this.getUser()
			.then(function _gotUser(user) {
				return userId = user.userid; // stash userid in the userId var of the closure
			}.bind(this))
			.then(function _getCachedContacts(userid) {
				return userCache.mget(this.contactsKey, mutualRefreshFlag)
			}.bind(this))
			.then(function _gotCachedContacts(results) {
				var contactsObj = results[this.contactsKey],
					mutualNeedsUpdate = (!results[mutualRefreshFlag] || !contactsObj);
				contactList = new ContactList(userId); // contactList is in the closure scope of getContacts -- goal is to build it and return it in the final step of the promise chain
				if(contactsObj) {
					contactsObj = JSON.parse(contactsObj);
					contactList.reconstitute(contactsObj);
				};
				if(mutualNeedsUpdate) {
					// mutualContactsObj is out of date, fetch from api and repopulate ContactList
					return this.api.get(this.config.endpoint.contacts.form({userid: userId}), {limit: 600, filter_spam: true })
						.then(function(contacts) {
							userCache.set(mutualRefreshFlag, true, mutualTtl); // this can run async
							return contacts['mutual'];
						}.bind(this))
						.then(function(contacts) {
							contactList.addMultiple(contacts['values'], true, 'mutual');
							userCache.set(this.contactsKey, JSON.stringify(contactList)); // this can run async
							return contactList;
						}.bind(this));
				}
				return contactList;
			}.bind(this));
	},

	newEmailContact: function _newEmailContact(emailAddress) {
		var userCache = this.userCache;
		return this.getContacts()
			.then(function _gotContactList(contactList) {
				contactList.add(encodeURIComponent(emailAddress), emailAddress, true, 'email');
				contactList.sort();
				userCache.set(this.contactsKey, JSON.stringify(contactList)); // this can run async
				return contactList;
			}.bind(this));
	},

	convoAddRecipient: function(convoRecipientData) {
		var convo = this.getConversation(convoRecipientData.conversationId);
		return convo.addRecipient(convoRecipientData);
	},

	getUrlByUrlid: function(urlid) {
		return this.api.get(this.config.endpoint.url, { urlid: urlid })
			.then(function(r) { return StumbleUponApi.expectSuccess(r); })
			.then(function (result) { return result.url; });
	},

	getInterests: function() {
		return this.cache.get('user')
			.then(function(user) { return user || Promise.reject(new ToolbarError("SUAPI", 'getInterests', 'nouser')); })
			.then(function(user) {
				return this.api.get(this.config.endpoint.interests.form({ userid: user.userid }), { userid: user.userid })
			}.bind(this))
			.then(function(r) { return StumbleUponApi.expectSuccess(r); })
			.then(function (result) { return result.interests.values; });
	},

	getUrlByHref: function(url) {
		return this.api.get(this.config.endpoint.url, { url: url })
			.then(function(r) { return StumbleUponApi.expectSuccess(r); })
			.then(function (result) { return result.url; });
	},

	getPendingUnread: function(scope) {
		return this.api.get(this.config.endpoint.unread, { scope: scope || 'conversation', matchActivities: 'true' })
			.then(function(r) { return StumbleUponApi.expectSuccess(r); });
	},

	blockSite: function(urlid) {
		return this.api.req(this.config.endpoint.blocksite.form({ urlid: urlid }), {})
			.then(function(r) { return StumbleUponApi.expectSuccess(r); });
	},

	getConversations: function(start, limit, type) {
		return this.getNotifications(start, limit, 'conversation')
	},
	getNotifications: function(position, limit, scope, type) {
		return this.api.get(this.config.endpoint.activities, { [type || 'start']: position || 0, limit: limit || 25, scope: scope || 'conversation' })
			.then(function(r) { return StumbleUponApi.expectSuccess(r); })
			.then(function(convos) { return convos.activities.values; });
	},

	addToList: function(listid, urlid) {
		return this.api.req(this.config.endpoint.addtolist.form({ listid: listid }), { listId: listid, urlid: urlid })
			.then(function(r) { return StumbleUponApi.expectSuccess(r); })
			.then(function(item) { return item.item; });
	},

	addList: function(name, description, visibility) {
		return this.cache.get('user')
			.then(function(user) {
				return this.api.req(this.config.endpoint.lists.form({ userid: user.userid }), {
					userid: user.userid,
					name: name,
					visibility: visibility || 'private',
					description: description || '',
					widgetText: name,
					widgetDataId: 'attribute miss',
					'_visible': (visibility || 'private') != 'private'
				});
			}.bind(this))
			.then(function(r) { return StumbleUponApi.expectSuccess(r); })
			.then(function(list) { return list.list; });
	},

	getLists: function(unsorted) {
		return this.cache.get('user')
			.then(function(user) {
				return this.api.get(this.config.endpoint.lists.form({ userid: user.userid }), { userid: user.userid, sorted: !unsorted });
			}.bind(this))
			.then(function(r) { return StumbleUponApi.expectSuccess(r); })
			.then(function(lists) { return lists.lists.values; });
	},

	getConversation: function(id) {
		var convo = new Conversation(this.config.conversationsAPI, id);
		convo.api.addHeaders(this.api.getHeaders());
		return convo;
	},

	markActivityAsRead: function(id) {
		return this.api.req(this.config.endpoint.markactivity.form({ id: id, action: 'read' }), { id: id, read: true }, { method: 'PUT' });
	},

	submit: function(url, nsfw, nolike) {
		return this.api.req(this.config.endpoint.submit, { url: url, nsfw: nsfw || false })
			.then(function(r) { return StumbleUponApi.expectSuccess(r); })
			.then(function(res) {
				if (!res.discovery.publicid && !res.discovery.url.publicid)
					return Promise.reject(new ToolbarError("SUAPI", "submit", res));
				if (!nolike)
					this.like(res.discovery.publicid || res.discovery.url.publicid);
				return res.discovery.publicid ? res.discovery : res.discovery.url;
			}.bind(this));
	},

	getUser: function() {
		return this.api.req(this.config.endpoint.user)
			.then(function(r) { return StumbleUponApi.expectSuccess(r); })
			.catch(function(result) {
			  	this.cache.mset({ loggedIn: false, user: {} });
				return Promise.reject(new ToolbarError("SUAPI", "getUser", result));
			}.bind(this))
			.then(function(result) {
			  	this.cache.mset({ loggedIn: !!result.user, user: result.user });
			  	return result.user;
			}.bind(this));
	},

	getStumbles: function() {
		return this.cache.mget('mode', 'user', 'modeinfo')
			.then(function(map) {
				var post = Object.assign(this._buildPost("stumble", {userid: map.user.userid}), map.modeinfo || {});
				return this.api
					.once(this.config.endpoint.stumble.form(map), post, {method: 'POST'})
					.then(function(r) { return StumbleUponApi.expectSuccess(r); })
					.then(function(results) {
						results.guesses.values.forEach(function(stumble) { stumble.mode = map.mode; stumble.modeinfo = map.modeinfo; stumble.modekey = this._modeKey(map.mode, map.modeinfo); }.bind(this));
						return results;
					}.bind(this))
					.then(function(results) {
						debug("Buffer fill", [map.mode, map.modeinfo], results.guesses.values);
						this.cache.mset({ stumble:	{ list: results.guesses.values || [], pos: -1, mode: map.mode, modeinfo: map.modeinfo, modekey: this._modeKey(map.mode, map.modeinfo) } });
						return results;
					}.bind(this));
			}.bind(this));
	},

	/**
	 * @typedef {Object} ShareData
	 * @property {string} contentType
	 * @property {string} contentId
	 * @property {Array<string>} suUserIds
	 * @property {Array<string>} emails
	 * @property {string} initialMessage

	/**
	 * @param {ShareData} shareData
	 */
	saveShare: function(shareData) {
		var convo = this.getConversation(null); // build the saveShare response -- the conversation with contacts attached
		if(typeof shareData === "object") {
			shareData.forceJSON = true;
		}
		return Promise.all([convo.save(shareData), this.getContacts()])
			.then(function _savedConvo(results) {
				var conversation = results[0],
					contacts = results[1],
					now = Date.now();
				conversation.participants && conversation.participants.forEach(function _touchOrInsertContact(participant) {
					// @TODO this code is repeated in toolbarevent.js -- refactor to some common place
					// update the last-accessed time for sorting purposes -- this must be persisted
					var contact = contacts.get(participant.suUserId || encodeURIComponent(participant.email));
					if(contact) {
						contact.touch(now);
					} else { // this participant isn't in our cached contact list, so insert them
						if(participant.email) {
							contacts.add(encodeURIComponent(participant.email), participant.email, false, "convo");
						} else if(participant.suUserId) {
							contacts.add(
								participant.suUserId,
								participant.name ? participant.name + " (" + participant.suUserName + ")" : participant.suUserName,
								false,
								"convo"
							);
						}
					}
				});
				contacts.sort();
				this.userCache.set(this.contactsKey, JSON.stringify(contacts)); // this can run async
				conversation.participants && conversation.participants.forEach(function _setParticipant(participant) {
					// set the participant flag for the front-end
					var contact = contacts.get(participant.suUserId || encodeURIComponent(participant.email));
					contact && contact.setParticipant(true);
				});
				conversation.contacts = contacts;
				return conversation;
			}.bind(this));
	},

	reportStumble: function(urlids, mode, modeinfo) {
		return this.cache.mget('stumble', 'user', 'mode', 'modeinfo')
			.then(function (map) {
				// FIXME double reporting/re-reporting
				//for (var urlid in this.seen) {
				//	if (this.seen[urlid].state == 'f')
				//		urlids.push(urlid);
				//}

				var mode = mode || map.stumble.mode || map.mode;
				var modeinfo = modeinfo || map.stumble.modeinfo || map.modeinfo;
				var post = Object.assign(this._buildPost("seen", {guess_urlids: urlids, userid: map.user.userid}), modeinfo);
				urlids.forEach(function(urlid) { this.seen[urlid] = this.seen[urlid] || {state: 'u', mode: mode, modeinfo: modeinfo}; }.bind(this));

				debug("Report stumble", urlids.join(','));
				return this.api.req(this.config.endpoint.stumble.form({mode: mode}), post, {method: 'POST'});
			}.bind(this))
			.then(function(r) { return StumbleUponApi.expectSuccess(r); })
			.then(function(res) {
				urlids.forEach(function(urlid) { this.seen[urlid].state = 'r'; }.bind(this));
				return res;
			}.bind(this))
			.catch(function(err) {
				// Mark failed unreported so we can re-report later
				urlids.forEach(function(urlid) { this.seen[urlid].state = 'f'; }.bind(this));
			}.bind(this))
	},

	nextUrl: function(peek, retry) {
		peek = peek || 0;
		retry = retry || 0;
		return this.cache.mget(['stumble', 'mode', 'modeinfo'])
			.then(function (map) {
				var stumblePos = (map.stumble && map.stumble.pos) || 0, stumbles = (map.stumble || {}).list || [];
				if ((stumblePos + peek) >= stumbles.length - 1 || this._modeKey(map.mode, map.modeinfo) != map.stumble.modekey) {
					debug('Buffer refill from NextUrl', stumbles.length, stumblePos + peek);
					return this.getStumbles().then(function (r) {
						if (retry >= (this.config.maxRetries || 3)) {
							warning("Too many retries");
							return Promise.reject(new ToolbarError('SUAPI', 'nextUrl', 'runout'));
						}
						return this.nextUrl(peek ? 1 : 0, retry + 1);
					}.bind(this));
				}
	
				// If we're not peeking, move the stumble pointer forward
				stumblePos += peek || 1;
				if (!peek) {
					map.stumble.pos = stumblePos;
					this.cache.mset({stumble: map.stumble});
				}

				// If we've seen this before, rereport and move onto the next url
				if (this.seen[stumbles[stumblePos].urlid]) {
					debug("Already seen", stumbles[stumblePos].urlid);
					this.reportStumble([stumbles[stumblePos].urlid], stumbles[stumblePos].mode, stumbles[stumblePos].modeinfo);
					return this.nextUrl(peek ? peek + 1 : 0, retry);
				}

				// If we're nearing the end of the buffer, grab more stumbles
				if (stumblePos >= stumbles.length - this.config.refillPos) {
					this.getStumbles();
				}

				if (!peek)
					debug("NextUrl", stumbles[stumblePos], stumblePos, stumbles);

				return stumbles[stumblePos];
			}.bind(this));
	},

	_flushStumbles: function() {
		return this.cache.mset({
			stumbles: [],
			stumblePos: -1,
		});
	},

	_flush: function() {
		this.api.addHeaders({[this.config.accessTokenHeader]: null});
		this.userCache = null;
		this.flushStumbles();
		return this.cache.mset({
			accessToken: null,
		});
	},

	_buildPost: function(type, remap) {
		var post = {};
		for (var key in this.config.post[type]) {
			post[key] = this.config.post[type][key];
		}
		for (var key in remap) {
			post[key] = remap[key];
		}
		return post;
	},

	_mode: function(mode, info) {
		this.cache.mset({mode: mode, modeinfo: info});
		return this;
	},

	_modeKey: function(mode, info) {
		return JSON.stringify({mode: mode, info: info});
	},

	_extractAccessToken: function(result) {
		return this.cookie.get('su_accesstoken')
			.then(function(accessToken) {
				if (!accessToken || !accessToken.value)
					return Promise.reject(new ToolbarError('SUAPI', 'notoken', accessToken));

				debug("Extracted auth token", accessToken.value);
				this.cache.mset({accessToken: accessToken.value});
				this.api.addHeaders({[this.config.accessTokenHeader]: accessToken.value});
				return accessToken.value;
			}.bind(this));
	}

}

