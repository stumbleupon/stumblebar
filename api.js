function Api(config) {
	this.requests = {};
	this.opts = { baseUrl: config.baseUrl, proto: config.baseProto, apiPrefix: config.apiPath, headers: config.defaultHeaders, post: config.post };
}

Api.prototype = {
	/**
	 * Make an API request without path api path prefixing
	 *
	 * @param {string} path Full path for request
	 * @param {object} data Key-value pairs to send to the server
	 * @param {ApiRequestOptions} opts API request options
	 * @return {Promise} Promise response for get
	 */
	raw: function(path, data, opts) {
		return new Promise(function(resolve, reject) {
			var req = new ApiRequest({path: path})
					   .using({method: (((typeof data == 'undefined') || data === null) ? 'GET' : 'POST')})
					   .using(this.opts)
					   .using(opts);

			var httpRequest = new XMLHttpRequest();

			httpRequest.addEventListener("load", function() {
				if (this.status >= 200 && this.status <= 299)
					resolve(this.response);
				else
					reject(this.statusText);
			});

			httpRequest.addEventListener("error", function() {
				console.log("ERR");
				reject(this.statusText);
			});

			httpRequest.addEventListener("abort", function() {
				console.log("ABT");
				reject(this.statusText);
			});

			data = data || null;
			if (typeof data == 'object')
				data = ApiRequest.serializePostData(data);
			if (data && req.method == 'GET')
				req.addQueryParams(data);

			httpRequest.open(req.method, req.buildUrl(), true);

			for (var name in req.headers)
				httpRequest.setRequestHeader(name, req.headers[name]);

			if (data && req.method != 'GET')
				httpRequest.setRequestHeader("Content-type", "application/x-www-form-urlencoded");

			try {
				var retval = httpRequest.send(data);
			} catch (e) {
				reject(data);
			}
		}.bind(this));
	},

	/**
	 * Add default headers for API rquests
	 *
	 * @param {object} headers Key-value pairs of headers
	 * @return this
	 */
	addHeaders: function(headers) {
		this.opts.headers = Object.assign(this.opts.headers, headers);
		return this
	},

	getHeaders: function() {
		return this.opts.headers;
	},

	/**
	 * Make an API GET request
	 *
	 * @param {string} path Relative path for request
	 * @param {object} data Key-value pairs for the query string
	 * @return {Promise} Promise response for get
	 */
	get: function(path, data) {
		return this.req(path, data, { method: 'GET' });
	},

	/**
	 * Make an API request
	 *
	 * @param {string} path Relative path for request
	 * @param {object} data Key-value pairs to send to the server
	 * @param {ApiRequestOptions} opts API request options
	 * @return {Promise} Promise response for get
	 */
	req: function(path, data, opts) {
		return this.raw(((opts || {}).apiPrefix || this.opts.apiPrefix) + path, data, opts)
			.then(function(response) {
				return JSON.parse(response);
			}.bind(this));
	},

	/**
	 * Make a single API request to an endpoint.  If there is currently a request inflight, return that request
	 *
	 * @param {string} path Relative path for request
	 * @param {object} data Key-value pairs to send to the server
	 * @param {ApiRequestOptions} opts API request options
	 * @return {Promise} Promise response for get
	 */
	once: function(path, data, opts) {
		if (this.requests[path]) {
			console.log('INFLIGHT', path);
			return Promise.reject({});
		}
		if (!this.requests[path]) {
			this.requests[path] = this.req(path, data, opts)
				.then(function(results) {
					if (this.requests[path])
						delete this.requests[path];
					return results;
				}.bind(this), function(results) {
					if (this.requests[path])
						delete this.requests[path];
					return results;
				}.bind(this));
		}
		return this.requests[path];
	}

}
