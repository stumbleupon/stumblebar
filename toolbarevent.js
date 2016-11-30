
ToolbarEvent = {};
ToolbarEvent.api = new StumbleUponApi(config);

ToolbarEvent.handleRequest = function(request, sender, sendResponse) {
	console.log("ToolbarEvent.handleRequest", request);
	ToolbarEvent[request.action](request, sender)
		.then(function(response) {
			console.log("ToolbarEvent.sendResponse", response);
			sendResponse(response);
		});
	return true;
}

ToolbarEvent.unrate = function(request, sender) {
	ToolbarEvent.api
		.unrate(request.url.urlid)
		.catch(ToolbarEvent.error);
	request.url.userRating = { type: 0, subtype: 0 };
	return Promise.resolve(request);
}

ToolbarEvent.dislike = function(request, sender) {
	ToolbarEvent.api
		.dislike(PageEvent.url.urlid || request.url.urlid)
		.catch(ToolbarEvent.error);
	request.url.userRating = { type: -1, subtype: 0 };
	return Promise.resolve(request);
}

ToolbarEvent.sanity = function() {
	return ToolbarEvent.api.cache.get('user')
		.then(function(user) {
			if (!user.userid)
				return ToolbarEvent.ping();
			return user;
		})
}

ToolbarEvent.discover = function(request, sender) {
	return Page.getUrl(sender.tab.id)
	.then(function(url) {
		return ToolbarEvent.api.discover(url);
	})
	.then(function(url) { 
		Page.note(sender.tab.id, url); 
		return url;
	});
}

ToolbarEvent.like = function(request, sender) {
	ToolbarEvent
		.sanity()
		.then(function() { return Page.getUrlId(sender.tab.id) })
		.then(function(urlid) { 
			return urlid || ToolbarEvent.discover(request, sender)
				.then(function(url) { return url.urlid; });
		})
		.then(function(urlid) { 
			return ToolbarEvent.api.like(urlid);
		})
		.catch(ToolbarEvent.error);

	request.url.userRating = { type: 1, subtype: 0 };
	return Promise.resolve(request);
}

ToolbarEvent.stumble = function(request, sender) {
	return ToolbarEvent.api
		.nextUrl()
		.then(function(url) {
			ToolbarEvent.api
				.nextUrl(true)
				.then(ToolbarEvent.preload);
			Page.note(sender.tab.id, url);
			ToolbarEvent.api.reportStumble([url.urlid]);
			request.url = url;
			chrome.tabs.update(sender.tab.id, { "url": url.url });
			return request;
		})
		.catch(ToolbarEvent.error);
}

ToolbarEvent.error = function(e) {
	console.log(e)
	//ToolbarEvent.loginPage();
}

ToolbarEvent.loginPage = function() {
	ToolbarEvent.api.flush();
	chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
		chrome.tabs.update(tabs[0].id, {
			"url": 'https://' + config.baseUrl + '/login'
		});
	});
}
ToolbarEvent.needsLogin = function() {
	debug('Needs login', arguments);
}
ToolbarEvent.ping = function() {
	return ToolbarEvent.api
		.ping()
		.then(ToolbarEvent.api.getUser.bind(ToolbarEvent.api))
		.then(function(user) {
			debug('Login success for user', user.username);
			ToolbarEvent.api.nextUrl(true)
				.then(ToolbarEvent.preload)
				.catch(function(e) {warning('Expected to preload next url', e);});
		})
		.catch(ToolbarEvent.needsLogin);
}

ToolbarEvent.preload = function(url) {
	ToolbarEvent._prerender.href  = url.url;
	ToolbarEvent._prefetch.href   = url.url;
	ToolbarEvent._preload.href    = url.url;
	debug("Preload", url.url);
}

ToolbarEvent.getUrlFromPageCache = function(url) {
	return Promise.resolve(Page.urlCache[url]);
}

ToolbarEvent.urlChange = function(href, tabid) {
	ToolbarEvent
		.getUrlFromPageCache(href)
		.then(function(url) {
			return url || ToolbarEvent.api.getUrlByUrl(href);
		})
		.then(function(url) {
			console.log(url);
			Page.note(tabid, url);
			chrome.tabs.sendMessage(tabid, { url: url }, function() {});
			if (url.urlid)
				ToolbarEvent.api.reportStumble([url.urlid]);
		})
		.catch(function(error) {
			Page.note(tabid, { url: href });
			chrome.tabs.sendMessage(tabid, { url: { url: href } }, function() {});
		});
	;
}

ToolbarEvent.init = function() {
	ToolbarEvent.ping();

	ToolbarEvent._prerender  = document.createElement('link');
	ToolbarEvent._prefetch   = document.createElement('link');
	ToolbarEvent._preload    = document.createElement('link');

	ToolbarEvent._prerender.rel  = 'prerender';
	ToolbarEvent._prefetch.rel   = 'prefetch';
	ToolbarEvent._preload.rel    = 'preload';

	document.body.appendChild(ToolbarEvent._prerender);
	document.body.appendChild(ToolbarEvent._prefetch);
	document.body.appendChild(ToolbarEvent._preload);

	chrome.runtime.onMessage.addListener(ToolbarEvent.handleRequest);
}


ToolbarEvent.init();
ToolbarEvent.api.flush();

