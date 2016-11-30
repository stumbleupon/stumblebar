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

