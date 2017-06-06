var Cookie = function(config) {
	this.baseUrl = config.baseUrl;
}

Cookie.prototype = {
	get: function(name, exhaustive) {
		return new Promise(function(resolve, reject) {
			browser.cookies.get({
				url:    'http://' + this.baseUrl,
				name:   name
			}, function(r) {
				if (!exhaustive || (r && r.name))
					return resolve(r);

				// Hacky hack to handle cookie fetches in private mode browsing in Firefox
				browser.cookies.getAllCookieStores(function(stores) {
					stores.forEach(function(store, key) {
						browser.cookies.getAll({ storeId: store.id, name: name }, function(cookies) {
							if (!cookies || !cookies.some)
								return;
							cookies.some(function(c) {
								if (c.name === name && c.domain.split(".").slice(-2).join(".") === this.baseUrl.split(".").slice(-2).join("."))
									return resolve(c);
							}.bind(this));
						}.bind(this));
					}.bind(this));
				}.bind(this));
			}.bind(this));
		}.bind(this));
	},
}
