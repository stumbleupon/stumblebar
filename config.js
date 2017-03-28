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
config.persist = ['rpos', 'mode', 'modeinfo', 'theme', 'hidden', 'authed', 'interests', 'stayExpanded'];

config.baseUrl   = 'www.stumbleupon.com';
config.baseProto = 'https';

config.webtbPath = '/su/([^/]+)(/([^/]+)/(.*))?';
config.webtbPathNames = { path: 0, urlid: 1, socialid: 3, vanityurl: 4 }
config.convoPath = '/convo/([^/]+)(/([^/]+))?';
config.convoPathNames = { path: 0, convoid: 1, stateId: 3 }

config.defaults = {
	mode: 'all',
	theme: '',
	user: 0,
	stumble: { list: [], pos: -1, mode: 'all' },
	interests: [],
};

config.interests = [];
config.unloadNonVisibleBars = false;

config.miniModeTimeout = 500;
config.suPages = {
	profile:   ':baseProto://:baseUrl/stumbler',
	settings:  ':baseProto://:baseUrl/settings',
	sponsored: ':baseProto://:baseUrl/sponsored-page',
	signout:   ':baseProto://:baseUrl/logout',
	signin:    ':baseProto://:baseUrl/login',
	help:      'http://help.stumbleupon.com/',
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
	domain:    { name: 'Domain'         , post: { domains: [ 'wikiepdia.com' ] } },
	interest:  { name: 'Interest'       , post: { } },
	keyword:   { name: 'Tag'            , post: { keyword: 'Photos' } },
}


config.accessToken = 'su_accesstoken'
config.accessTokenHeader = 'X-Su-AccessTokenKey';
config.defaultHeaders = { 
    "X-Su-ConsumerKey":    "35774027dc2f2f64a280e63eafb018505c045655",
    "X-Su-ClientId"   :    "448f3699-fbb8-a606-3f20-2d3e620c152c"    ,
    "X-Su-Version"    :    "Unibar " + chrome.runtime.getManifest().version,
};

config.api = {}
config.api.conversations = {
	baseUrl:  'svc.stumbleupon.com',
	baseProto:'https',
	apiPath:  '/convo',
	endpoint: {
	  auth:         '/auth/token',
	  participants: '/participants',
	  messages:     '/conversations/:id',
	  comment:      '/conversations/:id/comments',
	  share:        '/conversations',
	  addRecipient: '/conversations/:id/participants',
	},
	defaultHeaders: config.defaultHeaders,
	defaults: {},
	accessToken: config.accessToken,
	accessTokenHeader: config.accessTokenHeader,
}
config.api.stumbleupon = {
	baseUrl:  'www.stumbleupon.com',
	baseProto:'https',
	apiPath:  '/api/v2_0',
	endpoint: {
		ping:        '/p',
		user:        '/user/?version=2',
		stumble:     '/stumble/:mode',
		rate:        '/discovery/rating',
		unrate:      '/discovery/:urlid/rating',
		url:         '/url',
		activities:  '/activities',
		contacts:    '/connection/:userid/mutual',
		markactivity:'/activities/:id/:action',
		submit:      '/submit',
		classify:    '/classification/:urlid/doClassification',
		unread:      '/activities/snapshot',
		lists:       '/user/:userid/lists',
		addtolist:   '/list/:listid/items',
		blocksite:   '/domain/:urlid/block',
		interests:   '/user/:userid/interests',
		report:      '/report/:report',
	},
	defaultHeaders: config.defaultHeaders,
	defaults: config.defaults,
	post: {
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
	},
	maxRetries: 3,
	refillPos: 3,
	conversationsAPI: config.api.conversations,
	accessToken: config.accessToken,
	accessTokenHeader: config.accessTokenHeader,
}


