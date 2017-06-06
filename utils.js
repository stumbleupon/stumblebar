var enableLogging = enableLogging || false;

var bt = bt || function(e) { var e = e || new Error(); console.log(e.stack); }

var TRACE = {};

// Lazy SLDs: curl https://en.wikipedia.org/wiki/Second-level_domain | grep '<li><b>' | sed -e 's/.*<li><b>//g' -e 's@</b>.*@@g' -e 's/^\.//g' | xargs echo | sed -e 's/ /","/g' -e 's/$/"];/' -e 's/^/var SLDs = ["/g'
// Good suffix list: https://publicsuffix.org/list/public_suffix_list.dat
var SLDs = ["asn.au","com.au","net.au","id.au","org.au","edu.au","gov.au","csiro.au","act.au","nsw.au","nt.au","qld.au","sa.au","tas.au","vic.au","wa.au","co.at","or.at","priv.at","ac.at","avocat.fr","aeroport.fr","veterinaire.fr","co.hu","film.hu","lakas.hu","ingatlan.hu","sport.hu","hotel.hu","nz","ac.nz","co.nz","geek.nz","gen.nz","kiwi.nz","maori.nz","net.nz","org.nz","school.nz","cri.nz","govt.nz","health.nz","iwi.nz","mil.nz","parliament.nz","ac.il","co.il","org.il","net.il","k12.il","gov.il","muni.il","idf.il","ac.za","gov.za","law.za","mil.za","nom.za","school.za","net.za","co.uk","org.uk","me.uk","ltd.uk","plc.uk","net.uk","sch.uk","ac.uk","gov.uk","mod.uk","nhs.uk","police.uk"];

function uriToDomain(uri, full) {
	try {
		var domain = uri.split("/")[2].split(":")[0].split("@").slice(-1)[0].toLowerCase();
		if (!full) {
			if (SLDs.includes(domain.split(".").slice(-2).join('.')))
				domain = domain.split(".").slice(-3).join('.');
			else
				domain = domain.split(".").slice(-2).join('.');
		}

		return domain;
	} catch(e) {
		return false;
	}
}

function debug() {
	var e = new Error;
	var messages = ['DEBUG'].concat(Array.prototype.slice.call(arguments));
	if (arguments.length && arguments[arguments.length - 1] === TRACE)
		messages[messages.length - 1] = e.stack;
	if (enableLogging)
		console.log.apply(console.log, messages);
}
function warning() {
	var e = new Error;
	if (enableLogging)
		console.log('WARNING', arguments, e.stack);
}
function error() {
	var e = new Error;
	if (enableLogging)
		console.log('%cERROR', 'color: red', arguments, e.stack);
}

String.prototype.eform = function(map) { return this.form(map, true); }
String.prototype.form = function(map, encode) {
	var newstr = this + '';
	(this.match(/:[-_a-zA-Z0-9]+/g) || []).forEach(function(key) {
		var val = map[key.slice(1)];
		if (encode)
			val = encodeURIComponent(val);
		newstr = newstr.replace(key, val);
	});
	return newstr;
}

Node.prototype.addClass = function(name) {
	if (!this.hasClass(name))
		this.className = (this.className + ' ' + name).trim();
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


function isEmailAddress(string) {
	var emailRE = /^[a-zA-Z0-9.!#$%&’*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;
	return emailRE.test(string);
}

/**
 * generate a 32 bit int from a string
 * @param str
 * @returns {number}
 */
function hashCode(str) {
	var hash = 0;
	for (var i = 0; i < str.length; i++) {
		hash = str.charCodeAt(i) + ((hash << 5) - hash);
	}
	return Math.abs(hash);
}

/**
 * return an rgb code (ie #142536) of a color on the darker side of gray
 * that is determined by the given string -- this will ensure that imageless
 * thumbnail backgrounds don't change color when replacing elements in response
 * to fresh data from background fetches
 * @param str
 * @returns {string}
 */
function strToDarkRGB(str) {
	var i = hashCode(str);
	var c = (i & 0x00FFFFFF)
		.toString(8)
		.substr(-6);
	switch (i % 12) {
		case 0:
			c = '00' + c.substr(-4);
			break;
		case 1:
			c = c.substr(0, 2) + '00' + c.substr(-2);
			break;
		case 2:
			c = c.substr(0, 4) + '00'
			break;
		case 3:
			c = '00' + c.substr(2, 2) + '00';
			break;
		case 4:
			c = '0000' + c.substr(-2);
			break;
		case 5:
			c = c.substr(0, 2) + '0000'
			break;
		case 6:
			c = '77' + c.substr(-4);
			break;
		case 7:
			c = c.substr(0, 2) + '77' + c.substr(-2);
			break;
		case 8:
			c = c.substr(0, 4) + '77'
			break;
		case 9:
			c = '77' + c.substr(2, 2) + '77';
			break;
		case 10:
			c = '7777' + c.substr(-2);
			break;
		case 11:
			c = c.substr(0, 2) + '7777'
			break;
	}
	return "#" + c;
}
