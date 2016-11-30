var config = {
  _get: function (key) {
		return new Promise(function(resolve, reject) {
			if (!key in this) {
				console.log('Missing key '+key+' in config');
				reject(this[key]);
			}
		  resolve(this[key]);
		}.bind(this));
  }
}
config.baseUrl = 'www.stumbleupon.com'
config.apiPath = '/api/v2_0'
config.accessToken = 'su_accesstoken'
config.defaultHeaders = new Map ([
    ["X-Su-ConsumerKey",    "35774027dc2f2f64a280e63eafb018505c045655"],
    ["X-Su-ClientId",       "448f3699-fbb8-a606-3f20-2d3e620c152c"    ],
])
config.post = {
	stumble: {
		guesses: 10,
		prefill_ad_hole: true,
		userid: 0,
		local_buffer_item_count: 0,
		guess_only: 1
	},
	seen: {
		guesses: 0,
		prefill_ad_hole: true,
		userid: 0,
		local_buffer_item_count: 0,
		guess_only: 1,
		guess_urlids: []
	},
}
config.maxRetries = 3;
config.refillPos = 3;
config.endpoint = {
  ping:    '/p',
  user:    '/user/?version=2',
  stumble: '/stumble/',
  rate:    '/discovery/rating',
  unrate:  '/discovery/:urlid/rating',
  url:     '/url',
}
String.prototype.form = function(map) {
	var newstr = this;
	this.match(/:[^a-zA-Z0-9]+/).forEach(function(key) {
		newstr = newstr.replace(key, map[key.slice(1)]);
	});
	return newstr;
}
config.defaults = {
	mode: 'all',
	user: 0,
	stumbles: [],
	stumblePos: -1,
}

