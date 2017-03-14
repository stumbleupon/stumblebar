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

var TRACE = {};

function uriToDomain(uri) {
	try {
		return uri.split("/")[2].split(":")[0].split("@").slice(-1)[0].split(".").slice(-2).join('.')
	} catch(e) {
		return false;
	}
}

function debug() {
	var e = new Error;
	var messages = ['DEBUG'].concat(Array.prototype.slice.call(arguments));
	if (arguments.length && arguments[arguments.length - 1] === TRACE)
		messages[messages.length - 1] = e.stack;
	console.log.apply(console.log, messages);
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
	this.match(/:[-_a-zA-Z0-9]+/g).forEach(function(key) {
		newstr = newstr.replace(key, map[key.slice(1)]);
	});
	return newstr;
}

Node.prototype.addClass = function(name) {
	if (!this.hasClass(name))
		this.className += ' ' + name;
	return this.className;
}

Node.prototype.removeClass = function(name) {
	return this.className = this.className.replace(RegExp('(\\s|^)' + name + '(\\s|$)'), ' ').trim();
}

Node.prototype.hasClass = function(name) {
	return this.className && this.className.match(RegExp('(\\s|^)' + name + '(\\s|$)'))
}

Node.prototype.changeClass = function(name, state) {
	return state ? this.addClass(name) : this.removeClass(name);
}

Node.prototype.toggleClass = function(name) {
	return this.changeClass(name, !this.hasClass(name));
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

/**
 * look up the template and use it to return a new element applying the given attributes and substitutions
 * @param {string} templateId
 * @param {Object} attributes
 * @param {string} Optional appendToElId -- if provided, append the newly created element to this
 */
function newFromTemplate(templateId, attributes, appendToElId) {
    /** @type {Element} */
    var template = document.getElementById(templateId),
        appendToEl = document.getElementById(appendToElId);
    if (!template || !template.classList.contains('stub')) {
        return false;
    }
    var el = template.cloneNode(true);
    el.classList.remove('stub');
    el.id = '';
    el.removeAttribute('hidden');
    for (var name in attributes) {
        var val = attributes[name];
        el[name] = val;
    }
    if (appendToEl) {
        appendToEl.appendChild(el);
    }

    return el;
}
function reldate(date, use) {
	return reltime(Math.floor((Date.now() - (new Date(date)).getTime()) / 1000), use);
}
function reltime(time, use) {
	var nicetime = [];
	if (time < 60)
		nicetime = { num: parseInt(time),            s: "s", m: 'sec', l: 'second'};
	else if (time < 3600)
		nicetime = { num: Math.floor(time/60),       s: "m", m: 'min', l: 'minute'};
	else if (time < 86400)
		nicetime = { num: Math.floor(time/3600),     s: "h", m: 'hr',  l: 'hour'  };
	else if (time < 31536000)
		nicetime = { num: Math.floor(time/86400),    s: "d", m: "day", l: "day"   };
	else
		nicetime = { num: Math.floor(time/31536000), s: "y", m: "yr",  l: "year"  };

	if (nicetime.num !== 1) {
		nicetime.md += 's';
		nicetime.lg += 's';
	}

	nicetime.text = nicetime.num + (use == 's' ? '' : ' ') + nicetime[use || 'm'];

	return nicetime;
}

function throttle(fn, threshhold, scope) {
	threshhold || (threshhold = 250);
	var last,
	deferTimer;
	return function () {
		var context = scope || this;

		var now = +new Date,
		args = arguments;
		if (last && now < last + threshhold) {
			// hold on to it
			clearTimeout(deferTimer);
			deferTimer = setTimeout(function () {
				last = now;
				fn.apply(context, args);
			}, threshhold);
		} else {
			last = now;
			fn.apply(context, args);
		}
	};
}


function debounce(fn, delay) {
	var timer = null;
	return function () {
		var context = this, args = arguments;
		clearTimeout(timer);
		timer = setTimeout(function () {
			fn.apply(context, args);
		}, delay || 250);
	};
}


function isScalar(x) {
	return (/string|number|boolean/).test(typeof x);
}
