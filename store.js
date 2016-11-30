var Cache = {
	_state: function(key, fallback) {
		return new Promise(function (resolve, reject) {
			return chrome.storage.local.get(key, function(result) {
				if (!key)
					resolve(result);
				else if (result.hasOwnProperty(key))
					resolve(result[key])
				else if (typeof fallback != 'undefined')
					resolve(fallback)
				else
					reject(result);
			});
		}.bind(this));
  },

	_store: function(key, value) {
		return new Promise(function (resolve, reject) {
			return chrome.storage.local.set(key, resolve);
		});
  },
}
