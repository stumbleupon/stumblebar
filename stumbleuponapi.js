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
	extractAccessToken: function(result) {
		if (!result || !result._success)
			return Promise.reject(result);

		return this.cookie.get('su_accesstoken')
			.then(function(accessToken) {
				if (!accessToken || !accessToken.value)
					return Promise.reject(accessToken);

				debug("Extracted auth token", accessToken.value);
				this.cache.mset({accessToken: accessToken.value});
				this.api.token(accessToken.value);
				return accessToken.value;
			}.bind(this));
	},

	ping: function() {
		return this.api
			.raw(this.config.endpoint.ping, null, {proto: 'http', noauth: true})
			.then(this.api.unjson.bind(this))
			.then(this.extractAccessToken.bind(this));
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

	getUrlByUrlid: function(urlid) {
		return this.api.get(this.config.endpoint.url, { urlid: urlid })
			.then(function (result) { return result.url; });
	},

	getUrlByUrl: function(url) {
		return this.api.get(this.config.endpoint.url, { url: url })
			.then(function (result) { return result.url; });
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
		return this.cache.mget('mode', 'userid')
			.then(function(map) {
				var post = this.api.prepPost("stumble", {userid: map.userid});
				return this.api
					.once(this.config.endpoint.stumble + map.mode, post, {method: 'POST'});
			}.bind(this))
			.then(function(results) {
				if (!results || !results._success)
					return Promise.reject(results);
				debug("Buffer fill", results.guesses.values);
				return this.cache.mset({
					stumbles:	results.guesses.values || [],
					numShares:	results.shares_pending || 0,
					stumblePos: -1
				});
			}.bind(this));
	},

	flush: function() {
		this.api.token(null);
		return this.cache.mset({
			accessToken: null,
			stumbles: [],
			stumblePos: -1,
		});
	},

	reportStumble: function(urlids) {
		return this.cache.mget('mode', 'user')
			.then(function (map) {
				var post = this.api.prepPost("seen", {guess_urlids: urlids, userid: map.user.userid});
				urlids.forEach(function(urlid) { this.seen[urlid] = true; }.bind(this));
				debug("Report stumble", urlids.join(','));
				return this.api.once(this.config.endpoint.stumble + map.mode, post, {method: 'POST'})
			}.bind(this));
	},

	nextUrl: function(peek, retry) {
		return this.config._get('maxRetries')
			.then(function(maxRetries) {
				if (maxRetries < (retry || 0)) {
					debug("Too many retries");
					return Promise.reject('Too many retries');
				}
			})
			.then(this.cache.map('stumbles', 'stumblePos'))
			.then(function (map) {
				var stumblePos = map.stumblePos, stumbles = map.stumbles;
				if (stumblePos >= stumbles.length - 1) {
					debug('Buffer refill from NextUrl', stumbles.length, stumblePos);
					return this.getStumbles().then(function (r) {
						return this.nextUrl(peek, (retry || 0) + 1);
					}.bind(this));
				}
	
				++ stumblePos;
				if (!peek)
					this.cache.mset({stumblePos: stumblePos});
				if (stumblePos >= stumbles.length - this.config.refillPos)
					this.getStumbles();
				if (!peek && this.seen[stumbles[stumblePos].urlid]) // TODO re-report seen
					return this.nextUrl(peek, retry)
				if (!peek)
					debug("NextUrl", stumbles[stumblePos], stumblePos, stumbles);
				return stumbles[stumblePos];
			}.bind(this));
	}
}

