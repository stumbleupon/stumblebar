function Page() {
}

Page.tab = [];

Page.handleEvent = function(e) {
	console.log('event', e);
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

Page.urlCache = [];

Page.note = function(tabid, url) {
	if (!Page.tab[tabid])
		Page.tab[tabid] = {};

	if (url.url) {
		Page.urlCache[url.url] = url;
		if (url.finalUrl)
			Page.urlCache[url.finalUrl] = url;
		Page.urlCache.push(url);
		if (Page.urlCache.length >= 1e3) {
			var oldUrl = Page.urlCache.splice(0, 1);
			delete Page.urlCache[oldUrl.url]
			if (url.finalUrl)
				delete Page.urlCache[oldUrl.finalUrl]
		}
	}

	return Page.tab[tabid].url = url;
}

Page.handleTabUpdate = function(tabid, info, tab) {
	console.log('update', tabid, info, tab);

	if (!Page.tab[tabid])
		Page.tab[tabid] = {};

	if (info.status == "loading") {
		// User is changing the URL
		if (Page.tab[tabid].url && Page.tab[tabid].url.url != tab.url)
			Page.tab[tabid].url = {}
		ToolbarEvent.urlChange(tab.url, tabid);
	}

	if (info.status == "complete") {
		Page.tab[tabid].info = tab;
		if (Page.tab[tabid].url && !Page.tab[tabid].url.finalUrl)
			Page.tab[tabid].url.finalUrl = info.url;
	}
}

Page.handleTabSwitch = function(e) {
	//console.log('switch', e);
}
