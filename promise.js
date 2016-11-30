function P(p) {
	var _resolve, _reject;
	var _promise = new Promise(function(resolve, reject) {
		_resolve = resolve;
		_reject = reject;
	})
	p.then(_resolve, _reject)
	return _promise;
}
