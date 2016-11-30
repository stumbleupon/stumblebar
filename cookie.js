var Cookie = function(config) {
	this.baseUrl = config.baseUrl;
}

Cookie.prototype = {
	get: function(name) {
    return new Promise(function(resolve, reject) {
      chrome.cookies.get({
          url:    'http://' + this.baseUrl,
          name:   name
        }, resolve
      )
    }.bind(this));
  },
}
