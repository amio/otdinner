/**
 * Module dependencies.
 */

var express = require('express'),
	routes = require('./routes'),
	http = require('http'),
	path = require('path');

var app = express();

app.configure(function () {
	app.set('port', process.env.PORT || 3000);
//	app.set('views', __dirname + '/views');
//	app.set('view engine', 'jade');
	app.use(express.favicon());
	app.use(express.logger('dev'));
	app.use(express.bodyParser());
	app.use(express.methodOverride());
	app.use(app.router);
	app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function () {
	app.use(express.errorHandler());
});

/**
 * Main request handler
 * @type {Object}
 */
var otlistReg = {}, allowReg = true, onlineCount = 0;
app.get('/otdinner/:op/:name?', function (req, res) {
	var op = req.params.op,
		name = req.params.name;
	res.writeHead(200, {'Content-Type': 'application/json'});
	switch (op) {
		case 'get':
			res.write(JSON.stringify({
				status: 'success',
				op: 'get',
				table: otlistReg
			}));
			break;
		case 'add':
			if (otlistReg[name]) {
				res.write(JSON.stringify({
					status: 'Error:001',
					msg: 'User already on the list.',
					op: 'add',
					person: name,
					table: otlistReg
				}));
			}else{
				otlistReg[name] = true;
				res.write(JSON.stringify({
					status: 'success',
					op: 'add',
					person: name,
					table: otlistReg
				}));
			}
			break;
		case 'remove':
			if (otlistReg[name]) {
				delete otlistReg[name];
				res.write(JSON.stringify({
					status: 'success',
					op: 'remove',
					person: name,
					table: otlistReg
				}));
			}
			break;
	}
	res.end();
});

var server = http.createServer(app).listen(app.get('port'), function () {
	console.log("Express server listening on port " + app.get('port'));
});

/**
 * Socket.IO
 */
var io = require('socket.io').listen(server);

// assuming io is the Socket.IO server object
// for Heroku [https://devcenter.heroku.com/articles/using-socket-io-with-node-js-on-heroku]
io.configure(function () {
  io.set("transports", ["xhr-polling"]);
  io.set("polling duration", 10);
});


io.sockets.on('connection', function (socket) {
	onlineCount++;
	io.sockets.emit('user connected', onlineCount);

	// emit current list on connection
	socket.emit('init-status',{
		allowReg: allowReg,
		currentList: otlistReg,
		onlineCount: onlineCount
	});

	// on request-add-person
	socket.on('request-add-person', function (name) {
		if(otlistReg[name]){
			socket.emit('error',{
				code: '001',
				msg: 'You already on the list.'
			});
		}else{
			otlistReg[name] = true;
			io.sockets.emit('add-person',name);
		}
	});

	// on request-remove-person
	socket.on('request-remove-person', function (name) {
		if(otlistReg[name]){
			delete otlistReg[name];
			io.sockets.emit('remove-person',name);
		}
	});

	// on disconnect
	socket.on('disconnect', function () {
		onlineCount--;
		io.sockets.emit('user disconnected', onlineCount);
	});
});

var checkEnable = function(){
	var eh = 17, em = 30; // deadline at 5:30 PM

	var h = (new Date).getHours(),
		m = (new Date).getMinutes();
	return (h < eh || h == eh && m < em);
};

var waitClose = function(){
	var intv = setInterval(function(){
		if(!checkEnable()){
			io.sockets.emit('reg-close');
			allowReg = false;
			clearInterval(intv);
			waitOpen();
		}
	},900);
};

var waitOpen = function(){
	var intv = setInterval(function(){
		if(checkEnable()){
			io.sockets.emit('reg-open');
			allowReg = true;
			clearInterval(intv);
			waitStop();
		}
	},900);
};

waitClose();