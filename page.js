/**
 * Handlers for page-related and tab-related functionality
 */
function Page() {
}


/**
 * The current su toolbar state
 */
Page.state = {};

/**
 * The current tab info
 */
Page.tab = {};

/**
 * A cache of fetched SuUrls
 */
Page.urlCache = [];
Page.urlMap   = {};







/**
 * Get the last known state of the provided tab
 *
 * @param {Number} tabid Tab ID
 * @return {Object} current state of tabid
 */
Page.lastState = function(tabid) {
	return Page.state[tabid] || {};
}


/**
 * Preload helper, takes an SU url object (usually the next stumble) and preloads that page
 *
 * @param {SuUrl} url SuUrl object to attempt to preload
 */
Page.preload = function(url) {
	Page._prerender.href  = url.url;
	Page._prefetch.href   = url.url;
	Page._preload.href    = url.url;
	debug("Preload", url.url);
}


/**
 * Browser icon click handler.  Pings the current tab to see if it has rendered.
 * If it has, it toggles hidden.  If it hasn't, it attempts to stumble.
 *
 * @param {event} e window.event object
 */
Page.handleIconClick = function(e) {
	Page.ping()
		.then(function(res) {
			return ToolbarEvent.handleRequest(
					{
						action: 'toggleHidden',
						url: {},
						data: {}
					},
					{ tab: res.tab },
					function() {}
				);
		})
		.catch(function(res) {
			ToolbarEvent.stumble({}, res)
				.catch(ToolbarEvent.loginPage);
		});
}

/**
 * Pings a tabid
 *
 * @param {Number} tabid Tab ID to ping
 * @return {Promise}
 */
Page.ping = function(tabid) {
	return new Promise(function(resolve, reject) {
		chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
			if (!tabs[0])
				return;
			chrome.tabs.sendMessage(tabid || tabs[0].id, {type: "ping", info: tabs[0]}, function(response) {
				// Handle pages that we can't inject
				if (!response || response.type != 'pong')
					reject({tab: {id: tabid || tabs[0].id}, response});
				else
					resolve({tab: {id: tabid || tabs[0].id}, response});
			});
		});
	});
}



/**
 * Get the last url seen by the provided tab id
 *
 * @param {Number} tabid Tab ID
 * @return {SuUrl}
 */
Page.lastUrl = function(tabid) {
	return Page.tab[tabid] && Page.tab[tabid].url;
}

/**
 * Get the last urlid seen by the provided tab id
 *
 * @param {Number} tabid Tab ID
 * @return {SuUrl}
 */
Page.getUrlId = function(tabid) {
	return Page.tab[tabid] && Page.tab[tabid].url && Page.tab[tabid].url.urlid;
}


/**
 * Get the last urlid seen by the provided tab id
 *
 * @param {Number} tabid Tab ID
 * @return {SuUrl}
 */
Page.getUrl = function(tabid) {
	var url = Page.tab[tabid] && Page.tab[tabid].url    && Page.tab[tabid].url.finalUrl // SuUrl
		   || Page.tab[tabid] && Page.tab[tabid].info   && Page.tab[tabid].info.url     // Browser's tab
		   || Page.tab[tabid] && Page.tab[tabid].status && Page.tab[tabid].status.url   // What we noted
	;

	if (!url) {
		return new Promise(function(resolve, reject) {
			chrome.tabs.get(tabid, function(tab) {
				if (!tab || !tab.id || !tab.url)
					return reject(new ToolbarError('Page', 'nourl', Page.tab[tabid]));
				resolve(tab.url);
			});
		});
	}

	return Promise.resolve(url);

//		chrome.tabs.get(tabid, function(tab) {
//			resolve(tab.url);
//		});
}


/**
 * Get a SuUrl from the urlCache
 *
 * @param {String} href The url to fetch from the cache
 * @return {Object}
 */
Page.getUrlByHref = function(href) {
	return Page.urlMap[href];
}

/**
 * Get a SuUrl by urlid from the urlCache.  Note that this may return an
 * url that was generated in another mode and has that mode's metadata.
 *
 * @param {String} urlid The public url id
 * @param {String} mode The mode
 * @return {SuUrl}
 */
Page.getUrlByUrlid = function(urlid, mode) {
	return Page.urlMap[mode + ':' + urlid] || Page.urlMap[urlid];
}

/**
 * Cleans up url cache by trimming the cache down to 1000 urls
 */
Page.cleanupUrlCache = function() {
	if (Page.urlCache.length >= 1e3) {
		var errantUrl = Page.urlCache.splice(0, 1)[0];
		Page.removeUrlFromUrlCache(errantUrl);
	}
}

/**
 * Removes a SuUrl from the url cache
 */
Page.removeUrlFromUrlCache = function(url) {
	if (!url)
		return;
	if (url.urlid && url.mode)
		delete Page.urlMap[url.urlid];
	if (url.urlid)
		delete Page.urlMap[url.mode + ':' + url.urlid];
	if (url.url)
		delete Page.urlMap[url.url];
	if (url.finalUrl)
		delete Page.urlMap[url.finalUrl];
}


/**
 * Note the current SuUrl loaded by the current tabid.  Adds url to the url cache, performs cleanup.
 *
 * @param {Number} tabid Tab ID
 * @param {SuUrl} url An SuUrl object
 * @return {SuUrl}
 */
Page.note = function(tabid, url, onlynote) {
	if (!Page.tab[tabid])
		Page.tab[tabid] = {};

	if (url.urlid && url.mode)
		Page.urlMap[url.mode + ':' + url.urlid] = url;
	if (url.urlid)
		Page.urlMap[url.urlid] = url;
	if (url.url)
		Page.urlMap[url.url] = url;
	if (url.finalUrl)
		Page.urlMap[url.finalUrl] = url;

	if (Page.urlCache.indexOf(url) == -1)
		Page.urlCache.push(url);

	Page.cleanupUrlCache();

	return onlynote ? url : Page.tab[tabid].url = url;
}

/**
 * Handle URL changes triggered by tab or stumble events
 *
 * @param {String} href The new uri
 * @param {Number} tabid Tab ID
 * @return {Promise}
 */
Page.urlChange = function(href, tabid, incog, state) {
	chrome.tabs.getZoom(tabid, function(zoom) {
		chrome.tabs.sendMessage(tabid, { zoom: zoom });
	});

	// Handle http://su/su/{urlid} urls.  Stop the request, redirect directly to page, return a promise
	webtbPath = href.match(new RegExp("https?://" + config.baseUrl + config.webtbPath));
	if (webtbPath) {
		ToolbarEvent._sanity();
		var urlid = webtbPath[config.webtbPathNames.urlid];
		if (urlid) {
			// Stop current page from loading
			chrome.tabs.executeScript(tabid, {
				code: "window.stop();",
			});
			chrome.tabs.update(tabid, { url: 'about:blank' });

			if (state == 'complete')
				return;

			// Override {urlid} if we have a returl (we're coming from a signup)
			if (Page.state[tabid] && Page.state[tabid].returl) {
				var url = Page.state[tabid].returl;
				chrome.tabs.update(tabid, { url: url });
				ToolbarEvent.unhideToolbar();
				return ToolbarEvent._buildResponse({ hidden: false });
			}

			return Promise.resolve(Page.getUrlByUrlid(urlid, config.mode) || ToolbarEvent.api.getUrlByUrlid(urlid))
				.then(function(url) {
					chrome.tabs.update(tabid, { url: url.url });
					ToolbarEvent.unhideToolbar();

					return ToolbarEvent._buildResponse({ url: url, hidden: false })
				})
				.catch(ToolbarEvent.error);
			;
		}
	}

	suPath = href.match(new RegExp("https?://" + config.baseUrl + '/logout'));
	if (suPath) {
		debug('LOGGING OUT');
		return;
	}

	// If we're hitting http://su/..., revalidate our auth
	suPath = href.match(new RegExp("https?://" + config.baseUrl + '/(.*)'));
	if (suPath && !config.authed) {
		if (suPath)
			ToolbarEvent._sanity();
		debug('SUPATH SANITY CHECK ' + href);
	}

	// If we're hitting http://su/convo/..., set the conversation id on the page state
	convoPath = href.match(new RegExp("https?://" + config.baseUrl + config.convoPath));
	if (convoPath) {
		Page.state[tabid] = { convo: convoPath[config.convoPathNames.convoid] };
		console.log('CONVO ON ' + tabid);
	}


	// Attempted to pull the current url from the page cache or SU api.  If we can,
	// report it to the toolbar in the current tab
	return Promise
		.resolve(Page.getUrlByHref(href))
		.then(function(url) {
			return url && Page.getUrlByUrlid(url.urlid, config.mode);
		})
		.then(function(url) {
			//return url || (!incog && ToolbarEvent.api.getUrlByHref(href)) || Promise.reject(new ToolbarError('Page', 'nourl-incog', Page.tab[tabid])); // No URL fetching in private mode
			return url || Promise.reject(new ToolbarError('Page', 'nourl', Page.tab[tabid])); // No URL fetching in general
		})
		.then(function(url) {
			if (!incog)
				Page.note(tabid, url, Page.tab[tabid].status.url != href);
			if (!(Page.tab[tabid] || {}).status || Page.tab[tabid].status.url == href)
				chrome.tabs.sendMessage(tabid, { url: url }, function() {});
		})
		.catch(function(error) {
			if (!(Page.tab[tabid] || {}).status || Page.tab[tabid].status.url == href)
				chrome.tabs.sendMessage(tabid, { url: { url: href } }, function() {});
		});
	;
}

/**
 * Handle tab loading and complete messages
 *
 * @param {Number} tabid Tab ID
 * @param {Object} info Tab info object
 * @param {Object} tab The new state of the tab
 */
Page.handleTabUpdate = function(tabid, info, tab) {
	console.log('update', tabid, info, tab);
	Page.ping().catch(function() {});

	if (!Page.tab[tabid])
		Page.tab[tabid] = {url: {}, status: {state: tab.incognito ? 'incog' : 'ready'}};

	if (info.status == "loading") {
		if (!tab.incognito) {
			Page.tab[tabid].status = { state: info.status, url: tab.url };
		}
		// User is changing the URL
		if (Page.tab[tabid].url && Page.tab[tabid].url.url != tab.url && !Page.tab[tabid].stumbling)
			Page.tab[tabid].url = {}
		Page.urlChange(info.url || tab.url, tabid, tab.incognito, info.status);
	}

	if (info.status == "complete") {
		if (!tab.incognito) {
			Page.tab[tabid].status = { state: info.status, url: tab.url };
			Page.tab[tabid].info = tab;
			if (Page.tab[tabid].url && !Page.tab[tabid].url.finalUrl && Page.tab[tabid].stumbling)
				Page.tab[tabid].url.finalUrl = info.url || tab.url;
			Page.tab[tabid].stumbling = false;
		}
		Page.urlChange(info.url || tab.url, tabid, tab.incognito, info.status);
	}
}

/**
 * Does nothing, but in the future can be used to unload the stumblebar
 * from contexts to save memory
 */
Page.handleTabSwitch = function(state) {
	if (config.unloadNonVisibleBars) {
		chrome.tabs.query({}, function(tabs) {
			tabs.forEach(function (tab) {
				// We have to keep tabs persistent in incognito because we don't retain state for them
				if (tab.incognito)
					return;
				if (state.tabId == tab.id)
					chrome.tabs.sendMessage(tab.id, {type: 'add'});
				else
					chrome.tabs.sendMessage(tab.id, {type: 'remove'});
			});
		});
	}
}
Page.handleWindowSwitch = function(state) {
	chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
		if (tabs && tabs[0] && tabs[0].id)
			Page.handleTabSwitch({tabId: tabs[0].id})
	})
}

/**
 * Clean up tab states and caches on tab close
 *
 * @param {Number} tabid Tab ID
 */
Page.handleTabClose = function(tabid) {
	if (Page.state[tabid])
		delete Page.state[tabid];
	if (Page.tab[tabid]) {
		Page.removeUrlFromUrlCache(Page.lastUrl(tabid));
		delete Page.tab[tabid];
	}
}

Page.handleZoom = function(zoom) {
	chrome.tabs.sendMessage(zoom.tabId, { zoom: zoom.newZoomFactor });
}

Page.handleFreshen = function() {
	chrome.tabs.query({}, function(tabs) {
		tabs.forEach(function(tab) {
			try {
				chrome.tabs.executeScript(tab.id, {code: "document.getElementById('discoverbar') && document.documentElement.removeChild(document.getElementById('discoverbar'), document.documentElement)"});
			} catch(e) {}
		});
	});
}

/**
 * Initialize page handlers
 */
Page.init = function() {
	// listen to tab URL changes
	chrome.tabs.onUpdated.addListener(Page.handleTabUpdate);

	// listen to tab switching
	chrome.tabs.onActivated.addListener(Page.handleTabSwitch);
	chrome.windows.onFocusChanged.addListener(Page.handleWindowSwitch);

	chrome.tabs.onRemoved.addListener(Page.handleTabClose);

	chrome.tabs.onZoomChange.addListener(Page.handleZoom);

	chrome.browserAction.onClicked.addListener(Page.handleIconClick);

	chrome.runtime.onInstalled.addListener(Page.handleFreshen);


	Page._prerender  = document.createElement('link');
	Page._prefetch   = document.createElement('link');
	Page._preload    = document.createElement('link');

	Page._prerender.rel  = 'prerender';
	Page._prefetch.rel   = 'prefetch';
	Page._preload.rel    = 'preload';

	document.body.appendChild(Page._prerender);
	document.body.appendChild(Page._prefetch);
	document.body.appendChild(Page._preload);
}

Page.init();
