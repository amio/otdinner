(function(){
	$.extend({
		replace: function(text,obj){
			return text.replace(/\{\$(\w+)\}/g,function(x,a){
				return obj.hasOwnProperty(a) ? obj[a] : x;
			})
		},
		tmpl: function(text,obj){
			return $($.replace(text,obj));
		}
	});
})();


/**
 * main
 */
$(function(){

	var Events = (function(){
		var eventNames = [
				'appInit',
				'addMe',        // request to server
				'addPerson',
				'removeMe',     // request to server
				'removePerson',
				'inputNameChanged',
				'error'
			],
			events = {};
		for(var i = eventNames.length; i--;){
			events[eventNames[i]] = $.Callbacks();
		}
		return events;
	})();

	var Module = (function(){
		// local name list
		var cloud = {},
			socket = io.connect(window.location.host),
			request = 'http://' + window.location.host + '/otdinner';

		// fire init event on connection
		socket.on('init-status',function(initStatus){
			Events['appInit'].fire(initStatus);
		});

		// msg for order add or remove
		socket.on('add-person',function(name){
			Events['addPerson'].fire(name);
		});
		socket.on('remove-person',function(name){
			Events['removePerson'].fire(name);
		});

		// msg for error
		socket.on('error',function(errObj){
			Events['error'].fire(errObj);
		});

		// msg on user count
		socket.on('user connected',function(num){
			View.updateOnlineCount(num);
		});
		socket.on('user disconnected',function(num){
			View.updateOnlineCount(num);
		});

		socket.on('reg-close',function(){
			View.disableReg();
		});
		socket.on('reg-open',function(){
			cloud = {};
			View.clearCloud();
			View.enableReg();
		});

		return {
			socket: socket,
			allowReg: true,

			/**
			 * Add a person to Module(local data).
			 * @param name
			 */
			addPerson: function (name) {
				// name is the index
				if(cloud[name]){
					return;
				}
				cloud[name] = true;
			},

			/**
			 * Remove a person from Module(local data).
			 * @param name {String}
			 */
			removePerson: function(name){
				delete cloud[name];
			},

			/**
			 * Request adding me to the list table(server side)
			 * @param name
			 */
			addMe: function(name){
				socket.emit('request-add-person',name);
			},

			/**
			 * Request removing me to the list table(server side)
			 * @param name
			 */
			removeMe: function(name){
				socket.emit('request-remove-person',name);
			},

			/**
			 * update localStorage
			 * @param name
			 */
			updateLocalStorage: function(name){
				localStorage.setItem("user-name", name);
			},

			getCount: function(){
				var ret = 0;
				for(var p in cloud){
					if(cloud.hasOwnProperty(p)){
						ret++;
					}
				}
				return ret;
			}
		}
	})();
	
	var View = (function(){
		var $nameInput = $('#name-input'),
			$signupBtn = $('#signup'),
			$cloudDiv = $('#list'),
			$msgArea = $('#msg'),
			$listCount = $('#listCount'),
			$onlineCount = $('#onlineCount'),
			cloudTemplate = '<div class="person alert {$type}" data-name="{$name}">\
								<button class="close">&times;</button>\
								<p class="p-name">{$name}</p>\
							</div>';
		return {
			nameInput: $nameInput,
			signupBtn: $signupBtn,
			cloudDiv : $cloudDiv,

			/**
			 * Init the View
			 */
			init:function(initStat){
				// init name from localStorage
				var myName = localStorage.getItem('user-name');
				if(myName){
				    $nameInput.val();
				    View.updateCloudByMyName();
				}

				// check allowReg stat
				if(!initStat['allowReg']){
					View.disableReg();
					$nameInput[0].blur();
				}

				View.updateCount();
				View.updateOnlineCount(initStat['onlineCount']);
			},

			/**
			 * add person to cloud html element
			 * @param name
			 */
			cloudAddOne: function(name){
				$.tmpl( cloudTemplate, {
					"name" : name,
					"type" : name == $nameInput.val() ? 'alert-success' : 'alert-default'
				}).appendTo( $cloudDiv );
				View.updateCount();
			},

			/**
			 * remove person from cloud html element
			 * @param name
			 */
			cloudRemoveOne: function(name){
				var personNode = $cloudDiv.find('[data-name=' + name + ']');
				personNode.remove();
				View.updateCount();
			},

			/**
			 * pop an alert msg
			 * @param msg
			 */
			alert: function(msg){
				(function(msg){
					var $el = $('<div class="alert alert-error">'+msg+'</div>').appendTo($msgArea).slideDown('fast');
					setTimeout(function(){
						$el.slideUp('fast',function(){
							this.parentNode.removeChild(this);
						})
					},3000)
				})(msg);
			},

			/**
			 * If user change name input, the highlight item in cloud list will update with it
			 * @param name
			 */
			updateCloudByMyName: function(name){
				var crowd = $cloudDiv.children();
				for(var i = crowd.length, one; i--, one = crowd[i];){
					if(name == 'whosyourdaddy'){
						one.className = 'person alert alert-success';
					}else{
						one.className = 'person alert alert-'
							+ (one.getAttribute('data-name') == name ? 'success' : 'default')
					}
				}
			},

			/**
			 * disable input on deadline
			 */
			disableReg: function(){
				if(Module.allowReg){
					$('#signup').attr('disabled','disabled');
					$('#name-input').attr('disabled','disabled');
					View.alert('订餐已截止');
					Module.allowReg = false;
				}
			},

			/**
			 * enable inputs, maybe we need this?
			 */
			enableReg: function(){
				if(!Module.allowReg){
					$('#signup').removeAttr('disabled');
					$('#name-input').removeAttr('disabled');
				}
			},

			updateCount: function(){
				$listCount.html(Module.getCount());
			},

			updateOnlineCount: function(num){
				$onlineCount.html(num);
			},

			clearCloud: function(){
				$cloudDiv.html('');
			}
		}
	})();

	/**
	 * Init Events and everything
	 * @type {*}
	 */
	var Controller = (function(){
		Events['appInit'].add(function(initStatus){
			// init list
			for (var p in initStatus['currentList']) {
				if (initStatus['currentList'].hasOwnProperty(p)) {
					Events['addPerson'].fire(p);
				}
			}

			// init view
			View.init(initStatus);
		});

		Events['addMe'].add(Module.addMe);
		Events['addPerson'].add(Module.addPerson,View.cloudAddOne);

		Events['removeMe'].add(Module.removeMe);
		Events['removePerson'].add(Module.removePerson,View.cloudRemoveOne);

		Events['inputNameChanged'].add(Module.updateLocalStorage, View.updateCloudByMyName);

		Events['error'].add(function (errObj) {
			switch (errObj['code']) {
				case '001':
					View.alert(errObj['msg']);
					break;
				default:
					console.log('Error:', errObj['code'], errObj);
			}
		});

		// main button event
		$('#form').on('submit', function (e) {
			e.preventDefault();
			var name = $('#name-input').val();
			Events['addMe'].fire(name);
		});

		View.cloudDiv.on('click', function(e){
			var tar = e.target;
			if(tar.nodeName == 'BUTTON'){
				var name = tar.parentNode.getAttribute('data-name');
				Events['removeMe'].fire(name);
			}
		});

		View.nameInput.on('input', function(e){
			var name = e.target.value;
			Events['inputNameChanged'].fire(name);
		});
	})();

	window.View = View;
});