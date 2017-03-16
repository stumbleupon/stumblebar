function ToolbarError(type, name, error, context) {
	this.type  = type;
	this.name  = name;
	this.error = error;
	this.code  = code;

	this.stack = (new Error).stack;
}

var NOERR = new ToolbarError('NOERR');
