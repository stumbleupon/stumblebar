/**
 * Data model for a list of contacts
 * @param {Array<Contact>} contacts
 * @param {string|number} ownerContactId -- id of the owner of the list, owner can not be added to their own list
 * @constructor
 */
function ContactList(ownerContactId, contacts, source) {
	this.ownerContactId = ownerContactId;
	this.contacts = [];
	if(contacts) {
		this.addMultiple(contacts, true, source);
	}
}

/**
 * @typedef {Object} ContactFilter
 * @property {Array<string>} contactIds
 * @property {boolean} isParticipant
 */

/**
 * @typedef {Object} AttributeMap
 * @property {string} attributeName -- the name of an attribute to search for
 * @property {string} propertyName -- the name of a property of the contact object to use as the value for rendering
 */

/**
 *
 * @type {{add: ContactList.addContact, remove: ContactList.removeContact, render: ContactList.renderContactList}}
 */
ContactList.prototype = {
	/**
	 * Add a contact to the list
	 * @param contactId
	 * @param name
	 * @returns {Contact}
	 */
	add: function addContact(contactId, name, overwrite, source, thumbnail) {
		var contact, lastAccess = Date.now(), emailRE = /^[a-zA-Z0-9.!#$%&’*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;
		if(source === "email" && (!emailRE.test(name) || name !== decodeURIComponent(contactId))) {
			return false;
		}
		if(contactId == this.ownerContactId) {
			return false;
		}
		if(contact = this.get(contactId)) {
			if(!overwrite) {
				return false;
			} else {
				lastAccess = contact.lastAccess; // this must be preserved in local storage
				this.remove(contactId);
			}
		}
		contact = new Contact(contactId, name, source, lastAccess, thumbnail);
		this.contacts.push(contact);
		return contact;
	},
	/**
	 * add contacts from an array of contact-like objects.  preserves existing contacts by default
	 * @param {Array<Object>} contacts
	 * @param {boolean} overwrite -- true to update existing with new values
	 * @param {string} source -- 'mutual' or 'email'
	 */
	addMultiple: function(contacts, overwrite, source) {
		if(contacts && contacts.forEach) {
			contacts.forEach(function(contact) {
				var name = contact.name ? contact.name + " (" + contact.username + ")" : contact.username,
					isParticipant = !!contact.isParticipant,
					thumbnail = contact.thumbnail || null;
				this.add(contact.userid, name, overwrite, source, thumbnail);
			}.bind(this));
			this.sort();
		}
	},
	/**
	 * get a contact by id
	 * @param contactId
	 * @returns {Contact}
	 */
	get: function getContact(contactId) {
		return this.contacts.find(function(contact) {
			return contact.userid == contactId;
		});
	},
	/**
	 * Remove a contact from the list
	 * @param contactId
	 */
	remove: function removeContact(contactId) {
		this.contacts.splice(this.contacts.findIndex(function(contact) {
			return contact.userid == contactId;
		}), 1);
	},
	/**
	 * return an array of contacts
	 * @param {Function} filter -- a function that accepts a contact object and returns true to include it
	 * @return {Array<Contact>}
	 */
	find: function _findContacts(filter) {
		var contacts = [],
			include = false,
			contact;
		if(typeof filter === "function") {
			return this.contacts.filter(filter);
		}
		// @TODO: Throw an error here or something
	},
	/**
	 * sort the array
	 */
	sort: function sortContacts() {
		this.contacts.sort(this.compare);
	},
	/**
	 * a comparator for sorting by most recently contacted first, then by name for contacts with same last access.
	 * @param oneContact
	 * @param anotherContact
	 * @returns {number}
	 */
	compare: function(oneContact, anotherContact) {
		if(oneContact.lastAccess === anotherContact.lastAccess) {
			return (oneContact.name.toUpperCase() < anotherContact.name.toUpperCase()) ? -1 : 1;
		} else {
			return (oneContact.lastAccess < anotherContact.lastAccess) ? 1 : -1;
		}
		return 0;
	},
	/**
	 * use a given stub to render the selected contacts to an element in the dom
	 * @param {string} stubId
	 * @param {Array<AttributeMap>} attributeMappings what are the attribute keys to be applied
	 * @param {string} appendToElementId
	 * @param {Function} filter -- Optional -- a function that accepts a contact object and returns true to include it
	 */
	render: function renderContactList(stubId, attributeMappings, appendToElementId, filter) {
		var appendToElement = document.getElementById(appendToElementId);
		if(!appendToElement) {
			return false;
		}
		var contacts = this.contacts;
		appendToElement.innerHTML = '';
		if(filter) {
			contacts = this.find(filter);
			contacts.forEach(function(contact) {
				contact.render(stubId, attributeMappings, appendToElementId);
			});
		} else {
			for(var i = 0; i < this.contacts.length; i++) {
				var contact = this.contacts[i];
				contact.render(stubId, attributeMappings, appendToElementId);
			}
		}
	},
	/**
	 * perform a case-insensitive pattern match against the names in the contact list, returning an array of the userids
	 * @param {string} searchText -- the text to search
	 * @returns {Array<number>} -- array of user ids
	 */
	search: function searchContacts(searchText) {
		var searchRegEx =  new RegExp(searchText, "i");
		return this.contacts.filter(function(contact) {
			return searchRegEx.test(contact.name);
		}).map(function(contact) {
			return parseInt(contact.userid);
		});
	},
	/**
	 * restore this ContactList by setting it's properties from an object.
	 * @param {Object} contactsObject -- an object with name/value properties such as would result from running a Contact through a JSON stringifying/parse cycle.
	 */
	reconstitute: function reconstitute(contactsObject) {
		this.ownerContactId = contactsObject.ownerContactId;
		if(contactsObject.hasOwnProperty('contacts') && typeof contactsObject.contacts === "object" && contactsObject.contacts instanceof Array) {
			this.contacts = contactsObject.contacts.map(function(contactObj) {
				var contact = new Contact();
				contact.reconstitute(contactObj);
				return contact;
			});
		}
	}
};

/**
 * Data model for a contact
 * @param {string} id -- userId of the contact
 * @param {string} name -- user's name for display purposes
 * @param {boolean} isParticipant -- a flag to identify participants in a given context for filtering.
 * @param {string} source -- source of the contact (email -> cached email contacts, mutual -> mutual followers api endpoint)
 * @param {number} lastAccess -- timestamp of the last access, intended to persist across sessions via cache
 * @constructor
 */
function Contact(id, name, source, lastAccess, thumbnail) {
	this.id = id;
	this.userid = id;
	this.name = name;
	this.participant = false; // always when creating -- participant status is used only on front-end
	this.source = source || 'unknown';
	this.lastAccess = lastAccess || 0;
	this.thumbnail = thumbnail;
}

Contact.prototype = {
	/**
	 * set the user's participant status
	 * @param isParticpant
	 */
	setParticipant: function setParticipant(isParticipant) {
		this.participant = isParticipant;
	},
	/**
	 * get the user's participant status
	 * @returns {Contact.isParticipant}
	 */
	isParticipant: function isParticipant() {
		return this.participant;
	},
	/**
	 *
	 * @param {HTMLElement} stubId
	 * @param {Array<AttributeMap>} attributeMappings
	 * @param {HTMLElement} appendToElementId
	 */
	render: function renderContact(stubId, attributeMappings, appendToElementId) {
		var el, attributes = {};
		attributeMappings.forEach(function(attributeMap) {
			attributes[attributeMap.attributeName] = this[attributeMap.propertyName];
		}.bind(this));
		for(var name in attributes) {
			var value = attributes[name];
			if(value == '') {
				return false;
			}
		}
		el = newFromTemplate(stubId, attributes, appendToElementId);
		this.addThumbnail(el);
	},
	/**
	 * update the lastAccessed property of the contact.  this property is intended to be persisted across
	 * sessions in the cache and used for sorting
	 * @param timestamp
	 */
	touch: function touchContact(timestamp) {
		var lastAccessed;
		if(typeof timestamp === "number") {
			lastAccessed = timestamp;
		} else {
			lastAccessed = Date.now();
		}
		this.lastAccess = lastAccessed;
	},
	/**
	 * Is this one of the user's contacts, or is it from some other source?  Contacts added from the "mutual"
	 * endpoint and contacts added from "email" are the user's own contacts -- contacts added from a "convo"
	 * are not to be displayed for purposes of creating new shares and adding contacts to a conversation, but
	 * they should appear in the participant list.
	 * @returns {boolean}
	 */
	isMine: function isMyContact() {
		return (['mutual', 'email'].indexOf(this.source) > -1);
	},
	/**
	 * restore this Contact by setting it's properties from an object.
	 * @param {Object} contactObject -- an object with name/value properties such as would result from running a Contact through a JSON stringifying/parse cycle.
	 */
	reconstitute: function reconstitute(contactObject) {
		this.id = contactObject.id;
		this.userid = contactObject.id;
		this.name = contactObject.name;
		this.participant = contactObject.participant;
		this.source = contactObject.source;
		this.lastAccess = contactObject.lastAccess;
		this.thumbnail = contactObject.thumbnail;
	},
	addThumbnail: function _addThumbnail(el) {
		var span = document.createElement('span');
		span.addClass('contact-thumbnail');
		if(this.thumbnail) {
			span.style.backgroundImage = "url('" + this.thumbnail + "')";
		} else {
			span.style.backgroundColor = "rgb(" + parseInt(Math.random() * 128) + "," + parseInt(Math.random() * 128) + "," + parseInt(Math.random() * 128) + ")";
			span.innerText = this.name[0].toUpperCase();
		}
		el.appendChild(span);

	}
};