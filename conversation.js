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

	messages: function(stamp, type, limit) {
		return this.api.get(this.config.endpoint.messages.form({ id: this.id }), { ['events' + (type || 'since').replace(/(^.)/, function(x) { return x.toUpperCase(); })]: stamp || '1970-01-01T00%3A00%3A00-00%3A00', limit: limit || 20 });
	},

	comment: function(message) {
		return this.api.req(this.config.endpoint.comment.form({ id: this.id }), { conversationId: this.id, message: message })
	},

	/**
	 * save (create/share) a new conversation
	 * @param {ShareData} shareData
	 * @returns {*|Promise}
	 */
	save: function(shareData) {
		return this.api.req(this.config.endpoint.share, shareData, { method: 'POST' });
	},

	addRecipient: function(convoRecipientData) {
		return this.api.req(
			this.config.endpoint.addRecipient.form({ id: this.id }),
			convoRecipientData,
			{nonJSONResponse: true}
		).then(function(response) {
			response.conversationId = this.id;
			return response;
		}.bind(this));
	}
}
