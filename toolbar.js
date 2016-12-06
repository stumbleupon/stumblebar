Element.prototype.addClass = function(name) {
	this.className += ' ' + name;
}

Element.prototype.removeClass = function(name) {
	this.className = this.className.replace(RegExp('(\\s|^)' + name + '(\\s|$)'), ' ');
}

var Toolbar = {
	event: function(e) {
		/*
		console.log(e);
		//chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
		//console.log(tabs[0])
		//  chrome.tabs.sendMessage(tabs[0].id, {greeting: "hello"}, function(response) {
		//    console.log(response);
		//  });
		//});
		//  chrome.tabs.getSelected(null, function(tab) {
		chrome.runtime.sendMessage({greeting: "stumble"}, function(response) {
			console.log('moop',response);
		});
		//  });
		*/
	},

	handleUrl: function(url) {
		Toolbar.url = url;
		document.querySelector("#like")   .removeClass("enabled");
		document.querySelector("#dislike").removeClass("enabled");
		if (url.userRating.type >= 1)
			document.querySelector("#like").addClass("enabled");
		if (url.userRating.type <= -1)
			document.querySelector("#dislike").addClass("enabled");
	},

	handleResponse: function(r) {
		console.log('HANDLE', r);
		if (r.url) {
			Toolbar.handleUrl(r.url);
		}
		return true;
	},
	dispatch: function(a) {
		return new Promise(function (resolve, reject) {
			chrome.runtime.sendMessage({
				action: a,
				url: Toolbar.url || {}
			}, resolve);
		});
	},
	handleEvent: function(e) {
		if (!e.target.getAttribute('action'))
			return;
		console.log(e.target.getAttribute('action'));
		Toolbar.dispatch(e.target.getAttribute('action'))
			.then(Toolbar.handleResponse);
	},
	init: function() {
		document.getElementById("toolbar").addEventListener("click", Toolbar.handleEvent);
		chrome.runtime.onMessage.addListener(Toolbar.handleResponse);
		this.dispatch('urlChange');
		//Toolbar._events.forEach(function(entry) {
		//	document.getElementById(entry.id).addEventListener(entry.ev, Toolbar[entry.cb])
		//});
	},
	_events: [{ ev: 'click', id: 'stumble', cb: 'stumble' }]
}
Toolbar.init();

