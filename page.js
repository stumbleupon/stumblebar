/**
 * Handlers for page-related and tab-related functionality
 */
function Page() {
}


/**
 * The current su state
 */
Page.state = [];

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
 * The current tab info
 */
Page.tab = [];

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
	return new Promise(function (resolve, reject) {
		var url = Page.tab[tabid] && Page.tab[tabid].url  && Page.tab[tabid].url.finalUrl
			   || Page.tab[tabid] && Page.tab[tabid].info && Page.tab[tabid].info.url;
		;
		if (url)
			return resolve(url);

		chrome.tabs.get(tabid, function(tab) {
			resolve(tab.url);
		});
	});
}


/**
 * A cache of fetched SuUrls
 */
Page.urlCache = [];


/**
 * Get a SuUrl from the urlCache
 *
 * @param {String} href The url to fetch from the cache
 * @return {Object}
 */
Page.getUrlByHref = function(href) {
	return Page.urlCache[href];
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
	return Page.urlCache[mode + ':' + urlid] || Page.urlCache[urlid];
}

/**
 * Cleans up url cache by trimming the cache down to 1000 urls
 */
Page.cleanupUrlCache = function() {
	while (Page.urlCache.length >= 1e3) {
		Page.removeUrlFromUrlCache(Page.urlCache.splice(0, 1));
	}
}

/**
 * Removes a SuUrl from the url cache
 */
Page.removeUrlFromUrlCache = function(url) {
	if (!url)
		return;
	delete Page.urlCache[url.urlid];
	delete Page.urlCache[url.mode + ':' + url.urlid];
	delete Page.urlCache[url.url];
	delete Page.urlCache[url.finalUrl];
}


/**
 * Note the current SuUrl loaded by the current tabid.  Adds url to the url cache, performs cleanup.
 *
 * @param {Number} tabid Tab ID
 * @param {SuUrl} url An SuUrl object
 * @return {SuUrl}
 */
Page.note = function(tabid, url) {
	if (!Page.tab[tabid])
		Page.tab[tabid] = {};

	if (url.urlid) {
		if (url.mode)
			Page.urlCache[url.mode + ':' + url.urlid] = url;
		Page.urlCache[url.urlid] = url;
		Page.urlCache.push(url);
	}

	// We need url-by-url to handle page-reloads because we don't fetch the page info again
	if (url.url) {
		Page.urlCache[url.url] = url;
		if (url.finalUrl)
			Page.urlCache[url.finalUrl] = url;
		Page.urlCache.push(url);
	}

	Page.cleanupUrlCache();

	return Page.tab[tabid].url = url;
}

/**
 * Handle URL changes triggered by tab or stumble events
 *
 * @param {String} href The new uri
 * @param {Number} tabid Tab ID
 * @return {Promise}
 */
Page.urlChange = function(href, tabid) {
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

	// If we're hitting http://su/..., revalidate our auth
	suPath = href.match(new RegExp("https?://" + config.baseUrl + '/'));
	if (suPath && !config.authed) {
		ToolbarEvent._sanity();
		debug('SUPATH SANITY CHECK');
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
			return url || ToolbarEvent.api.getUrlByHref(href);
		})
		.then(function(url) {
			Page.note(tabid, url);
			chrome.tabs.sendMessage(tabid, { url: url }, function() {});
		})
		.catch(function(error) {
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
//	console.log('update', tabid, info, tab);
	Page.ping();

	if (!Page.tab[tabid])
		Page.tab[tabid] = {};

	if (info.status == "loading") {
		// User is changing the URL
		if (Page.tab[tabid].url && Page.tab[tabid].url.url != tab.url)
			Page.tab[tabid].url = {}
		Page.urlChange(info.url || tab.url, tabid);
	}

	if (info.status == "complete") {
		Page.tab[tabid].info = tab;
		if (Page.tab[tabid].url && !Page.tab[tabid].url.finalUrl)
			Page.tab[tabid].url.finalUrl = info.url;
		Page.urlChange(info.url || tab.url, tabid);
	}
}

/**
 * Does nothing, but in the future can be used to unload the stumblebar
 * from contexts to save memory
 */
Page.handleTabSwitch = function(e) {
	//console.log('switch', e);
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

/**
 * Initialize page handlers
 */
Page.init = function() {
	// listen to tab URL changes
	chrome.tabs.onUpdated.addListener(Page.handleTabUpdate);

	// listen to tab switching
	chrome.tabs.onActivated.addListener(Page.handleTabSwitch);

	chrome.tabs.onRemoved.addListener(Page.handleTabClose);

	// update when the extension loads initially
	//updateTab();

	chrome.browserAction.onClicked.addListener(Page.handleIconClick);


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
