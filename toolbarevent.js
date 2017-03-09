/**
 * @class A class used to manage messaging to and from the background
 */
ToolbarEvent = {};
ToolbarEvent.api = new StumbleUponApi(config);

/**
 * @typedef {Object} chrome.runtime.MessageSender
 * @property {tabs.Tab} tab Optional tabs.Tab. The tabs.Tab which opened the connection. This property will only be present when the connection was opened from a tab (including content scripts).
 * @property {Number} frameId Optional integer. The frame that opened the connection. Zero for top-level frames, positive for child frames. This will only be set when tab is set.
 * @property {String} id Optional string. The ID of the extension that sent the message, if the message was sent by an extension. Note that this is the extension's internal ID, not the ID in the manifest.json applications key.
 * @property {String} url Optional string. The URL of the page or frame hosting the script that sent the message. If the sender is a script running in an extension page (such as a background page, an options page, or a browser action or page action popup), the URL will be in the form "moz-extension://<extension-internal-id>/path/to/page.html". If the sender is a background script and you haven't included a background page, it will be "moz-extension://<extension-internal-id>/_blank.html". If the sender is a script running in a web page (including content scripts as well as normal page scripts), then url will be the web page URL. If the script is running in an iframe, url will be the iframe's URL.
 * @property {String} tlsChannelId Optional string. The TLS channel ID of the page or frame that opened the connection, if requested by the extension, and if available.
 * @see {@link https://developer.mozilla.org/en-US/Add-ons/WebExtensions/API/runtime/MessageSender}
 */

/**
 * @typedef {Object} MessageRequest
 * @property {String} action -- a string that must map to a method of this class
 * @property {Object} url
 * @property {Object} data
 */

/**
 * route messages to handlers defined in this class and return the data via the provided callback
 * @param request {MessageRequest}
 * @property {chrome.runtime.MessageSender} sender -- provided by chrome
 * @property {Function} sendResponse -- callback (technically optional, but required for this application)
 * @returns {boolean}
 */
ToolbarEvent.handleRequest = function(request, sender, sendResponse) {
	console.log("ToolbarEvent.handleRequest", request);
	var action = request.action && request.action.replace(/-[a-z]/, function(x){return x[1].toUpperCase();});
	if (!action || !ToolbarEvent[action])
		return false;
	ToolbarEvent[action](request, sender)
		.then(function(response) {
			console.log("ToolbarEvent.sendResponse", request, response);
			sendResponse(response);
		});
	return true;
}

ToolbarEvent._sanity = function() {
	return ToolbarEvent.api.cache.get('user')
		.then(function(user) {
			ToolbarEvent.api.cache.mset({ authed: config.authed = !!user.userid });
			if (!user.userid)
				return ToolbarEvent.ping();
			return user;
		})
}

/**
 *
 * @param {MessageRequest} request
 * @param {chrome.runtime.MessageSender} sender
 */
ToolbarEvent.share = function handleShare(request, sender) {
	return Promise.resolve(ToolbarEvent.api.getContacts())
		.then(function(contacts) {
			return ToolbarEvent._buildResponse({ contacts:  contacts}, true);
		});
}

/**
 *
 * @param {MessageRequest} request
 * @param {chrome.runtime.MessageSender} sender
 */
ToolbarEvent.saveShare = function handleSaveShare(request, sender) {
    return Promise.resolve(ToolbarEvent.api.saveShare(request.data))
        .then(function(contacts) {
            return ToolbarEvent._buildResponse({ contacts:  contacts}, true);
        });
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
	ToolbarEvent.api.cache.mset({ mode: config.mode = request.data.value || config.defaults.mode });
	ToolbarEvent.stumble(request, sender);
	return ToolbarEvent._buildResponse({}, true);
}

ToolbarEvent.theme = function(request, sender) {
	ToolbarEvent.api.cache.mset({ theme: config.theme = request.data.value || config.defaults.theme });
	return ToolbarEvent._buildResponse({}, true);
}

ToolbarEvent.toggleHidden = function(request, sender) {
	ToolbarEvent.api.cache.mset({ hidden: config.hidden = !config.hidden });
	return ToolbarEvent._buildResponse({}, true);
}

ToolbarEvent.unhide = function(request, sender) {
	ToolbarEvent.api.cache.mset({ hidden: config.hidden = false });
	return ToolbarEvent._buildResponse({}, true);
}

ToolbarEvent.hide = function(request, sender) {
	ToolbarEvent.api.cache.mset({ hidden: config.hidden = true });
	return ToolbarEvent._buildResponse({}, true);
}

ToolbarEvent.repos = function(request, sender) {
	ToolbarEvent.api.cache.mset({ rpos: config.rpos = request.data.rpos });
	return ToolbarEvent._buildResponse({}, true);
}

ToolbarEvent._buildResponse = function(change, all) {
	var response = Object.assign({all: all}, { config: config }, change);
	if (response.all) {
//				chrome.runtime.sendMessage(chrome.runtime.id, response);
		chrome.tabs.query({}, function(tabs) {
			tabs.forEach(function (tab) {
				chrome.tabs.sendMessage(tab.id, response);
			});
		});
	}
	return Promise.resolve(response);
}

ToolbarEvent.dislike = function(request, sender) {
	if ((request.url && request.url.userRating && request.url.userRating.type) == -1)
		return ToolbarEvent.unrate(request, sender);

	ToolbarEvent
		._sanity()
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

ToolbarEvent.updateConfig = function(request, sender) {
	Object.assign(config, request.data);
	return ToolbarEvent._buildResponse({}, true);
}

ToolbarEvent.unrate = function(request, sender) {
	ToolbarEvent
		._sanity()
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
		._sanity()
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

ToolbarEvent.inbox = function(request, sender) {
	return ToolbarEvent
		.api.getConversations()
		.then(function(inbox) {
			return ToolbarEvent.api.cache.get('authed')
				.then(function(userid) {
					return ToolbarEvent._buildResponse({ inbox: inbox, me: userid });
				});
		})
		.catch(ToolbarEvent.error);
}

ToolbarEvent.stumble = function(request, sender) {
	return ToolbarEvent.api
		._mode(config.mode || config.defaults.mode)
		.nextUrl()
		.then(function(url) {
			ToolbarEvent.api
				.nextUrl(1)
				.then(ToolbarEvent.preload);
			Page.note(sender.tab.id, url);
			Page.state[sender.tab.id] = { stumble: url }
			ToolbarEvent.api.reportStumble([url.urlid]);
			request.url = url;
			console.log(url);
			chrome.tabs.update(sender.tab.id, { url: url.url });
			// Don't send URL now, wait for init call
			return ToolbarEvent._buildResponse({});
		})
		.catch(ToolbarEvent.error);
}

ToolbarEvent.error = function(e) {
	console.log(e)
	//ToolbarEvent.loginPage();
	return Promise.reject(e);
}

ToolbarEvent.replyConvo = function(request, sender) {
	var convo = ToolbarEvent.api.getConversation(request.data.id);
	// Noop if comment is empty
	if (!request.data.comment || !request.data.comment.replace(/^[ ]+|[ ]+$/, ''))
		return ToolbarEvent._buildResponse({ });
	return Promise.resolve(convo.comment(request.data.comment))
		.then(function(comment) {
			return ToolbarEvent._buildResponse({ comment: comment });
		});
}

ToolbarEvent.stateChange = function(request, sender) {
	Page.state[sender.tab.id] = request.data;
}

ToolbarEvent.loadConvo = function(request, sender) {
	console.log(request);
	var convo = ToolbarEvent.api.getConversation(request.data.value)
	return Promise.resolve(convo.messages(request.data.since))
		.then(function(convo) {
			return ToolbarEvent._buildResponse({ convo: convo, position: request.data.since ? 'append' : null });
		});
}

ToolbarEvent.openConvo = function(request, sender) {
	if (request.data.urlid && request.data.id) {
		return Promise.resolve(Page.getUrlByUrlid(request.data.urlid) || ToolbarEvent.api.getUrlByUrlid(request.data.urlid))
			.then(function(url) {
				Page.state[sender.tab.id] = { convo: request.data.id };
				chrome.tabs.update(sender.tab.id, {
					"url": url.url
				});
				return ToolbarEvent._buildResponse({ });
			}).catch(function() {
				request.data.urlid = null;
				return ToolbarEvent.openConvo(request, sender);
			});
	} else if (request.data.url) {
		chrome.tabs.update(sender.tab.id, {
			"url": request.data.url
		});
	}

	return ToolbarEvent._buildResponse({});
}

ToolbarEvent.signout = function() {
	ToolbarEvent.api._flush();

	chrome.tabs.create({
		"url": config.suPages.signout.form(config),
		active: false
	}, function(tab) {
		chrome.tabs.onUpdated.addListener(function(tabId , info) {
			if (info.status == "complete" && tabId == tab.id) {
				setTimeout(function() { chrome.tabs.remove(tabId); }, 2000);
			}
		});
	});

//	var signoutFrame = document.createElement('iframe');
//	signoutFrame.addEventListener("load", function() {
//		debug('Background logout');
//		//document.body.removeChild(signoutFrame);
//	});
//	signoutFrame.setAttribute('src', config.suPages.signout.form(config));
//	console.log(config.suPages.signout.form(config));
//	document.body.appendChild(signoutFrame);

	return ToolbarEvent.needsLogin();
}

ToolbarEvent.signin =
ToolbarEvent.loginPage = function(request, sender) {
	ToolbarEvent.api._flush();
	chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
		chrome.tabs.update((sender && sender.tab.id) || tabs[0].id, {
			"url": config.suPages.signin.form(config)
		});
	});
	return ToolbarEvent._buildResponse({});
}

ToolbarEvent.needsLogin = function() {
	debug('Needs login', arguments);
	ToolbarEvent.api.cache.mset({ authed: config.authed = false });
	return ToolbarEvent._buildResponse({}, true);
}

ToolbarEvent.ping = function() {
	return ToolbarEvent.api
		.ping()
		.then(ToolbarEvent.api.getUser.bind(ToolbarEvent.api))
		.then(function(user) {
			debug('Login success for user', user.username);
			ToolbarEvent.api.cache.mset({ authed: config.authed = user.userid });
			ToolbarEvent.api.nextUrl(1)
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
	console.log('GUFPC', Page.urlCache[url]);
	return ToolbarEvent._buildResponse({url: Page.urlCache[url]});
}

ToolbarEvent.urlChange = function(request, sender) {
	return new Promise(function(resolve, reject) {
		chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
			var url = (request && request.url && request.url.url) || (tabs[0] && tabs[0].url);
			console.log(url);
			if (url) {
				Page.urlChange(url, tabs[0].id)
					.then(function(url) {
						resolve(ToolbarEvent._buildResponse({url: url}));
					});
			} else {
				reject();
			}
		});
	});
	return p;
	return ToolbarEvent._buildResponse({});
	//return ToolbarEvent._buildResponse({url: Page.urlCache[request && request.url && request.url.url]});
	return Promise.resolve(request);
}

ToolbarEvent.init = function(request, sender) {
	request.config = config;
	return ToolbarEvent._buildResponse({ url: Page.lastUrl(sender.tab.id), state: Page.lastState(sender.tab.id) });
}

ToolbarEvent._init = function() {
	ToolbarEvent.api.cache.mget(config.persist)
		 .then(function (map) {
			 Object.assign(config, map);
		 });

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

