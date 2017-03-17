var Settings = {
	buildSettings: function(data) {
		if (!data || !data.config)
			return;
		var config = data.config;
		var body = document.getElementById('settings-body');
		for (p in config) {
			var isScalar = isScalar(config[p]);
			var elem = document.getElementById(p);
			isScalar = false;
			var value = config[p];
			if (!isScalar)
				value = JSON.stringify(value);
			if (!elem) {
				var tr = document.createElement('tr');
				var name = document.createElement('td');
				name.innerText = p;
				tr.appendChild(name);
				var val = document.createElement('td');
				//if (isScalar)
				var input = document.createElement('input');
				input.setAttribute('data-type', isScalar ? 'scalar' : 'object');
				input.setAttribute('name', p);
				input.setAttribute('id', p);
				input.setAttribute('type', text);
				input.style = 'max-width: 100%; width: 640px';
				val.appendChild(input);
				tr.appendChild(val);
				body.appendChild(tr);
				elem = document.getElementById(p);
				document.addEventListener('change', Settings.update);
			}
			elem.value = value;
		}
	},

	update: function(e) {
		var elem = e.target || e.currentTarget;
		chrome.runtime.sendMessage({
			action: 'updateConfig',
			url: {},
			data: { [elem.name] : ( elem.getAttribute('data-type') == 'scalar' ) ? elem.value : JSON.parse(elem.value) }
		}, Settings.buildSettings);
	},

	init: function() {
		chrome.runtime.sendMessage({
			action: 'init',
			url: {},
			data: {}
		}, Settings.buildSettings);
		chrome.runtime.onMessage.addListener(Settings.buildSettings);
	}
}

Settings.init();
