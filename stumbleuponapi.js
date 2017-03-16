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
	//this.cookie.get('su_accesstoken')
	//					 .then(this.extractAccessToken.bind(this))
}

StumbleUponApi.expectSuccess = function(result) {
	if (!result || !result._success || result._error)
		return Promise.reject(new Error("SUAPI", "error", result && result._error, result && result._code));
	return result;
}

StumbleUponApi.prototype = {
	ping: function() {
		return this.api
			.raw(this.config.endpoint.ping, null, {proto: 'https', headers: {[this.config.accessTokenHeader]: null}})
			.then(JSON.parse)
			.then(this._extractAccessToken.bind(this));
	},

	setUserCache: function setUserCache(userCache) {
		this.userCache = userCache;
	},

	rate: function(urlid, score) {
		return this.api.req(this.config.endpoint.rate, { urlid: urlid, type: score }, { method: 'POST' });
	},

	like: function(urlid) {
		return this.rate(urlid, 1);
	},

	dislike: function(urlid) {
		return this.rate(urlid, -1);
	},

	unrate: function(urlid) {
		return this.api.req(this.config.endpoint.unrate.form({ urlid: urlid }), {}, { method: 'DELETE' });
	},

	getContacts: function apiGetContacts() {
		var userCache = ToolbarEvent.userCache,
			cacheKey = 'my-contacts',
			cacheTtl = 300000,
			dataNode = 'mutual';
		return userCache.get(cacheKey)
			.then(function(contacts) {
				debug(contacts);
				if(contacts) {
					return contacts;
				} else {
					return this.getUser()
						.then(function(user) {
							return user.userid;
						}.bind(this))
						.then(function(userid) {
							return this.api.get(this.config.endpoint.contacts.form({userid: userid}), {limit: 50, filter_spam: true })
						}.bind(this))
						.then(function(contacts) {
							userCache.set(cacheKey, contacts[dataNode], cacheTtl);
							return contacts[dataNode];
						}.bind(this));
				}
			}.bind(this));
	},

	convoAddRecipient: function(convoRecipientData) {
		var convo = this.getConversation(convoRecipientData.conversationId);
		return convo.addRecipient(convoRecipientData);
	},

	getUrlByUrlid: function(urlid) {
		return this.api.get(this.config.endpoint.url, { urlid: urlid })
			.then(function (result) { return result.url; });
	},

	getInterests: function() {
		return this.cache.get('user')
			.then(function(user) {
				return this.api.get(this.config.endpoint.interests.form({ userid: user.userid }), { userid: user.userid })
					.then(function (result) { return result.interests.values; });
			}.bind(this));
	},

	getUrlByHref: function(url) {
		return this.api.get(this.config.endpoint.url, { url: url })
			.then(function (result) { return result.url; });
	},

	getPendingUnread: function(scope) {
		return this.api.get(this.config.endpoint.unread, { scope: scope || 'conversation' })
			.then(StumbleUponApi.expectSuccess);
	},

	blockSite: function(urlid) {
		return this.api.req(this.config.endpoint.blocksite.form({ urlid: urlid }), {});
	},

	getConversations: function(start, limit, type) {
		return this.getNotifications(start, limit, 'conversation')
	},
	getNotifications: function(position, limit, scope, type) {
		return this.api.get(this.config.endpoint.activities, { [type || 'start']: position || 0, limit: limit || 25, scope: scope || 'conversation' })
			.then(StumbleUponApi.expectSuccess)
			.then(function(convos) { return convos.activities.values; });
	},

	addToList: function(listid, urlid) {
		return this.api.req(this.config.endpoint.addtolist.form({ listid: listid }), { listId: listid, urlid: urlid })
			.then(StumbleUponApi.expectSuccess)
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
			.then(StumbleUponApi.expectSuccess)
			.then(function(list) { return list.list; });
	},

	getLists: function(unsorted) {
		return this.cache.get('user')
			.then(function(user) {
				return this.api.get(this.config.endpoint.lists.form({ userid: user.userid }), { userid: user.userid, sorted: !unsorted });
			}.bind(this))
			.then(StumbleUponApi.expectSuccess)
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
			.then(StumbleUponApi.expectSuccess)
			.then(function(res) {
				if (!res.discovery.url.publicid)
					return Promise.reject(res);
				if (!nolike)
					this.like(res.discovery.url.publicid);
				return res.discovery.url;
			}.bind(this));
	},

	getUser: function() {
		return this.api.req(this.config.endpoint.user)
			.then(StumbleUponApi.expectSuccess)
			.catch(function(result) {
			  	this.cache.mset({ loggedIn: false, user: {} });
				return Promise.reject(result);
			}.bind(this))
			.then(function(result) {
			  	this.cache.mset({ loggedIn: !!result.user, user: result.user });
			  	return result.user;
			}.bind(this));
	},

	getStumbles: function() {
		var mode = null;
		return this.cache.mget('mode', 'user', 'modeinfo')
			.then(function(map) {
				mode = map.mode;
				var post = Object.assign(this._buildPost("stumble", {userid: map.user.userid}), map.modeinfo || {});
				return this.api
					.once(this.config.endpoint.stumble.form(map), post, {method: 'POST'});
			}.bind(this))
			.then(StumbleUponApi.expectSuccess)
			.then(function(results) {
				debug("Buffer fill", mode, results.guesses.values);
				results.guesses.values.forEach(function(stumble) { stumble.mode = mode; });
				this.cache.mset({ stumble:	{ list: results.guesses.values || [], pos: -1, mode: mode } });
				return results;
			}.bind(this));
	},

	/**
	 * @typedef {Object} ShareData
	 * @property {string} contentType
	 * @property {string} contentId
	 * @property {Array<number>} suUserIds
	 * @property {string} initialMessage

	/**
	 * @param {ShareData} shareData
	 */
	saveShare: function(shareData) {
		var convo = new Conversation(this.config.conversationsAPI, null);
		convo.api.addHeaders(this.api.getHeaders());
		return convo.save(shareData);
	},

	reportStumble: function(urlids, mode) {
		return this.cache.mget('stumble', 'user', 'mode', 'modeinfo')
			.then(function (map) {
				// FIXME double reporting/re-reporting
				//for (var urlid in this.seen) {
				//	if (this.seen[urlid].state == 'f')
				//		urlids.push(urlid);
				//}

				var mode = mode || map.stumble.mode || map.mode;
				var post = Object.assign(this._buildPost("seen", {guess_urlids: urlids, userid: map.user.userid}), map.modeinfo || {});
				urlids.forEach(function(urlid) { this.seen[urlid] = this.seen[urlid] || {state: 'u', mode: mode}; }.bind(this));

				debug("Report stumble", urlids.join(','));
				return this.api.req(this.config.endpoint.stumble.form({mode: mode || map.stumble.mode || map.mode}), post, {method: 'POST'});
			}.bind(this))
			.then(StumbleUponApi.expectSuccess)
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
		return this.cache.mget(['stumble', 'mode', 'maxRetries'])
			.then(function (map) {
				var stumblePos = (map.stumble && map.stumble.pos) || 0, stumbles = (map.stumble || {}).list || [];
				if ((stumblePos + peek) >= stumbles.length - 1 || map.mode != map.stumble.mode) {
					debug('Buffer refill from NextUrl', stumbles.length, stumblePos + peek);
					return this.getStumbles().then(function (r) {
						if (retry >= map.maxRetries) {
							warning("Too many retries");
							return Promise.reject('RUNOUT');
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
					this.reportStumble([stumbles[stumblePos].urlid]);
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
		return this.cache.mset({
			accessToken: null,
		});
		this.userCache = null;
		this.flushStumbles();
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

	_extractAccessToken: function(result) {
		if (!result || !result._success)
			return Promise.reject(result);

		return this.cookie.get('su_accesstoken')
			.then(function(accessToken) {
				if (!accessToken || !accessToken.value)
					return Promise.reject(accessToken);

				debug("Extracted auth token", accessToken.value);
				this.cache.mset({accessToken: accessToken.value});
				this.api.addHeaders({[this.config.accessTokenHeader]: accessToken.value});
				return accessToken.value;
			}.bind(this));
	},

	_syncSharesPending: function(res) {
		if (res && res.shares_pending) {
			this.cache.mset({ numShares: res.shares_pending });
		}
		return res;
	},

}

