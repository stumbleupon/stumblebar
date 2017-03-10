/**
 * Data model for a list of contacts
 * @param {Array<Contact>} contacts
 * @constructor
 */
function ContactList(contacts) {
    this.contacts = {};
    this.addMultiple(contacts);
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
    add: function addContact(contactId, name, isParticipant) {
        return this.contacts[contactId] = new Contact(contactId, name, isParticipant);
    },
    /**
     *
     * @param {Array<Object>} contacts
     */
    addMultiple: function(contacts) {
        if(contacts.forEach) {
            contacts.forEach(function(contact) {
                var name = contact.name ? contact.name + " (" + contact.username + ")" : contact.username,
                    isParticipant = !!contact.isParticipant;
                this.add(contact.userid, name, isParticipant);
            }.bind(this));
        }
    },
    /**
     * get a contact by id
     * @param contactId
     * @returns {Contact}
     */
    get: function getContact(contactId) {
        return this.contacts[contactId];
    },
    /**
     * Remove a contact from the list
     * @param contactId
     */
    remove: function removeContact(contactId) {
        delete this.contacts[contactId];
    },
    /**
     * return an array of contacts
     * @param {ContactFilter} filter
     * @return {Array<Contact>}
     */
    find: function findContacts(filter) {
        var contacts = [],
            include = false,
            contact;
        if(filter.contactIds)  {
            filter.contactIds.forEach(function(contactId) {
                include = false;
                contact = this.contacts[contactId];

                if(!contact) {
                    return;
                } else if(typeof(filter.isParticipant) === 'undefined') {
                    include = true;
                } else {
                    include = (filter.isParticipant === contact.isParticipant());
                }
                if(include) {
                    contacts.push(contact);
                }
            }.bind(this));
        } else if(typeof(filter.isParticipant) !== 'undefined') {
            for(var id in this.contacts) {
                contact = this.contacts[id];
                if(filter.isParticipant === contact.isParticipant()) {
                    contacts.push(contact);
                }
            }
        }
        return contacts;
    },
    /**
     * use a given stub to render the selected contacts to an element in the dom
     * @param {string} stubId
     * @param {Array<AttributeMap>} attributeMappings what are the attribute keys to be applied
     * @param {string} appendToElementId
     * @param {ContactFilter} filter Optional
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
            for(id in this.contacts) {
                var contact = this.contacts[id];
                contact.render(stubId, attributeMappings, appendToElementId);
            }
        }
    }
};

/**
 * Data model for a contact
 * @param id
 * @param name
 * @constructor
 */
function Contact(id, name, isParticipant) {
    this.id = id;
    this.userid = id;
    this.name = name;
    this.participant = !!isParticipant;
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
        var attributes = {};
        attributeMappings.forEach(function(attributeMap) {
            attributes[attributeMap.attributeName] = this[attributeMap.propertyName];
        }.bind(this));
        for(var name in attributes) {
            var value = attributes[name];
            if(value == '') {
                return false;
            }
        }
        newFromTemplate(stubId, attributes, appendToElementId);
    }
};