const express = require('express');
const basicAuth = require('express-basic-auth');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);
var bodyParser = require('body-parser')
const fs = require('fs');
const FormData = require('form-data');
const request = require('request');
require('dotenv').config();

var nftName = "Painting";
var nftDescription = "Painting";
var chain = "polygon";

const USER = process.env.AUTH_USER;
const PASSWORD = process.env.AUTH_PASSWORD;
if (USER && PASSWORD) {
	let users = {};
	users[USER] = PASSWORD;
	app.use(basicAuth({
		users,
		challenge: true // show login dialog
	}));
	console.log(`Added basic auth: username = ${USER}`);
}

let PREFIX = process.env.URL_PREFIX || '/';
if (!PREFIX.startsWith('/')) {
	PREFIX = '/' + PREFIX;
}
if (!PREFIX.endsWith('/')) {
	PREFIX += '/';
}

// TODO: no-cache ?
app.use(PREFIX, express.static(__dirname + '/../frontend'));
app.use(express.json());
app.use(bodyParser.urlencoded({limit: '50mb', extended: true }));
//app.use(express.json())

let games = {
	// gameId: {
	// 	gameId,
	// 	clients: [{clientId, name}, ...],
	// 	clearColor: [r, g, b],
	// 	picture
	// }
};


// Broadcast list of games.
setInterval(() => {
	let gamesList = [];
	for (let gameId in games) {
		gamesList.push({
			id: gameId,
			started: games[gameId].started,
			players: games[gameId].clients.map(client => client.name)
		});
	}
	// Top: newest / bottom: oldest game
	gamesList.sort((a, b) => b.started - a.started);
	io.emit('games', {games: gamesList});
}, 3000);

// Cleanup idle games.
const DELETE_AFTER_IDLE_MSEC = parseInt(process.env.DELETE_AFTER_IDLE_SEC || 1000000) * 1000;
console.log(`DELETE_AFTER_IDLE_MSEC = ${DELETE_AFTER_IDLE_MSEC}`);
setInterval(() => {
	const now = Date.now();
	for (let gameId in games) {
		if (games[gameId].clients.length > 0) {
			continue; // not idle
		}
		const idleMsec = now - games[gameId].idleSince;
		if (idleMsec > DELETE_AFTER_IDLE_MSEC) {
			console.log('*TERMINATE game:', gameId);
			//delete games[gameId];
		}
	}
}, 3000);

function getGameId(msg, mustExist = true) {
	const gameId = msg && msg.gameId;
	if (!gameId || gameId.length !== 22) {
		return false;
	}
	if (mustExist && !games[gameId]) {
		return false;
	}

	return gameId;
}

io.on('connection', socket => {
	let socketClientId;
	console.log('Client connected!'); //, socket);

	socket.on('disconnect', () => {
		console.log('ON disconnect:', socketClientId);
		if (!socketClientId) {
			return;
		}

		for (let gameId in games) {
			games[gameId].clients = games[gameId].clients.filter(el => {
				return el.clientId !== socketClientId;
			});
			if (games[gameId].clients.length === 0) {
				games[gameId].idleSince = Date.now();
				//console.log('*TERMINATE game:', gameId);
				//delete games[gameId];
				console.log('*IDLE game:', gameId);
			}
		}
	});

	// socket.on('games', msg => {});

	socket.on('join', msg => {
		console.log('ON join:', msg);
		console.log('ON join > gameId  :', msg.gameId);
		console.log('ON join > clientId:', msg.clientId);
		console.log('ON join > name    :', msg.name);
		const gameId = getGameId(msg, false);
		if (!gameId) {
			console.error('on(join): Invalid game ID', msg && msg.gameId);
			return false;
		}

		socketClientId = msg.clientId;

		socket.join(gameId);
		games[gameId] = games[gameId] || {
			gameId,
			started: Date.now(),
			clients: [],
			clearColor: [255, 255, 255],
			picture: []
		};
		games[gameId].idleSince = undefined;
		games[gameId].clients.push({
			clientId: msg.clientId,
			name: msg.name
		});

		// Let new player get current painting:
		io.to(gameId).emit('picture', { picture: games[gameId].picture, clearColor: games[gameId].clearColor });
	});

	socket.on('clear', msg => {
		const gameId = getGameId(msg);
		if (!gameId) {
			console.error('on(clear): Invalid game ID', msg && msg.gameId);
			return false;
		}

		console.log('ON clear:', gameId, msg.color);
		games[gameId].clearColor = msg.color;
		games[gameId].picture = [];
		io.to(gameId).emit('clear', msg);
	});

	socket.on('draw', msg => {
		const gameId = getGameId(msg);
		if (!gameId) {
			console.error('on(draw): Invalid game ID', msg && msg.gameId);
			return false;
		}		
		if (!msg || !msg.gameId || !msg.client || (typeof msg.i) !== 'number' || !msg.color || !msg.path) {
			console.error('Invalid message', msg);
			return;
		}

		//console.log('ON draw:', msg);
		console.log('ON draw: gameId', gameId, 'client', msg.client, 'path.length', msg.path.length);
		games[gameId].picture.push(msg);
		io.to(gameId).emit('picture', { picture: games[gameId].picture, clearColor: games[gameId].clearColor });
	});
});

app.post('/mintnft', (req, res) => {
	var data = req.body.imageData.replace(/^data:image\/\w+;base64,/, "");
	var buf = Buffer.from(data, 'base64');
	var fileName = Math.random() + 'image.png';
	fs.writeFile(fileName, buf, function(err, result){
		const fileStream = fs.createReadStream(fileName);
		var formData = {
			file: fileStream
		}
		console.log("minting NFT now");
		const options = {
			url: 'https://api.nftport.xyz/v0/mints/easy/files?' + "chain=" + chain + "&name=" + nftName + "&description=" + nftDescription + "&mint_to_address=" + req.body.mintToAddress,
			headers: {
			  "Authorization": process.env.NFTPORT_KEY,
			  },
			  formData: formData
		  };
		   
		  function callback(error, response, body) {
			  console.log(response)
			if (!error && response.statusCode == 200) {
			  const info = JSON.parse(body);
			  console.log(info.stargazers_count + " Stars");
			  console.log(info.forks_count + " Forks");
			  //response.end();
			  res.send(response.body);
			}
			console.log(error)
			
		  }

		  request.post(options, callback);
	});
	
	

	//const form = new FormData();
	//const fileStream = fs.createReadStream('./Meme.png');
	//form.append('file', fileStream);
	//form.append('file', req.body.imageData);
	



	 




	//res.send('Hello World!')
})

const port = parseInt(process.env.PORT || 42024);
server.listen(port, () => console.log(`Frontend + Socket.IO listening on port ${port}, frontend prefix = ${PREFIX}`));

function sigHandler(sig) {
	console.log(`Got ${sig} - exit.`);
	process.exit(0);
}
process.on('SIGINT', sigHandler.bind(global, 'SIGINT'));
process.on('SIGTERM', sigHandler.bind(global, 'SIGTERM'));
