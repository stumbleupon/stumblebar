var config = {
//  _get: function (key) {
//		return new Promise(function(resolve, reject) {
//			if (!key in this) {
//				console.log('Missing key '+key+' in config');
//				reject(this[key]);
//			}
//		  resolve(this[key]);
//		}.bind(this));
//  }
}
config.persist = ['rpos', 'mode', 'theme'];
config.baseUrl = 'www.stumbleupon.com'
config.apiPath = '/api/v2_0'
config.accessToken = 'su_accesstoken'
config.accessTokenHeader = 'X-Su-AccessTokenKey';
config.defaultHeaders = { 
    "X-Su-ConsumerKey":    "35774027dc2f2f64a280e63eafb018505c045655",
    "X-Su-ClientId"   :    "448f3699-fbb8-a606-3f20-2d3e620c152c"    ,
};
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
  stumble: '/stumble/:mode',
  rate:    '/discovery/rating',
  unrate:  '/discovery/:urlid/rating',
  url:     '/url',
}
config.url = {
  info:    '/content/:urlid',
}
config.modes = {
	all:       { name: 'All Interests'   },
	followers: { name: 'People I Follow' },
	trending:  { name: 'Trending'        },
	photo:     { name: 'Photos'         , mode: 'interest', post: { interests: [302], keyword: 'Photos' } },
	video:     { name: 'Videos'         , post: { keyword: 'Video' } },
}
config.defaults = {
	mode: 'all',
	theme: '',
	user: 0,
	stumble: { list: [], pos: -1, mode: 'all' },
}

