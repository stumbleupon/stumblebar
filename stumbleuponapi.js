function StumbleUponApi(config) {
	this.config = config;
	this.state = {
		loggedIn: false,
		accessToken: null,
		user: {},
	};
	this.requests = {};
	this.seen = {};
	this.cache = new Cache(config.defaults);
	this.cookie = new Cookie(config);
	this.api = new Api(config);
	//this.cookie.get('su_accesstoken')
	//					 .then(this.extractAccessToken.bind(this))
}

StumbleUponApi.prototype = {
	ping: function() {
		return this.api
			.raw(this.config.endpoint.ping, null, {proto: 'https', headers: {[this.config.accessTokenHeader]: null}})
			.then(JSON.parse)
			.then(this._extractAccessToken.bind(this));
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
		var cacheKey = 'my-contacts',
			dataNode = 'mutual';
		return this.cache.get(cacheKey)
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
                            this.cache.set(cacheKey, contacts[dataNode]);
                            return contacts[dataNode];
                        }.bind(this));
				}
			}.bind(this));
	},

	convoAddRecipient: function(convoRecipientData) {
		var convo = new Conversation(this.config.conversationsAPI, convoRecipientData.conversationId);
		convo.api.addHeaders(this.api.getHeaders());
		return convo.addRecipient(convoRecipientData);
	},

	getUrlByUrlid: function(urlid) {
		return this.api.get(this.config.endpoint.url, { urlid: urlid })
			.then(function (result) { return result.url; });
	},

	getUrlByHref: function(url) {
		return this.api.get(this.config.endpoint.url, { url: url })
			.then(function (result) { return result.url; });
	},

	getPendingUnread: function(scope) {
		return this.api.get(this.config.endpoint.unread, { scope: scope || 'conversation' })
			.then(function(info) {
				if (!info._success)
					return Promise.reject(info);
				return info;
			})
	},

	getConversations: function(start, limit, type) {
		return this.getNotifications(start, limit, 'conversation')
	},
	getNotifications: function(position, limit, scope, type) {
		return this.api.get(this.config.endpoint.activities, { [type || 'start']: position || 0, limit: limit || 25, scope: scope || 'conversation' })
			.then(function(convos) {
				if (!convos._success)
					return Promise.reject(convos);
				return convos.activities.values;
			});
	},

	addToList: function(listid, urlid) {
		return this.api.req(this.config.endpoint.addtolist.form({ listid: listid }), { listId: listid, urlid: urlid })
			.then(function(item) {
				if (!item._success)
					return Promise.reject(item);
				return item.item;
			});
	},

	addList: function(name, description, visibility) {
		return this.cache.get('user')
			.then(function(user) {
				return this.api.req(this.config.endpoint.lists.form({ userid: user.userid }), { userid: user.userid, name: name, visibility: visibility || 'private', description: description || '', widgetText: name, widgetDataId: 'attribute miss', '_visible': (visibility || 'private') != 'private' })
					.then(function(list) {
						if (!list._success)
							return Promise.reject(list);
						return list.list;
					});
			}.bind(this));
	},

	getLists: function(unsorted) {
		return this.cache.get('user')
			.then(function(user) {
				return this.api.get(this.config.endpoint.lists.form({ userid: user.userid }), { userid: user.userid, sorted: !unsorted })
					.then(function(lists) {
						if (!lists._success)
							return Promise.reject(lists);
						return lists.lists.values;
					});
			}.bind(this));
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
			.then(function(res) {
				if (!res || !res._success || !res.discovery.url.publicid)
					return Promise.reject(res);
				if (!nolike)
					this.like(res.discovery.url.publicid);
				return res.discovery.url;
			}.bind(this));
	},

	getUser: function() {
		return this.api.req(this.config.endpoint.user)
			.then(function(result) {
			    var loggedIn = false, user = {};
			  	if (result && result._success && result.user) {
			  		loggedIn = true;
			  		user = result.user;
			  	}
			  	this.cache.mset({loggedIn: loggedIn, user: user});
			  	return user;
			}.bind(this));
	},

	getStumbles: function() {
		var mode = null;
		return this.cache.mget('mode', 'user')
			.then(function(map) {
				mode = map.mode;
				var post = this._buildPost("stumble", {userid: map.user.userid});
				return this.api
					.once(this.config.endpoint.stumble.form(map), post, {method: 'POST'});
			}.bind(this))
			//.then(this._syncSharesPending.bind(this))
			.then(function(results) {
				if (!results || !results._success)
					return Promise.reject(results);
				debug("Buffer fill", mode, results.guesses.values);
				results.guesses.values.forEach(function(stumble) {
					stumble.mode = mode;
				});
				return this.cache.mset({
					stumble:	{ list: results.guesses.values || [], pos: -1, mode: mode },
				});
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
		return this.cache.mget('stumble', 'user', 'mode')
			.then(function (map) {
				// FIXME double reporting/re-reporting
				//for (var urlid in this.seen) {
				//	if (this.seen[urlid].state == 'f')
				//		urlids.push(urlid);
				//}

				var mode = mode || map.stumble.mode || map.mode;
				var post = this._buildPost("seen", {guess_urlids: urlids, userid: map.user.userid});
				urlids.forEach(function(urlid) { this.seen[urlid] = this.seen[urlid] || {state: 'u', mode: mode}; }.bind(this));

				debug("Report stumble", urlids.join(','));
				return this.api
					.req(this.config.endpoint.stumble.form({mode: mode || map.stumble.mode || map.mode}), post, {method: 'POST'})
					//.then(this._syncSharesPending.bind(this))
					.then(function(res) {
						if (res._success) {
							urlids.forEach(function(urlid) { this.seen[urlid].state = 'r'; }.bind(this));
						}
						return res;
					}.bind(this))
					.catch(function(err) {
						// Mark failed unreported so we can re-report later
						urlids.forEach(function(urlid) { this.seen[urlid].state = 'f'; }.bind(this));
					}.bind(this))
			}.bind(this));
	},

	nextUrl: function(peek, retry) {
		peek = peek || 0;
		retry = retry || 0;
		return Promise.resolve(this.config.maxRetries)
			.then(function(maxRetries) {
				if (maxRetries < retry) {
					debug("Too many retries");
					return Promise.reject('Too many retries');
				}
			})
			.then(this.cache.map('stumble', 'mode'))
			.then(function (map) {
				var stumblePos = map.stumble.pos || 0, stumbles = map.stumble.list;
				if ((stumblePos + peek) >= stumbles.length - 1 || map.mode != map.stumble.mode) {
					debug('Buffer refill from NextUrl', stumbles.length, stumblePos + peek);
					return this.getStumbles().then(function (r) {
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

	_flush: function() {
		this.api.addHeaders({[this.config.accessTokenHeader]: null});
		return this.cache.mset({
			accessToken: null,
			stumbles: [],
			stumblePos: -1,
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

	_mode: function(mode) {
		this.cache.mset({mode: mode});
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
			this.config.numShares = res.shares_pending
		}
		return res;
	},

}

