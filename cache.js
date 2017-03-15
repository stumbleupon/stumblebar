function Cache(defaults) {
	this.defaults = {}
	this.init(defaults || {})
  this.map = function() {
		var r = this.mget.apply(this, arguments);
		return function() { return r };
  }
}

Cache.prototype = {
	mget: function() {
		// Lazy mget w/array
		if (arguments.length == 1 && arguments[0] instanceof Array)
			return this.mget.apply(this, arguments[0]);

		var reqs = [];
		var keys = [];

		next: for (var i = 0; i < arguments.length; i++) {
			v = arguments[i];
			if (typeof(v) == "string") {
				reqs.push(this.get(v));
				keys.push(v);
				continue next;
			}

			if (typeof(v) == "object") {
				for (var k in v) {
					reqs.push(this.get(k, v[k]));
					keys.push(k);
					continue next;
				}
			}

			keys.push(v);
			reqs.push(null);
		}
		return Promise.all(reqs)
			.then(function(r) {
				var retval = {};
				r.forEach(function(v, k) {
					retval[keys[k]] = v;
				})
				return retval;
			});
	},
	get: function(key, fallback) {
		key = this.defaults.prefix + key;
		return new Promise(function (resolve, reject) {
			return chrome.storage.local.get(key, function(result) {
				if (!key)
					resolve(result);
				else if (result.hasOwnProperty(key)) {
					var val = result[key];
					if(typeof val === 'object') {
						// see if it has an expiration
						if(val.hasOwnProperty(('_expires')) && typeof val._expires === "number" && val._expires <= Date.now()) {
							return resolve(null);
						}
						// if it has a value set, return it
						if(val.hasOwnProperty('_setValue')) {
							val = val._setValue;
						}
					}
					resolve(val);
				}
				else if (typeof fallback != 'undefined')
					resolve(fallback)
				else if (typeof this.defaults[key] != 'undefined')
					resolve(this.defaults[key])
				else
					resolve(null);
			}.bind(this));
		}.bind(this));
	},

	mset: function(map) {
		return new Promise(function (resolve, reject) {
			return chrome.storage.local.set(map, resolve);
		});
	},

	/**
	 *
	 * @param key
	 * @param value
	 * @param msTtl -- time to live in milliseconds
	 * @returns {*}
	 */
	set: function(key, value, msTtl) {
		var obj = new Object(),
			obj = {[this.defaults.prefix + key]: value}
		if((typeof msTtl === "number")) {
			var expires = Date.now() + msTtl;
			obj[this.defaults.prefix + key] = {_setValue: value, _expires: expires};
		}
		return this.mset(obj);
	},

	init: function(kvpairs) {
		this.defaults = kvpairs
		this.defaults.prefix = this.defaults.prefix || '';
	}
}


