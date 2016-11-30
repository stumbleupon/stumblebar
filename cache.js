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
		return new Promise(function (resolve, reject) {
			return chrome.storage.local.get(key, function(result) {
				if (!key)
					resolve(result);
				else if (result.hasOwnProperty(key))
					resolve(result[key])
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

	set: function(key, value) {
		return this.mset({key: value});
  },

	init: function(kvpairs) {
		this.defaults = kvpairs
	}
}
