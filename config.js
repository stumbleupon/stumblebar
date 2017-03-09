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
config.persist = ['rpos', 'mode', 'theme', 'hidden', 'authed'];
config.baseUrl = 'www.stumbleupon.com'
config.baseProto = 'https'
config.apiPath = '/api/v2_0'

config.webtbPath = '/su/([^/]+)(/([^/]+)/(.*))?';
config.webtbPathNames = { path: 0, urlid: 1, socialid: 3, vanityurl: 4 }
config.convoPath = '/convo/([^/]+)(/([^/]+))?';
config.convoPathNames = { path: 0, convoid: 1, stateId: 3 }

config.accessToken = 'su_accesstoken'
config.accessTokenHeader = 'X-Su-AccessTokenKey';
config.defaultHeaders = { 
    "X-Su-ConsumerKey":    "35774027dc2f2f64a280e63eafb018505c045655",
    "X-Su-ClientId"   :    "448f3699-fbb8-a606-3f20-2d3e620c152c"    ,
    "X-Su-Version"    :    "Discoverbar 1.0"                         ,
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
config.miniModeTimeout = 500;
config.suPages = {
	profile:   ':baseProto://:baseUrl/stumbler',
	settings:  ':baseProto://:baseUrl/settings',
	sponsored: ':baseProto://:baseUrl/sponsored-page',
	signout:   ':baseProto://:baseUrl/logout',
	signin:    ':baseProto://:baseUrl/login',
}
config.endpoint = {
  ping:        '/p',
  user:        '/user/?version=2',
  stumble:     '/stumble/:mode',
  rate:        '/discovery/rating',
  unrate:      '/discovery/:urlid/rating',
  url:         '/url',
  activities:  '/activities',
  contacts:    '/connection/:userid/mutual',
  markactivity:'/activities/:id/:action',
}
config.url = {
  info:    '/content/:urlid',
}
config.modes = {
	all:       { name: 'All Interests'   },
	following: { name: 'People I Follow', post: { keyword: 'Following' } },
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

config.conversationsAPI = {
	baseUrl:  'svc.stumbleupon.com',
	baseProto:'http',
	apiPath:  '/convo',
	endpoint: {
	  auth:         '/auth/token',
	  participants: '/participants',
	  messages:     '/conversations/:id',
	  comment:      '/conversations/:id/comments',
	  share:        '/conversations',
	},
	defaultHeaders: config.defaultHeaders,
	defaults: {}
}


