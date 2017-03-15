/**
 * @class A class used to manage messaging to and from the background
 */
ToolbarEvent = {};

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
	var action = request.action;
	var requestedAction = request.action,
		action = requestedAction && requestedAction.replace(/-[a-z]/g, function (x) {
			return x[1].toUpperCase();
		});
	console.log("action: ", action);
	if (!action || !ToolbarEvent[action]) {
		console.log("bailing");
		return false;
	}
	ToolbarEvent[action](request, sender)
		.then(function(response) {
			console.log("ToolbarEvent.sendResponse", request, response);
			sendResponse(response);
		});
	return true;
}



/**
 *
 * @param {MessageRequest} request
 * @param {chrome.runtime.MessageSender} sender
 */
ToolbarEvent.share = function handleShare(request, sender) {
	return Promise.resolve(ToolbarEvent.api.getContacts())
		.then(function(contacts) {
			return ToolbarEvent._buildResponse({share: { contacts: contacts}}, false);
		});
}

/**
 * after the share save, marke the page state, return a convo object to the ui.
 * @param {MessageRequest} request
 * @param {chrome.runtime.MessageSender} sender
 */
ToolbarEvent.saveShare = function handleSaveShare(request, sender) {
	return ToolbarEvent
		._sanity()
		.then(function() { return request.data.contentId || Page.getUrlId(sender.tab.id) })
		.then(function(urlid) {
			return urlid || ToolbarEvent.discover(request, sender)
				.then(function(url) { return url.urlid; });
		})
		.then(function(urlid) {
			request.data.contentId = urlid;
			return ToolbarEvent.api.saveShare(request.data)
				.then(function(convo) {
					Page.state[sender.tab.id] = { convo: convo.id };
					return ToolbarEvent._buildResponse({newConvo: { convo:  convo}}, false);
				});
		})
		.catch(ToolbarEvent._error);
}

ToolbarEvent.convoAddRecipient = function(request, sender) {
	return Promise.resolve(ToolbarEvent.api.convoAddRecipient(request.data))
		.then(function(response) {
			if(typeof response === "string") {
				response = {response: response};
			}
			return ToolbarEvent._buildResponse({response: response}, false)
		});
}

ToolbarEvent.convoShowContacts = function(request, sender) {
	return Promise.resolve(ToolbarEvent.api.getContacts())
		.then(function(contacts) {
			return ToolbarEvent._buildResponse({convoContacts: { contacts:  contacts}}, false);
		});
}

/**
 * Discover a new url.  This is usually not called directly.  
 * This is usually a side-effect of submit
 *
 * @param {MessageRequest} request
 * @param {chrome.runtime.MessageSender} sender
 * @return {Promise} toolbar config response
 */
ToolbarEvent.discover = function(request, sender) {
	return Page.getUrl(sender.tab.id)
		.then(function(url) {
			return ToolbarEvent.api.submit(url, request.data.nsfw, request.data.nolike);
		})
		.then(function(url) { 
			Page.note(sender.tab.id, url); 
			ToolbarEvent._buildResponse({url: url}, sender.tab.id);
			return url;
		});
}


/**
 * Open an SU page
 *
 * @param {MessageRequest} request
 * @param {chrome.runtime.MessageSender} sender
 */
ToolbarEvent.su = function(request, sender) {
	chrome.tabs.create({ url: config.suPages[request.data.value].form(config) });
};


/**
 * Record mode changes
 *
 * @param {MessageRequest} request
 * @param {chrome.runtime.MessageSender} sender
 * @return {Promise} toolbar config response
 */
ToolbarEvent.mode = function(request, sender) {
	ToolbarEvent.cache.mset({ mode: config.mode = request.data.value || config.defaults.mode });
	ToolbarEvent._generateModeInfo(request, sender);
	ToolbarEvent.api._flushStumbles();
	ToolbarEvent.stumble(request, sender);
	return ToolbarEvent._buildResponse({ mode: config.mode, modeinfo: config.modeinfo }, true);
}



ToolbarEvent._generateModeInfo = function(request, sender) {
	if (config.mode == 'domain') {
		if (request.action == 'mode' || !(config.modeinfo || {}).domains)
			ToolbarEvent.cache.mset({ modeinfo: config.modeinfo = { domains: [ uriToDomain(sender.tab.url) ] } });
	} else {
		ToolbarEvent.cache.mset({ modeinfo: config.modeinfo = {} });
	}
	return config.modeinfo;
}



/**
 * Record theme changes
 *
 * @param {MessageRequest} request
 * @param {chrome.runtime.MessageSender} sender
 * @return {Promise} toolbar config response
 */
ToolbarEvent.theme = function(request, sender) {
	ToolbarEvent.cache.mset({ theme: config.theme = request.data.value || config.defaults.theme });
	return ToolbarEvent._buildResponse({}, true);
}



/**
 * Record hide-toggle requests
 *
 * @param {MessageRequest} request
 * @param {chrome.runtime.MessageSender} sender
 * @return {Promise} toolbar config response
 */
ToolbarEvent.toggleHidden = function(request, sender) {
	ToolbarEvent.cache.mset({ hidden: config.hidden = !config.hidden });
	return ToolbarEvent._buildResponse({}, true);
}



/**
 * Record unhide requests
 *
 * @param {MessageRequest} request
 * @param {chrome.runtime.MessageSender} sender
 * @return {Promise} toolbar config response
 */
ToolbarEvent.unhideToolbar = function(request, sender) {
	ToolbarEvent.cache.mset({ hidden: config.hidden = false });
	return ToolbarEvent._buildResponse({}, true);
}



/**
 * Record hide requests
 *
 * @param {MessageRequest} request
 * @param {chrome.runtime.MessageSender} sender
 * @return {Promise} toolbar config response
 */
ToolbarEvent.hideToolbar = function(request, sender) {
	ToolbarEvent.cache.mset({ hidden: config.hidden = true });
	return ToolbarEvent._buildResponse({}, true);
}




/**
 * Record reposition requests
 *
 * @param {MessageRequest} request
 * @param {chrome.runtime.MessageSender} sender
 * @return {Promise} toolbar config response
 */
ToolbarEvent.repos = function(request, sender) {
	ToolbarEvent.cache.mset({ rpos: config.rpos = request.data.rpos });
	return ToolbarEvent._buildResponse({}, true);
}



/**
 * Blocks the current site
 *
 * @param {MessageRequest} request
 * @param {chrome.runtime.MessageSender} sender
 * @return {Promise} toolbar config response
 */
ToolbarEvent.blockSite = function(request, sender) {
	ToolbarEvent
		._sanity()
		.then(function() { return Page.getUrlId(sender.tab.id) })
		.then(function(urlid) { 
			if (!urlid) {
				debug("Attempt to dislike url that doesn't exist", request);
				return Promise.resolve(request);
			}
			return ToolbarEvent.api.blockSite(urlid)
				.then(function(response) {
					return Page.note(sender.tab.id, response.url);
				});
		})
		.catch(ToolbarEvent._error);

	request.url.userRating = { type: -1, subtype: 0 };
	return Promise.resolve(request);
}




/**
 * Dislikes the current url
 *
 * @param {MessageRequest} request
 * @param {chrome.runtime.MessageSender} sender
 * @return {Promise} toolbar config response
 */
ToolbarEvent.reportSpam =
ToolbarEvent.dislike = function(request, sender) {
	if ((request.action == 'dislike' && request.url && request.url.userRating && request.url.userRating.type) == -1)
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
		.catch(ToolbarEvent._error);

	request.url.userRating = { type: -1, subtype: 0 };
	return Promise.resolve(request);
}




/**
 * Loads the stumbleupon info page in a new tab
 *
 * @param {MessageRequest} request
 * @param {chrome.runtime.MessageSender} sender
 * @return {Promise} toolbar config response
 */
ToolbarEvent.info = function(request, sender) {
	if (Page.getUrlId(sender.tab.id))
		chrome.tabs.create({ url: 'http://' + config.baseUrl + config.url.info.form({ urlid: Page.getUrlId(sender.tab.id) }) });
	Promise.resolve(request);
}



/**
 * Updates the active config.  Never called by the toolbar.
 *
 * @param {MessageRequest} request
 * @param {chrome.runtime.MessageSender} sender
 * @return {Promise} toolbar config response
 */
ToolbarEvent.updateConfig = function(request, sender) {
	Object.assign(config, request.data);
	return ToolbarEvent._buildResponse({}, true);
}



/**
 * Unrates the current url
 *
 * @param {MessageRequest} request
 * @param {chrome.runtime.MessageSender} sender
 * @return {Promise} toolbar config response
 */
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
		.catch(ToolbarEvent._error);

	request.url.userRating = { type: 0, subtype: 0 };
	return Promise.resolve(request);
}


/**
 * Likes the current url
 *
 * @param {MessageRequest} request
 * @param {chrome.runtime.MessageSender} sender
 * @return {Promise} toolbar config response
 */
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
		.catch(ToolbarEvent._error);

	request.url.userRating = { type: 1, subtype: 0 };
	return Promise.resolve(request);
}


/**
 * Adds an item to a list
 *
 * @param {MessageRequest} request
 * @param {chrome.runtime.MessageSender} sender
 * @return {Promise} toolbar config response
 */
ToolbarEvent.addToList = function(request, sender) {
	return ToolbarEvent
		._sanity()
		.then(function() { return request.data.urlid || Page.getUrlId(sender.tab.id) })
		.then(function(urlid) { 
			request.nolike = false;
			return urlid || ToolbarEvent.discover(request, sender)
				.then(function(url) { return url.urlid; });
		})
		.then(function(urlid) { 
			return ToolbarEvent.api.addToList(request.data.listid || request.data.list.id, urlid)
				.then(function(item) {
					return ToolbarEvent._buildResponse({ listitem: item, list: request.data.list });
				})
				.catch(ToolbarEvent._error);
		});
}


/**
 * Adds a list
 *
 * @param {MessageRequest} request
 * @param {chrome.runtime.MessageSender} sender
 * @return {Promise} toolbar config response
 */
ToolbarEvent.addList = function(request, sender) {
	return ToolbarEvent
		.api.addList(request.data.name, request.data.description, request.data.visibility)
		.then(function(list) {
			return ToolbarEvent.addToList({ data: { list: list } }, sender)
		})
		.catch(ToolbarEvent._error);
}


/**
 * Gets a list of lists
 *
 * @param {MessageRequest} request
 * @param {chrome.runtime.MessageSender} sender
 * @return {Promise} toolbar config response
 */
ToolbarEvent.lists = function(request, sender) {
	return ToolbarEvent
		.api.getLists()
		.then(function(lists) {
			return ToolbarEvent._buildResponse({ lists: { entries: lists } });
		})
		.catch(ToolbarEvent._error);
}


/**
 * Gets a list of conversation threads
 *
 * @param {MessageRequest} request
 * @param {chrome.runtime.MessageSender} sender
 * @return {Promise} toolbar config response
 */
ToolbarEvent.inbox = function(request, sender) {
	return ToolbarEvent
		.api.getConversations(request.data.position, request.data.limit, request.data.type)
		.then(function(inbox) {
			return ToolbarEvent.cache.get('authed')
				.then(function(userid) {
					return ToolbarEvent._buildResponse({inbox: { messages: inbox, position: request.data.position, type: request.data.type }});
				});
		})
		.catch(ToolbarEvent._error);
}



/**
 * Stumbles!  Preloads next url, notes the url, notes the state,
 * updates the url in the requesting frame.
 *
 * @param {MessageRequest} request
 * @param {chrome.runtime.MessageSender} sender
 * @return {Promise} toolbar config response
 */
ToolbarEvent.stumble = function(request, sender) {
	ToolbarEvent.api.getPendingUnread().then(function(info) {
		ToolbarEvent.cache.mset({ numShares: config.numShares = info.unread });
		return ToolbarEvent._buildResponse({ }, true);
	});
	return ToolbarEvent.api
		._mode(config.mode || config.defaults.mode, ToolbarEvent._generateModeInfo(request, sender))
		.nextUrl()
		.then(function(url) {
			ToolbarEvent.api
				.nextUrl(1)
				.then(Page.preload);
			Page.note(sender.tab.id, url);
			Page.state[sender.tab.id] = { stumble: url, mode: config.mode }
			ToolbarEvent.api.reportStumble([url.urlid]);
			request.url = url;
			console.log(url);
			chrome.tabs.update(sender.tab.id, { url: url.url });
			// Don't send URL now, wait for init call
			return ToolbarEvent._buildResponse({});
		})
		.catch(ToolbarEvent._error);
}



/**
 * Replies to a conversation
 *
 * @param {MessageRequest} request
 * @param {String} request.data.id The conversation id
 * @param {String} request.data.comment The comment to be posted
 * @param {chrome.runtime.MessageSender} sender
 * @return {Promise} toolbar config response
 */
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



/**
 * Closes a conversation
 *
 * @param {MessageRequest} request
 * @param {chrome.runtime.MessageSender} sender
 * @return {Promise} toolbar config response
 */
ToolbarEvent.closeConvo = function(request, sender) {
	Page.state[sender.tab.id] = { };
	return ToolbarEvent._buildResponse({ });
}


/**
 * Loads conversations messages
 *
 * @param {MessageRequest} request
 * @param {chrome.runtime.MessageSender} sender
 * @return {Promise} toolbar config response
 */
ToolbarEvent.loadConvo = function(request, sender) {
	var convo = ToolbarEvent.api.getConversation(request.data.value)
	return Promise.resolve(convo.messages(request.data.stamp, request.data.type))
		.then(function(convo) {
			return ToolbarEvent._buildResponse({convo: Object.assign({}, convo, {position: (request.data.type == 'before') ? 'prepend' : (request.data.stamp ? 'append' : null) })});
		});
}


/**
 * Changes the current tab to the url related to the provided conversation
 * If an actionid is provided, marks the conversation as read
 * If an urlid and id (conversation id) is provided, directly loads url without redirect
 * If an url is provided, loads the stumbleupon url and relies on redirect
 *
 * @param {MessageRequest} request
 * @param {chrome.runtime.MessageSender} sender
 * @return {Promise} toolbar config response
 */
ToolbarEvent.openConvo = function(request, sender) {
	if (request.data.actionid) {
		ToolbarEvent.api.markActivityAsRead(request.data.actionid)
			.then(function() {
				ToolbarEvent.api.getPendingUnread().then(function(info) {
					ToolbarEvent.cache.mset({ numShares: config.numShares = info.unread });
					return ToolbarEvent._buildResponse({ }, true);
				});
			});
	}
	if (request.data.urlid && request.data.id) {
		return Promise.resolve(Page.getUrlByUrlid(request.data.urlid, config.mode) || ToolbarEvent.api.getUrlByUrlid(request.data.urlid))
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

/**
 * Signs out of stumbleupon, marks as unathed
 *
 * @param {MessageRequest} request
 * @param {chrome.runtime.MessageSender} sender
 * @return {Promise} toolbar config response
 */
ToolbarEvent.signout = function(request, sender) {
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

	return ToolbarEvent.needsLogin();
}

/**
 * Handles url-change events, returns the su url
 *
 * @param {MessageRequest} request
 * @param {chrome.runtime.MessageSender} sender
 * @return {Promise} toolbar config response
 */
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
}

/**
 * Gets the current toolbar state and url
 *
 * @param {MessageRequest} request
 * @param {chrome.runtime.MessageSender} sender
 * @return {Promise} toolbar config response
 */
ToolbarEvent.init = function(request, sender) {
	request.config = config;
	return ToolbarEvent._buildResponse({ url: Page.lastUrl(sender.tab.id), state: Page.lastState(sender.tab.id), version: chrome.runtime.getManifest().version });
}

/**
 * Loads the sign in page in the current active tab
 *
 * @param {MessageRequest} request
 * @param {chrome.runtime.MessageSender} sender
 * @return {Promise} toolbar config response
 */
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

/**
 * Sets the authed flag to false, notifies all iframes
 *
 * @return {Promise} toolbar config response
 */
ToolbarEvent.needsLogin = function() {
	debug('Needs login', arguments);
	ToolbarEvent.cache.mset({ authed: config.authed = false });
	return ToolbarEvent._buildResponse({}, true);
}

/**
 * Queries to see if the current user is logged in.
 * If the user is logged in, the authed flag is set and the next url is preloaded
 *
 * @return {Promise} toolbar config response
 */
ToolbarEvent.ping = function() {
	return ToolbarEvent.api
		.ping()
		.then(ToolbarEvent.api.getUser.bind(ToolbarEvent.api))
		.then(function(user) {
			debug('Login success for user', user.username);
			ToolbarEvent.cache.mset({ authed: config.authed = user.userid });
			ToolbarEvent.getInterests();
			ToolbarEvent.api.nextUrl(1)
				.then(Page.preload)
				.catch(function(e) {warning('Expected to preload next url', e);});
		})
		.catch(ToolbarEvent.needsLogin);
}



ToolbarEvent.getInterests = function() {
	ToolbarEvent.api.getInterests()
		.then(function(interests) {
			// Cache interests for an hour
			ToolbarEvent.cache.set(interests, config.interests = interests, 60 * 60 * 1000);
			ToolbarEvent._buildResponse({ interests: interests }, true);
		});
}



/**
 * Builds a response to send back to the iframe'd toolbar
 *
 * @param {object} change Object to merge into response
 * @param {boolean} tabid Push immediately to tabid.  Use true or '*' to push to all tabs.
 * @return {Promise} toolbar config response
 */
ToolbarEvent._buildResponse = function(change, tabid) {
	var response = Object.assign({}, { config: config }, change);
	if (tabid) {
		if (tabid === true || tabid === '*') {
			chrome.tabs.query({}, function(tabs) {
				tabs.forEach(function (tab) {
					chrome.tabs.sendMessage(tab.id, response);
				});
			});
		} else {
			chrome.tabs.sendMessage(tabid, response);
		}
	}
	return Promise.resolve(response);
}



/********************
 * Helper functions *
 *******************/


/**
 * Attempts to fetch the user from the ToolbarEvent.cache.  If the user isn't found, then we ping
 *
 * @returns {Promise}
 */
ToolbarEvent._sanity = function() {
	return ToolbarEvent.cache.get('user')
		.then(function(user) {
			ToolbarEvent.cache.mset({ authed: config.authed = user.userid });
			if (!user.userid)
				return ToolbarEvent.ping();
			ToolbarEvent.api.getPendingUnread().then(function(info) {
				ToolbarEvent.cache.mset({ numShares: config.numShares = info.unread });
				return ToolbarEvent._buildResponse({ }, true);
			});
			return user;
		})
}

/**
 * Initializes the toolbar background state
 */
ToolbarEvent._init = function() {
	ToolbarEvent.cache = new Cache(config.defaults);

	ToolbarEvent.api = new StumbleUponApi(config.api.stumbleupon, ToolbarEvent.cache);
	ToolbarEvent.api._flush();

	ToolbarEvent.cache.mget(config.persist)
		 .then(function (map) {
			 Object.assign(config, map);
		 });
	if (!config.interests || !config.interests.length)
		ToolbarEvent.getInterests();

	chrome.runtime.onMessage.addListener(ToolbarEvent.handleRequest);

	ToolbarEvent.ping();
}


/**
 * Reject the current promise, log the message
 *
 * @return {Promise} rejection
 */
ToolbarEvent._error = function(e) {
	console.log(e)
	//ToolbarEvent.loginPage();
	return Promise.reject(e);
}




ToolbarEvent._init();

