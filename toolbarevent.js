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
	var shouldLog = !(request && request.action == 'mouse');
	shouldLog && console.log("ToolbarEvent.handleRequest", request);
	var action = request.action;
	var requestedAction = request.action,
		action = requestedAction && requestedAction.replace(/-[a-z]/g, function (x) {
			return x[1].toUpperCase();
		});
	if (!action || !ToolbarEvent[action]) {
		return false;
	}
	ToolbarEvent[action](request, sender)
		.then(function(response) {
			if (response && response !== true) {
				shouldLog && console.log("ToolbarEvent.sendResponse", request, response);
				try {
					sendResponse(response);
				} catch (e) {
					if (Page.tab[sender.tab.id].status.state == 'incog') {
						warning(e);
						return; // Sometimes we get incognito races.  They are safe to ignore.
					}
				}
			}
		})
		.catch(function(err) {
			console.log(err);
			ToolbarEvent._error(request, sender, err, sender.tab.id);
		});
	return true;
}



/*************** START SHARE *****************/

/**
 *
 * @param {MessageRequest} request
 * @param {chrome.runtime.MessageSender} sender
 */
ToolbarEvent.share = function handleShare(request, sender) {
	return ToolbarEvent
		._sanity()
		.then(function() {
			return ToolbarEvent.api.getContacts();
		})
		.then(function(contacts) {
			return ToolbarEvent._buildResponse({share: { contacts: contacts}}, false);
		});
}


ToolbarEvent.shareTo = function(request, sender) {
	ToolbarEvent._buildResponse(request, sender.tab.id);

	return ToolbarEvent
		._sanity()
		.then(function()      { return (request.url && request.url.urlid) || Page.getUrlId(sender.tab.id); }) // Find urlid by tab
		.then(function(urlid) { return urlid || (Page.getUrlByHref(request.url.url, config.mode) || {}).urlid; }) // Find urlid by url in page cache
		.then(function(urlid) { return urlid || ToolbarEvent.api.getUrlByHref(request.url.url).then(function(url) { return url.urlid; }).catch(function(e) { return false; }); }) // Find urlid by url in SU
		.then(function(urlid) { return urlid || ToolbarEvent._discover(request, sender).then(function(url) { return url.publicid; }); }) // Discover url if we don't have an urlid
		.then(function(urlid) { return urlid && (Page.getUrlByUrlid(urlid, config.mode) || ToolbarEvent.api.getUrlByUrlid(urlid)); }) // Get the SU Url Object
 		.then(function(suurl) { // SHARE IT!!!!
			var shareableUrl = config.suPages.stumble.form({
				baseProto: config.baseProto,
				baseUrl:   config.baseUrl,
				urlid:     suurl.urlid,
				code:      suurl.tracking_code,
				slug:      suurl.url.replace(/^.*:\/\/'/, '').replace(/[?#:].*/g, '')
			});
			var shareToUrl = config.externalShare[request.data.value].form({
				title: suurl.title,
				url:   shareableUrl
			});
			console.log('Share '+shareableUrl+' to '+request.data.value+" => "+shareToUrl);
			chrome.tabs.create({
				url: shareToUrl
			});
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
			return urlid || ToolbarEvent._discover(request, sender)
				.then(function(url) { return url.publicid; });
		})
		.then(function(urlid) {
			request.data.contentId = urlid;
			return ToolbarEvent.api.saveShare(request.data)
				.then(function(convo) {
					Page.state[sender.tab.id] = { convo: convo.id };
					ToolbarEvent._notify("Sent");
					return ToolbarEvent._buildResponse({newConvo: { convo:  convo}}, false);
				});
		});
}

/*************** END SHARE *****************/




/*************** START RATINGS *****************/

/**
 * Marks the current site as spam
 *
 * @param {MessageRequest} request
 * @param {chrome.runtime.MessageSender} sender
 * @return {Promise} toolbar config response
 */
ToolbarEvent.reportSpam = function(request, sender) {
	request.url.userRating = { type: -1, subtype: -5 };
	ToolbarEvent._buildResponse(request, sender.tab.id);

	return ToolbarEvent
		._sanity()
		.then(function() { return (request.url && request.url.urlid) || Page.getUrlId(sender.tab.id) })
		.then(function(urlid) { 
			if (!urlid) {
				debug("Attempt to dislike url that doesn't exist", request);
				return Promise.reject(new ToolbarError("TBEV", "reportSpam", "nourl"));
			}
			// No need to dislike, reportSpam auto-dislikes
			return urlid;
		})
		.then(function(urlid) {
			ToolbarEvent._notify("Marked as Spam");
			if (!sender.tab.incognito)
				Page.note(sender.tab.id, Object.assign(Page.getUrlByUrlid(urlid, config.mode), { userRating: request.url.userRating }), true);
			return ToolbarEvent.api.reportSpam(urlid);
		});
}



/**
 * Blocks the current site
 *
 * @param {MessageRequest} request
 * @param {chrome.runtime.MessageSender} sender
 * @return {Promise} toolbar config response
 */
ToolbarEvent.blockSite = function(request, sender) {
	request.url.userRating = { type: -1, subtype: 0 };
	ToolbarEvent._buildResponse(request, sender.tab.id);

	return ToolbarEvent
		._sanity()
		.then(function() { return (request.url && request.url.urlid) || Page.getUrlId(sender.tab.id) })
		.then(function(urlid) { 
			if (!urlid) {
				debug("Attempt to dislike url that doesn't exist", request);
				return Promise.reject(new ToolbarError("TBEV", "block", "nourl"));
			}
			ToolbarEvent.api.dislike(urlid);
			return urlid;
		})
		.then(function(urlid) {
			ToolbarEvent._notify("Domain Blocked");
			if (!sender.tab.incognito)
				Page.note(sender.tab.id, Object.assign(Page.getUrlByUrlid(urlid, config.mode), { userRating: request.url.userRating }), true);
			return ToolbarEvent.api.blockSite(urlid);
		})
}


/**
 * Marks the current url as Not Available
 *
 * @param {MessageRequest} request
 * @param {chrome.runtime.MessageSender} sender
 * @return {Promise} toolbar config response
 */
ToolbarEvent.miscat = function(request, sender) {
	return ToolbarEvent
		._sanity()
		.then(function() { return (request.url && request.url.urlid) || Page.getUrlId(sender.tab.id) })
		.then(function(urlid) { 
			if (!urlid) {
				debug("Attempt to dislike url that doesn't exist", request);
				return Promise.reject(new ToolbarError("TBEV", "miscat", "nourl"));
			}
			ToolbarEvent.api.dislike(urlid);
			return urlid;
		})
		.then(function(urlid) { return ToolbarEvent.api.reportMiscat(urlid, request.data.interest, request.data.details); })
		.then(function(info) {
			ToolbarEvent._notify('Misclassification reported');
			return ToolbarEvent._buildResponse({ });
		})
}


/**
 * Marks the current url as Not Available
 *
 * @param {MessageRequest} request
 * @param {chrome.runtime.MessageSender} sender
 * @return {Promise} toolbar config response
 */
ToolbarEvent.reportInfo = function(request, sender) {
	return ToolbarEvent
		._sanity()
		.then(function() { return (request.url && request.url.urlid) || Page.getUrlId(sender.tab.id) })
		.then(function(urlid) { 
			if (!urlid) {
				debug("Attempt to dislike url that doesn't exist", request);
				return Promise.reject(new ToolbarError("TBEV", "reportInfo", "nourl"));
			}
			return urlid;
		})
		.then(function(urlid) { return ToolbarEvent.api.reportInfo(urlid); })
		.then(function(info) { return ToolbarEvent._buildResponse({ miscatInfo: info }); });
}


/**
 * Marks the current url as Not Available
 *
 * @param {MessageRequest} request
 * @param {chrome.runtime.MessageSender} sender
 * @return {Promise} toolbar config response
 */
ToolbarEvent.reportMissing = function(request, sender) {
	request.url.userRating = { type: -1, subtype: -6 };
	ToolbarEvent._buildResponse(request, sender.tab.id);

	return ToolbarEvent
		._sanity()
		.then(function() { return (request.url && request.url.urlid) || Page.getUrlId(sender.tab.id) })
		.then(function(urlid) { 
			if (!urlid) {
				debug("Attempt to dislike url that doesn't exist", request);
				return Promise.reject(new ToolbarError("TBEV", "reportMissing", "nourl"));
			}
			ToolbarEvent.api.dislike(urlid);
			return urlid;
		})
		.then(function(urlid) {
			ToolbarEvent._notify("Reported Missing");
			if (!sender.tab.incognito)
				Page.note(sender.tab.id, Object.assign(Page.getUrlByUrlid(urlid, config.mode), { userRating: request.url.userRating }), true);
			return ToolbarEvent.api.reportMissing(urlid);
		})
}


/**
 * Dislikes the current url
 *
 * @param {MessageRequest} request
 * @param {chrome.runtime.MessageSender} sender
 * @return {Promise} toolbar config response
 */
ToolbarEvent.dislike = function(request, sender) {
	if ((request.action == 'dislike' && request.url && request.url.userRating && request.url.userRating.type) == -1)
		return ToolbarEvent.unrate(request, sender);

	var oldRating = request.url.userRating || { type: 0, subtype: 0 };
	request.url.userRating = { type: -1, subtype: 0 };
	ToolbarEvent._buildResponse(request, sender.tab.id);

	return ToolbarEvent
		._sanity()
		.then(function() { return (request.url && request.url.urlid) || Page.getUrlId(sender.tab.id); })
		.then(function(urlid) { return urlid || (Page.getUrlByHref(request.url.url, config.mode) || {}).urlid; })
		.then(function(urlid) { 
			if (!urlid) {
				debug("Attempt to dislike url that doesn't exist", request);
				return Promise.reject(new ToolbarError("TBEV", "dislike", "nourl"));
			}
			return urlid;
		})
		.then(function(urlid) {
			return ToolbarEvent.api.dislike(urlid)
				.then(function() {
					if (!sender.tab.incognito)
						Page.note(sender.tab.id, Object.assign(Page.getUrlByUrlid(urlid, config.mode), { userRating: request.url.userRating }), true);
				});
		})
		.catch(function(e) {
			request.url.userRating = oldRating;
			ToolbarEvent._buildResponse(request, sender.tab.id);
			return Promise.reject(e);
		})
}

/**
 * Unrates the current url
 *
 * @param {MessageRequest} request
 * @param {chrome.runtime.MessageSender} sender
 * @return {Promise} toolbar config response
 */
ToolbarEvent.unrate = function(request, sender) {
	var oldRating = request.url.userRating || { type: 0, subtype: 0 };
	request.url.userRating = { type: 0, subtype: 0 };
	ToolbarEvent._buildResponse(request, sender.tab.id);
	
	return ToolbarEvent
		._sanity()
		.then(function() { return (request.url && request.url.urlid) || Page.getUrlId(sender.tab.id); })
		.then(function(urlid) { return urlid || (Page.getUrlByHref(request.url.url, config.mode) || {}).urlid; })
		.then(function(urlid) { 
			if (!urlid) {
				debug("Attempt to unrate url that doesn't exist", request);
				return Promise.reject(new ToolbarError("TBEV", "unrate", "nourl"));
			}
			return urlid;
		})
		.then(function(urlid) {
			return ToolbarEvent.api.unrate(urlid)
				.then(function() {
					if (!sender.tab.incognito)
						Page.note(sender.tab.id, Object.assign(Page.getUrlByUrlid(urlid, config.mode), { userRating: request.url.userRating }), true);
				});
		})
		.catch(function(e) {
			request.url.userRating = oldRating;
			ToolbarEvent._buildResponse(request, sender.tab.id);
			return Promise.reject(e);
		})
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

	var oldRating = request.url.userRating || { type: 0, subtype: 0 };
	request.url.userRating = { type: 1, subtype: 0 };
	ToolbarEvent._buildResponse(request, sender.tab.id);

	return ToolbarEvent
		._sanity()
		.then(function() { return (request.url && request.url.urlid) || Page.getUrlId(sender.tab.id); }) // Find urlid by tab
		.then(function(urlid) { return urlid || (Page.getUrlByHref(request.url.url, config.mode) || {}).urlid; }) // Find urlid by url in page cache
		.then(function(urlid) { return urlid || ToolbarEvent.api.getUrlByHref(request.url.url).then(function(url) { return url.urlid; }).catch(function(e) { return false; }); }) // Find urlid by url in SU
		.then(function(urlid) { return urlid && ToolbarEvent.api.like(urlid).then(function() { return urlid; }); }) // Like urlid if we have one
		.then(function(urlid) { return urlid || ToolbarEvent._discover(request, sender).then(function(url) { return url.publicid; }); }) // Discover url if we don't have an urlid
		.then(function(urlid) { // Note the like
			if (!sender.tab.incognito)
				Page.note(sender.tab.id, Object.assign(Page.getUrlByUrlid(urlid, config.mode), { userRating: request.url.userRating }), true);
			return urlid;
		})
		.catch(function(e) {
			request.url.userRating = oldRating;
			ToolbarEvent._buildResponse(request, sender.tab.id);
			return Promise.reject(e);
		})
}

/*************** END RATINGS *****************/



/*************** START LISTS *****************/

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
			return urlid || ToolbarEvent._discover(request, sender)
				.then(function(url) { return url.publicid; });
		})
		.then(function(urlid) { 
			return ToolbarEvent.api.addToList(request.data.listid || request.data.list.id, urlid);
		})
		.then(function(item) {
			ToolbarEvent._notify("Added to " + (request.data.listname || request.data.list.name), sender.tab.id) + " List";
			return ToolbarEvent._buildResponse({ listitem: item, list: request.data.list });
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
		.api.addList(request.data.name, request.data.description || '', request.data.visibility)
		.then(function(list) {
			// This message isn't needed, we're already showing the Added To List message in addToList
			//ToolbarEvent._notify("Added list " + request.data.name, sender.tab.id);
			return ToolbarEvent.addToList({ data: { list: list } }, sender)
		});
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
		});
}

/*************** END LISTS *****************/




/*************** START INBOX *****************/

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
		});
}



ToolbarEvent.pendingUnread = function(request, sender) {
	// Handle 30 second cache timeout at proxy layer
	if (ToolbarEvent._lastUnreadUpdate && Date.now() - ToolbarEvent._lastUnreadUpdate <= 30 * 1000) {
		return ToolbarEvent._buildResponse({ }, true);
	}
	ToolbarEvent._lastUnreadUpdate = Date.now();
	ToolbarEvent._lastUnreadCount  = 0;
	return ToolbarEvent.api.getPendingUnread().then(function(info) {
		ToolbarEvent.cache.mset({ numShares: config.numShares = info.unread });
		return ToolbarEvent._buildResponse({ }, true);
	});
}

/*************** END INBOX *****************/




/*************** START STUMBLE *****************/

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
	ToolbarEvent._buildResponse({ mode: config.mode, modeinfo: config.modeinfo }, true);
	return ToolbarEvent.stumble(request, sender);
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
	return ToolbarEvent._sanity()
		.then(function() {
			return ToolbarEvent.api
				._mode(config.mode || config.defaults.mode, ToolbarEvent._generateModeInfo(request, sender))
				.nextUrl();
		})
		.then(function(url) {
			ToolbarEvent.pendingUnread();
			ToolbarEvent.api.nextUrl(1).then(Page.preload);

			// We have to explicitly note the url on incognito, otherwise we can't perform any operations
			Page.note(sender.tab.id, url);
			Page.state[sender.tab.id] = { mode: config.mode }

			ToolbarEvent.api.reportStumble([url.urlid], url.mode, url.modeinfo);
			request.url = url;

			Page.tab[sender.tab.id].stumbling = true;
			chrome.tabs.update(sender.tab.id, { url: url.url });

			return ToolbarEvent._buildResponse({});
		});
}

/*************** END STUMBLE *****************/




/*************** START CONVO *****************/

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
	var convo = ToolbarEvent.api.getConversation(request.data.value),
		contactsKey = 'contacts';
	return Promise.all([convo.messages(request.data.stamp, request.data.type, request.data.limit), ToolbarEvent.api.getContacts()])
		.then(function(results) {
			var conversation = results[0],
				contacts = results[1],
				now = Date.now();
			conversation.participants && conversation.participants.forEach(function _touchOrInsertContact(participant) {
				// @TODO this code is repeated in stumbleuponapi.js -- refactor to some common place
				// update the last-accessed time for sorting purposes -- this must be persisted
				var contact = contacts.get(participant.suUserId || encodeURIComponent(participant.email));
				if(contact) {
					contact.touch(now);
				} else { // this participant isn't in our cached contact list, so insert them
					if(participant.email) {
						contacts.add(encodeURIComponent(participant.email), participant.email, false, "convo");
					} else if(participant.suUserId) {
						contacts.add(
							participant.suUserId,
							participant.name ? participant.name + " (" + participant.suUserName + ")" : participant.suUserName,
							false,
							"convo"
						);
					}
				}
			});
			contacts.sort();
			this.userCache.set(contactsKey, JSON.stringify(contacts)); // this can run async
			conversation.participants && conversation.participants.forEach(function _setParticipant(participant) {
				// set the participant flag for the front-end
				var contact = contacts.get(participant.suUserId || encodeURIComponent(participant.email));
				contact && contact.setParticipant(true);
			});
			return ToolbarEvent._buildResponse({
				convo: Object.assign({}, conversation, {contacts: contacts, position: (request.data.type == 'before') ? 'prepend' : (request.data.stamp ? 'append' : null) }),
			});
		}.bind(this));
}

/**
 * add a new email contact to the cache and respond with the updated list
 * @param request
 * @param sender
 */
ToolbarEvent.newEmailContact = function _newEmailContact(request, sender) {
	var emailAddress = request.data;
	return ToolbarEvent.api.newEmailContact(emailAddress)
		.then(function(contacts) {
			return ToolbarEvent._buildResponse({
				contactsRefresh: contacts
			});
		}.bind(this));
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
		if (!request.data.read) {
			ToolbarEvent._lastUnreadUpdate = Date.now();
			ToolbarEvent._lastUnreadCount  = (ToolbarEvent._lastUnreadCount || 0) + 1;
			ToolbarEvent.cache.mset({ numShares: config.numShares = Math.max((config.numShares || 0) - 1, 0) });
		}

		ToolbarEvent.api.markActivityAsRead(request.data.actionid)
			.then(ToolbarEvent.pendingUnread);
	}
	if (request.data.urlid && request.data.id) {
		return Promise.resolve(Page.getUrlByUrlid(request.data.urlid, config.mode) || ToolbarEvent.api.getUrlByUrlid(request.data.urlid))
			.then(function(url) {
				Page.state[sender.tab.id] = { convo: request.data.id };
				Page.note(sender.tab.id, url);
				Page.tab[sender.tab.id].stumbling = true;
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


ToolbarEvent.convoAddRecipient = function(request, sender) {
	var convo = ToolbarEvent.api.getConversation(request.data.conversationId),
		contactsKey = 'contacts';
	return convo.addRecipient(request.data)
		.then(function _addedRecipient() {
			return Promise.all([convo.messages(), ToolbarEvent.api.getContacts()]);
		})
		.then(function _requeriedConvo(results) {
			var conversation = results[0],
				contacts = results[1],
				now = Date.now();
			ToolbarEvent._notify("Added to Conversation");
			conversation.participants && conversation.participants.forEach(function _touchOrInsertContact(participant) {
				// @TODO this code is repeated in stumbleuponapi.js -- refactor to some common place
				// update the last-accessed time for sorting purposes -- this must be persisted
				var contact = contacts.get(participant.suUserId || encodeURIComponent(participant.email));
				if(contact) {
					contact.touch(now);
				} else { // this participant isn't in our cached contact list, so insert them
					if(participant.email) {
						contacts.add(encodeURIComponent(participant.email), participant.email, false, "convo");
					} else if(participant.suUserId) {
						contacts.add(
							participant.suUserId,
							participant.name ? participant.name + " (" + participant.suUserName + ")" : participant.suUserName,
							false,
							"convo"
						);
					}
				}
			});
			contacts.sort();
			this.userCache.set(contactsKey, JSON.stringify(contacts)); // this can run async
			conversation.participants && conversation.participants.forEach(function _setParticipant(participant) {
				// set the participant flag for the front-end
				var contact = contacts.get(participant.suUserId || encodeURIComponent(participant.email));
				contact && contact.setParticipant(true);
			});
			return ToolbarEvent._buildResponse({convo: Object.assign({}, conversation, {contacts: contacts, position: 'append'})});
		}.bind(this));
}

ToolbarEvent.convoShowContacts = function(request, sender) {
	return Promise.resolve(ToolbarEvent.api.getContacts())
		.then(function(contacts) {
			return ToolbarEvent._buildResponse({convoContacts: { contacts:  contacts}}, false);
		});
}


/*************** END CONVO *****************/




/*************** START AUTH *****************/

/**
 * Signs out of stumbleupon, marks as unathed
 *
 * @param {MessageRequest} request
 * @param {chrome.runtime.MessageSender} sender
 * @return {Promise} toolbar config response
 */
ToolbarEvent.signout = function(request, sender) {
	chrome.cookies.getAll({ domain: 'stumbleupon.com' }, function(cookies) {
		cookies.forEach(function(cookie) {
			chrome.cookies.remove({ url: 'https://' + cookie.domain + cookie.path, name: cookie.name });
		});
	});
	ToolbarEvent._notify("Signed Out");
	ToolbarEvent.cache.mset({ authed: config.authed = false, user: {} });
	return ToolbarEvent._buildResponse({}, true);
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
		Page.state[tabs[0].id] = { returl: tabs[0].url };
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
ToolbarEvent.testLogin = function(e) {
	if (e && e.type == 'API' && e.context && e.context.code === 0)
		return Promise.reject(e); // We got disconnected
	return ToolbarEvent.needsLogin();
}
ToolbarEvent.needsLogin = function() {
	debug('Needs login', arguments);
	ToolbarEvent.cache.mset({ authed: config.authed = false });
	ToolbarEvent._notify("You got logged out");
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
			ToolbarEvent.userCache = new Cache({prefix: user.userid + '-'});
			ToolbarEvent.api.setUserCache(ToolbarEvent.userCache);
			ToolbarEvent.interests();
			ToolbarEvent.pendingUnread();
			ToolbarEvent.api
				._mode(config.mode || config.defaults.mode, ToolbarEvent._generateModeInfo({}, {}))
				.nextUrl(1)
				.then(Page.preload)
				.catch(function(e) { warning('Expected to preload next url', e); });
		})
		.catch(ToolbarEvent.testLogin);
}

/*************** END AUTH *****************/





/*************** START STATE *****************/

/**
 * Gets the current toolbar state and url
 *
 * @param {MessageRequest} request
 * @param {chrome.runtime.MessageSender} sender
 * @return {Promise} toolbar config response
 */
ToolbarEvent.init = function(request, sender) {
	request.config = config;
	return ToolbarEvent._buildResponse({
		url: Page.lastUrl(sender.tab.id),
		state: Page.lastState(sender.tab.id),
		version: chrome.runtime.getManifest().version,
		hash: Math.random().toString(36).substr(2) + Math.random().toString(36).substr(2) + Math.random().toString(36).substr(2),
	}, sender.tab.id);
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
			if (url) {
				Page.urlChange(url, tabs[0].id)
					.then(function(url) {
						resolve(ToolbarEvent._buildResponse({url: url}));
					});
			} else {
				reject(Promise.reject(new ToolbarError('TBEV', 'nourl-urlChange', Page.tab[sender.tab.id])));
			}
		});
	});
}


/**
 * Loads the stumbleupon info page in a new tab
 *
 * @param {MessageRequest} request
 * @param {chrome.runtime.MessageSender} sender
 * @return {Promise} toolbar config response
 */
ToolbarEvent.info = function(request, sender) {
	if ((request.url && request.url.urlid) || Page.getUrlId(sender.tab.id))
		chrome.tabs.create({ url: 'http://' + config.baseUrl + config.url.info.form({ urlid: (request.url && request.url.urlid) || Page.getUrlId(sender.tab.id) }) });
	return Promise.resolve(true);
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


ToolbarEvent.interests = function() {
	return ToolbarEvent.cache.get('interests')
		.then(function(interests) {
			return (interests && interests.length && interests) || ToolbarEvent.api.getInterests()
				.then(function(interests) {
					// Cache interests for an hour
					ToolbarEvent.cache.set(interests, config.interests = interests, 60 * 60 * 1000);
					return interests;
				});
		})
		.then(function(interests) {
			return ToolbarEvent._buildResponse({ interests: interests }, true);
		});
}


/**
 * Toggle toolbar expanded state
 *
 * @param {MessageRequest} request
 * @param {chrome.runtime.MessageSender} sender
 */
ToolbarEvent.stayExpanded = function(request, sender) {
	ToolbarEvent.cache.mset({ stayExpanded: config.stayExpanded = !config.stayExpanded });
	return ToolbarEvent._buildResponse({ stayExpanded: config.stayExpanded }, true);
};


/**
 * Toggle toolbar expanded state
 *
 * @param {MessageRequest} request
 * @param {chrome.runtime.MessageSender} sender
 */
ToolbarEvent.oneBar = function(request, sender) {
	ToolbarEvent.cache.mset({ unloadNonVisibleBars: config.unloadNonVisibleBars = !config.unloadNonVisibleBars });
	return ToolbarEvent._buildResponse({ unloadNonVisibleBars: config.unloadNonVisibleBars }, true);
};


/**
 * Open an SU page
 *
 * @param {MessageRequest} request
 * @param {chrome.runtime.MessageSender} sender
 */
ToolbarEvent.su = function(request, sender) {
	if (config.suPagesNeedAuth.includes(request.data.value))
		var promise = ToolbarEvent.ping();
	else
		var promise = Promise.resolve();
	promise.then(function() {
		if (!config.authed && config.suPagesNeedAuth.includes(request.data.value))
			return Promise.reject();
		chrome.tabs.create({ url: config.suPages[request.data.value].form(config) });
	}).catch(function() {
		chrome.tabs.create({ url: config.suPages['signin'].form(config) });
	});
};

/*************** END STATE *****************/




/********************
 * Helper functions *
 *******************/


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


/**
 * Attempts to fetch the user from the ToolbarEvent.cache.  If the user isn't found, then we ping
 *
 * @returns {Promise}
 */
ToolbarEvent._sanity = function() {
	return ToolbarEvent.cache.get('user')
		.then(function(user) {
			ToolbarEvent.cache.mset({ authed: config.authed = user.userid });
			ToolbarEvent.userCache = new Cache({prefix: user.userid + '-'});
			ToolbarEvent.api.setUserCache(ToolbarEvent.userCache);
			if (!user.userid)
				return ToolbarEvent.ping();
			ToolbarEvent.pendingUnread();
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
		ToolbarEvent.interests();

	chrome.runtime.onMessage.addListener(ToolbarEvent.handleRequest);

	ToolbarEvent.ping();
}


/**
 * Reject the current promise, log the message, send to toolbar
 *
 * @return {Promise} rejection
 */
ToolbarEvent._error = function(request, sender, e, tabid) {
	var orig = e;
	var report = false;
	error(e);
	ToolbarEvent.ping();
	if (!e || e.message == 'Attempting to use a disconnected port object')
		return;
	debugger
	if (e.error == 'runout')
		e = 'Ran out of stumbles';
	if (e.error == 'nourl' && ['reportSpam', 'miscat', 'blockSite', 'reportInfo', 'reportMissing'].indexOf(e.name) != -1)
		return ToolbarEvent._buildResponse({}, tabid);
	if (e.error == 'nourl' && ['dislike', 'unrate'].indexOf(e.name) != -1)
		e = 'Page not found on StumbleUpon';
	if (e.error && e.error._reason && e.error._reason[0] && e.error._reason[0].message)
		e = report = e.error._reason[0].message;
	if (e.error && e.error._reason && e.error._reason && e.error._reason.message)
		e = report = e.error._reason.message;
	if (e.stack) {
		if (e.stack.split("\n")[0] == e.message)
			e = report = e.stack;
		else
			e = report = (e.message || (e.type + '::' + e.name)) + "\n" + e.stack;
		e = "A network error occurred";
		if (!report)
			report = "Unknown";
	}
	if (report) {
		ToolbarEvent.api.reportError(report, {
			error: orig,
			url: Page.lastUrl(tabid),
			state: Page.lastState(tabid),
			tab: Page.tab[tabid],
			version: chrome.runtime.getManifest().version,
			request: request,
			sender: sender,
			tabid: tabid,
			config: {
				modeinfo: config.modeinfo,
				mode: config.mode,
				accessToken: config.accessToken,
				authed: config.authed,
			},
		});
	}
	return ToolbarEvent._buildResponse({error: e}, tabid);
}


/**
 * Create a notification on the toolbar
 *
 * @return {Promise} rejection
 */
ToolbarEvent._notify = function(message, tabid) {
	return ToolbarEvent._buildResponse({notify: message}, tabid || true);
}


/**
 * Discover a new url.  This is usually not called directly.  
 * This is usually a side-effect of submit
 *
 * @param {MessageRequest} request
 * @param {chrome.runtime.MessageSender} sender
 * @return {Promise} toolbar config response
 */
ToolbarEvent._discover = function(request, sender) {
	return Page.getUrl(sender.tab.id)
		.then(function(url) {
			return ToolbarEvent.api.submit(url, request.data.nsfw, request.data.nolike)
				.then(function(url) {
					ToolbarEvent._notify("You discovered a new URL.");
					return url;
				});
		})
		.then(function(url) { 
			if (!sender.tab.incognito) {
				// Super hacky rewrite of urlid to make stuff work correctly
				if (!request.data.nolike)
					url.userRating = { type: 1, subtype: 0 };
				Page.note(sender.tab.id, Object.assign(url, {urlid: url.publicid})); 
			}
			ToolbarEvent._buildResponse({url: url}, sender.tab.id);
			return url;
		});
}

ToolbarEvent._generateModeInfo = function(request, sender) {
	if (config.mode == 'domain') {
		if (request.action == 'mode' || !(config.modeinfo || {}).domains)
			ToolbarEvent.cache.mset({ modeinfo: config.modeinfo = { domains: [ uriToDomain(sender.tab.url) ] } });
	} else if (config.mode == 'interest') {
		if (request.action == 'mode')
			ToolbarEvent.cache.mset({ modeinfo: config.modeinfo = { interests: [ request.data.interestid ], keyword: request.data.keyword } });
	} else if (config.mode == 'keyword') {
		if (request.action == 'mode')
			ToolbarEvent.cache.mset({ modeinfo: config.modeinfo = { keyword: request.data.keyword } });
	} else {
		ToolbarEvent.cache.mset({ modeinfo: config.modeinfo = {} });
	}
	return config.modeinfo;
}

ToolbarEvent.mouse = function(request, sender) {
	return ToolbarEvent._buildResponse(request, sender.tab.id);
}




ToolbarEvent._init();

