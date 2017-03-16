function ToolbarError(type, name, error, context) {
	this.type    = type;
	this.name    = name;
	this.error   = error;
	this.context = context;

	this.stack   = (new Error).stack.replace(new RegExp(chrome.extension.getURL(''), 'g'), '').split("\n").slice(1).join("\n");
}

var NOERR = new ToolbarError('NOERR');
