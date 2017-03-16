function Error(type, name, message, code) {
	this.type = type;
	this.name = name;
	this.message = message;
	this.code = code;
}

var NOERR = new Error('NOERR');
