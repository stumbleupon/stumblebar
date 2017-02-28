
ToolbarEvent = {};
ToolbarEvent.api = new StumbleUponApi(config);

ToolbarEvent.handleRequest = function(request, sender, sendResponse) {
	console.log("ToolbarEvent.handleRequest", request);
	if (!ToolbarEvent[request.action])
		return false;
	ToolbarEvent[request.action](request, sender)
		.then(function(response) {
			console.log("ToolbarEvent.sendResponse", response);
			sendResponse(response);
			if (response.all) {
//				chrome.runtime.sendMessage(chrome.runtime.id, response);
				chrome.tabs.query({}, function(tabs) {
					tabs.forEach(function (tab) {
						chrome.tabs.sendMessage(tab.id, response);
					});
				});
			}
		});
	return true;
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

ToolbarEvent.mode = function(request, sender) {
	config.mode = request.data.value || config.defaults.mode;
	var response = { all: true, config: { mode: config.mode, modes: config.modes } };
	ToolbarEvent.stumble(request, sender);
	return Promise.resolve(response);
}

ToolbarEvent.theme = function(request, sender) {
	config.theme = request.data.value;
	var response = { all: true, config: { theme: config.theme } };
	return Promise.resolve(response);
}

ToolbarEvent.toggleHidden = function(request, sender) {
	config.hidden = !config.hidden;
	var response = { all: true, config: { hidden: config.hidden } };
	return Promise.resolve(response);
}

ToolbarEvent.unhide = function(request, sender) {
	config.hidden = false;
	var response = { all: true, config: { hidden: config.hidden } };
	return Promise.resolve(response);
}

ToolbarEvent.hide = function(request, sender) {
	config.hidden = true;
	var response = { all: true, config: { hidden: config.hidden } };
	return Promise.resolve(response);
}

ToolbarEvent.repos = function(request, sender) {
	config.rpos = request.data.rpos;
	var response = { all: true, config: { rpos: config.rpos } };
	return Promise.resolve(response);
}

ToolbarEvent.dislike = function(request, sender) {
	if ((request.url && request.url.userRating && request.url.userRating.type) == -1)
		return ToolbarEvent.unrate(request, sender);

	ToolbarEvent
		.sanity()
		.then(function() { return Page.getUrlId(sender.tab.id) })
		.then(function(urlid) { 
			if (!urlid) {
				debug("Attempt to dislike url that doesn't exist", request);
				return Promise.resolve(request);
			}
			return ToolbarEvent.api.dislike(urlid)
				.then(function(response) {
					return Page.note(sender.tab.id, response.url);
				});
		})
		.catch(ToolbarEvent.error);

	request.url.userRating = { type: -1, subtype: 0 };
	return Promise.resolve(request);
}

ToolbarEvent.info = function(request, sender) {
	if (Page.getUrlId(sender.tab.id))
		chrome.tabs.create({ url: 'http://' + config.baseUrl + config.url.info.form({ urlid: Page.getUrlId(sender.tab.id) }) });
	Promise.resolve(request);
}

ToolbarEvent.unrate = function(request, sender) {
	ToolbarEvent
		.sanity()
		.then(function() { return Page.getUrlId(sender.tab.id) })
		.then(function(urlid) { 
			if (!urlid) {
				debug("Attempt to unrate url that doesn't exist", request);
				return Promise.resolve(request);
			}
			return ToolbarEvent.api.unrate(urlid)
				.then(function(response) {
					return Page.note(sender.tab.id, response.url);
				});
		})
		.catch(ToolbarEvent.error);

	request.url.userRating = { type: 0, subtype: 0 };
	return Promise.resolve(request);
}


ToolbarEvent.like = function(request, sender) {
	if ((request.url && request.url.userRating && request.url.userRating.type) == 1)
		return ToolbarEvent.unrate(request, sender);

	ToolbarEvent
		.sanity()
		.then(function() { return Page.getUrlId(sender.tab.id) })
		.then(function(urlid) { 
			return urlid || ToolbarEvent.discover(request, sender)
				.then(function(url) { return url.urlid; });
		})
		.then(function(urlid) { 
			return ToolbarEvent.api.like(urlid)
				.then(function(response) {
					return Page.note(sender.tab.id, response.url);
				});
		})
		.catch(ToolbarEvent.error);

	request.url.userRating = { type: 1, subtype: 0 };
	return Promise.resolve(request);
}

ToolbarEvent.stumble = function(request, sender) {
	return ToolbarEvent.api
		._mode(config.mode || config.defaults.mode)
		.nextUrl()
		.then(function(url) {
			ToolbarEvent.api
				.nextUrl(true)
				.then(ToolbarEvent.preload);
			Page.note(sender.tab.id, url);
			ToolbarEvent.api.reportStumble([url.urlid]);
			request.url = url;
			console.log(url);
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
	ToolbarEvent.api._flush();
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

ToolbarEvent.urlChange = function(request, sender) {
	chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
		var url = (request && request.url && request.url.url) || (tabs[0] && tabs[0].url);
		if (url)
			Page.urlChange(url, tabs[0].id);
	});
	return Promise.resolve(request);
}

ToolbarEvent.init = function(request, sender) {
	request.config = config;
	return Promise.resolve(request);
}

ToolbarEvent._init = function() {
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


ToolbarEvent._init();
ToolbarEvent.api._flush();

