function AssertError(message) {
				this.message = message || 'Assertion Failed';
				var last_part = new Error().stack.match(/[^\s]+$/);
				this.stack = `${this.name} at ${last_part}`;
}
AssertError.prototype = Object.create(Error.prototype);
AssertError.prototype.name = "AssertError";
AssertError.prototype.message = "";
AssertError.prototype.constructor = AssertError;

var assert = assert || function (val, message) { if (!val) throw AssertError(message); }
var bt = bt || function(e) { var e = e || new Error(); console.log(e.stack); }

function debug() {
	var e = new Error;
	console.log('DEBUG', arguments, e.stack);
}
function warning() {
	var e = new Error;
	console.log('WARNING', arguments, e.stack);
}
function error() {
	var e = new Error;
	console.log('ERROR', arguments, e.stack);
}

String.prototype.form = function(map) {
	var newstr = this;
	this.match(/:[-_a-zA-Z0-9]+/).forEach(function(key) {
		newstr = newstr.replace(key, map[key.slice(1)]);
	});
	return newstr;
}

Element.prototype.addClass = function(name) {
	if (!this.hasClass(name))
		this.className += ' ' + name;
}

Element.prototype.removeClass = function(name) {
	this.className = this.className.replace(RegExp('(\\s|^)' + name + '(\\s|$)'), ' ').trim();
}

Element.prototype.hasClass = function(name) {
	return this.className.match(RegExp('(\\s|^)' + name + '(\\s|$)'))
}

Element.prototype.toggleClass = function(name) {
	this.hasClass(name) ? this.removeClass(name) : this.addClass(name);
}

String.prototype.numberFormat = function() {
	if (this < 1000)
		return this;
	else if (this < 10000)
		return Math.floor(parseInt(this) / 1000) + '.' + Math.floor(parseInt(this) / 100)%10 + 'k';
	else if (this < 1000000)
		return Math.floor(parseInt(this) / 1000) + 'k';
	else
		return Math.floor(parseInt(this) / 1000000, 1) + '.' + Math.floor(parseInt(this) / 100000)%10 + 'm';
}

