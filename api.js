function Api(config) {
	this.baseUrl = config.baseUrl;
	this.apiPath = config.apiPath;
	this.defaultHeaders = config.defaultHeaders;
	this.post = config.post;
	this.accessToken = null;
	this.requests = [];
}

Api.serializePostData = function(obj, prefix) {
	var str = [];
	for(var p in obj) {
		if (obj.hasOwnProperty(p)) {
			var k = prefix ? encodeURIComponent(prefix) + "[" + encodeURIComponent(p) + "]" : p, v = obj[p];
			str.push((v && typeof v == "object") ?
					Api.serializePostData(v, p) :
					k + "=" + encodeURIComponent(v));
		}
	}
	return str.join("&");
};

Api.prototype = {
	unjson: function(response) {
		return JSON.parse(response);
	},

	raw: function(path, data, opts) {
		return new Promise(function(resolve, reject) {
			opts = opts || {};
			httpRequest = new XMLHttpRequest();

			httpRequest.onload = function() {
				if (this.status >= 200 && this.status <= 299)
					resolve(this.response);
				else
					reject(this.statusText);
			},

			httpRequest.onerror = function() {
				console.log("ERR");
				reject(this.statusText);
			},

			opts.method  = opts.method  || (((typeof data == 'undefined') || data === null) ? 'GET' : 'POST');
			opts.proto   = opts.proto   || 'https';
			opts.baseUrl = opts.baseUrl || this.baseUrl;

			opts.url     = opts.url     || opts.proto + '://' + opts.baseUrl + path;

			data = data || null;
			if (typeof data == 'object')
				data = Api.serializePostData(data);
			if (data && opts.method == 'GET')
				opts.url += ((opts.url.indexOf('?') >= 0) ? '&' : '?') + data;

			httpRequest.open(opts.method, opts.url, true);

			this.defaultHeaders.forEach(function (val, key) {
				httpRequest.setRequestHeader(key, val);
			});

			if (data && opts.method != 'GET')
				httpRequest.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
			if (!opts.noauth && this.accessToken)
				httpRequest.setRequestHeader('X-Su-AccessTokenKey', this.accessToken);

			try {
				var retval = httpRequest.send(data);
			} catch (e) {
				reject(data);
			}
		}.bind(this));
	},

	token: function(token) {
		this.accessToken = token;
		return this;
	},

	get: function(path, data) {
		return this.req(path, data, { method: 'GET' });
	},

	req: function(path, data, opts) {
		return this.raw(this.apiPath + path, data, opts)
			.then(function(response) {
				return JSON.parse(response);
			}.bind(this));
	},

	prepPost: function(type, remap) {
		var post = {};
		for (var key in this.post[type]) {
			post[key] = this.post[type][key];
		}
		for (var key in remap) {
			post[key] = remap[key];
		}
		return post;
	},

	once: function(path, data, opts) {
		if (!this.requests[path]) {
			this.requests[path] = this.req(path, data, opts)
				.then(function(results) {
					if (this.requests[path])
						delete this.requests[path];
					return results;
				}.bind(this));
		}
		return this.requests[path];
	},

}
