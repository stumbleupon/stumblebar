function ApiRequest(opts) {
	this.using(opts);
}


/**
 * Serialize a set of key/value pairs into a POST data string
 *
 * @param {object} obj Key/value pairs
 * @param {string} prefix String to prefix parameters with
 * @return {string}
 */
ApiRequest.serializePostData = function(obj, prefix) {
	var str = [];
	for(var p in obj) {
		if (obj.hasOwnProperty(p)) {
			var k = prefix ? encodeURIComponent(prefix) + "[" + encodeURIComponent(p) + "]" : p, v = obj[p];
			str.push((v && typeof v == "object") ?
					ApiRequest.serializePostData(v, p) :
					k + "=" + encodeURIComponent(v));
		}
	}
	return str.join("&");
};



ApiRequest.prototype = {
    /**
     * Add query parameters to url
     *
     * @param {string} qs Query string to append to URL
     */
	addQueryParams: function(qs) {
		this.qs += (this.qs ? '&' : '') + qs;
	},

    /**
     * Takes an options object and updates the current request
     *
     * @param {object} opts Options to apply to request
     * @return this
     */
	using: function(opts) {
		opts = opts || {};

		this.headers = Object.assign({}, this.headers, opts.headers);

		this.method  = opts.method  || this.method  || 'GET';
		this.proto   = opts.proto   || this.proto   || 'https';
		this.baseUrl = opts.baseUrl || this.baseUrl || '';
		this.url     = opts.url     || this.url     || '';
		this.path    = opts.path    || this.path    || '';

		return this;
	},

    /**
     * Builds an URL based off of the options provided
     *
     * @return {string}
     */
	buildUrl: function() {
		var url = this.url || (this.proto + '://' + this.baseUrl + this.path);
		return url + (this.qs ? ('?' + this.qs) : '');
	}
}


