function Page() {
}

Page.tab = [];
Page.state = [];

Page.handleEvent = function(e) {
	console.log('event', e);
}

Page.handleIconClick = function(e) {
	//chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
	//	chrome.tabs.sendMessage(tabs[0].id, , function() {});
	//});
	console.log(e);
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

Page.ping = function(tabid) {
	return new Promise(function(resolve, reject) {
		chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
			chrome.tabs.sendMessage(tabid || tabs[0].id, {type: "ping"}, function(response) {
				console.log(response);
				// Handle pages that we can't inject
				if (!response || response.type != 'pong')
					reject({tab: {id: tabid || tabs[0].id}, response});
				else
					resolve({tab: {id: tabid || tabs[0].id}, response});
			});
		});
	});
}

Page.lastState = function(tabid) {
	return Page.state[tabid] || {};
}
Page.lastUrl = function(tabid) {
	return Page.tab[tabid] && Page.tab[tabid].url;
}
Page.getUrlId = function(tabid) {
	return Page.tab[tabid] && Page.tab[tabid].url && Page.tab[tabid].url.urlid;
}
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
Page.getUrlByHref = function(href) {
	return Page.urlCache[href];
}
Page.getUrlByUrlid = function(urlid, mode) {
	return Page.urlCache[mode + ':' + urlid] || Page.urlCache[urlid];
}

Page.urlCache = [];

Page.dirty = function() {
	Page.urlCache = [];
}

Page.cleanupUrlCache = function() {
	if (Page.urlCache.length >= 1e3) {
		var oldUrl = Page.urlCache.splice(0, 1);
		delete Page.urlCache[oldUrl.urlid];
		delete Page.urlCache[oldUrl.mode + ':' + oldUrl.urlid];
		delete Page.urlCache[oldUrl.url];
		delete Page.urlCache[oldUrl.finalUrl];
	}
}

Page.note = function(tabid, url, mode) {
	if (!Page.tab[tabid])
		Page.tab[tabid] = {};

	if (url.urlid) {
		if (mode)
		Page.urlCache[mode + ':' + url.urlid] = url;
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

Page.urlChange = function(href, tabid) {
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
					ToolbarEvent.unhide();

					return ToolbarEvent._buildResponse({ url: url, hidden: false })
				})
				.catch(ToolbarEvent.error);
			;
		}
	}

	suPath = href.match(new RegExp("https?://" + config.baseUrl + '/'));
	if (suPath && !config.authed) {
		ToolbarEvent._sanity();
		debug('SUPATH SANITY CHECK');
	}

	convoPath = href.match(new RegExp("https?://" + config.baseUrl + config.convoPath));
	if (convoPath) {
		Page.state[tabid] = { convo: convoPath[config.convoPathNames.convoid] };
		console.log('CONVO ON ' + tabid);
	}

	return Promise
		.resolve(Page.getUrlByHref(href))
		.then(function(url) {
			return url && Page.getUrlByUrlid(url.urlid, config.mode);
		})
		.then(function(url) {
			return url || ToolbarEvent.api.getUrlByHref(href);
		})
		.then(function(url) {
			//console.log(url);
			Page.note(tabid, url);
			chrome.tabs.sendMessage(tabid, { url: url }, function() {});
			//debug('Notify Url Change', tabid, url);
			//if (url.urlid)
			//	ToolbarEvent.api.reportStumble([url.urlid]);
		})
		.catch(function(error) {
			//Page.note(tabid, { url: href });
			chrome.tabs.sendMessage(tabid, { url: { url: href } }, function() {});
		});
	;
}

Page.handleTabUpdate = function(tabid, info, tab) {
//	console.log('update', tabid, info, tab);

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

Page.handleTabSwitch = function(e) {
	//console.log('switch', e);
}

Page.handleTabClose = function(tabid) {
	if (Page.state[tabid])
		delete Page.state[tabid];
	if (Page.tab[tabid])
		delete Page.tab[tabid];
}

Page.init = function() {
	// listen to tab URL changes
	chrome.tabs.onUpdated.addListener(Page.handleTabUpdate);

	// listen to tab switching
	chrome.tabs.onActivated.addListener(Page.handleTabSwitch);

	chrome.tabs.onRemoved.addListener(Page.handleTabClose);

	// update when the extension loads initially
	//updateTab();

	chrome.browserAction.onClicked.addListener(Page.handleIconClick);
}

Page.init();
