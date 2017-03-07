function Conversation(config, id) {
	this.config = config;
	//this.cache = new Cache(config.defaults);
	this.api = new Api(config);
	this.id = id;
}

Conversation.prototype = {
	participants: function(ids) {
		return this.api.get(this.config.endpoint.participants, ids);
	},

	messages: function(since) {
		return this.api.get(this.config.endpoint.messages.form({ id: this.id }), { eventsSince: since || '1970-01-01T00%3A00%3A00-00%3A00' });
	},

	comment: function(message) {
		return this.api.req(this.config.endpoint.comment.form({ id: this.id }), { conversationId: this.id, message: message })
	}
}
