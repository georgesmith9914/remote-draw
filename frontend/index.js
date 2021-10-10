let games = [];

// const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
// const backendUrl = isLocal ?
// 	`${window.location.protocol}//${window.location.hostname}:42023` :
// 	`${window.location.protocol}//backend.${window.location.host}`;
// console.log('Connecting to backend', backendUrl);
// let socket = io(backendUrl);
let socket = io();

function getName() {
	let nameInput = document.getElementById('name');
	console.log(nameInput);
	return nameInput.value.trim();
}
function loadName() {
	let nameInput = document.getElementById('name');
	let lastName = localStorage.getItem('name');
	if (lastName) {
		nameInput.value = lastName;
	}
}
function saveName() {
	let nameInput = document.getElementById('name');
	localStorage.setItem('name', nameInput.value.trim());
}

function joinGame(id) {
	console.log('Join painting', id);
	if (typeof window.ethereum !== 'undefined') {
		console.log('MetaMask is installed!');
		getAccount(id);
		//$(this).html("Connected");
	}else{
		alert("Please install Metamask.");
	}
}

function startGame() {
	console.log('Start painting');
	/*saveName();
	const nameUrl = encodeURIComponent(getName());
	window.location.href = `draw.html?start&name=${nameUrl}`;*/
	//console.log('Join painting', id);
	if($("#painting-name").val() == ""){
		alert("Enter painting name");
	}else{
		localStorage.setItem("paintingName",$("#painting-name").val()); 
		if (typeof window.ethereum !== 'undefined') {
			console.log('MetaMask is installed!');
			getAccount();
			//$(this).html("Connected");
		}else{
			alert("Please install Metamask.");
		}
	}

}

function enable(elem, doEnable) {
	if (!doEnable) {
		elem.disabled = 'disabled';
	} else {
		elem.removeAttribute('disabled');
	}
}

function updateGames(msg) {
	console.log('updateGames()', msg.games);
	games = msg.games;
	const name = getName();
	console.log('Name', name);

	let gamesList = document.getElementById('games-list');
	gamesList.innerHTML = games.length > 0 ? '' : '<li>(none)</li>';
	for (let game of games) {
		let li = document.createElement('li');
		let ago = timeago.format(game.started);
		//let players = game.players.length > 0 ? game.players.join(', ') : '- no painters -';
		let players = game.players.length > 0 ? game.players.join(', ') : '';
		li.textContent = 'Started ' + ago + ' (' + players + ') ';
		if(game.players.length > 0){
			li.textContent = 'Started ' + ago + ' (' + players + ') ';
			li.className = "high-margin";
		}else{
			li.textContent = 'Started ' + ago + " ";
			li.className = "high-margin";
		}
		let button = document.createElement('button');
		button.textContent = 'Join doodle';
		button.className = "btn btn-lg btn-outline-primary"


		button.onclick = joinGame.bind(window, game.id); 
		enable(button, !!name);
		li.appendChild(button);
		gamesList.appendChild(li);
	}

	let startGameButton = document.getElementById('new-game');
	enable(startGameButton, !!name);
	let nameLabel = document.getElementById('name-label');
	nameLabel.style.color = name ? '#000' : '#f00';
}

async function getAccount(id) {
	const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
	const account = accounts[0];
	accountHere = account;
	console.log(account);
	saveName();
	localStorage.setItem("walletAddress", account); 
	const nameUrl = encodeURIComponent(getName());
	if(id){
		window.location.href = `draw.html?join=${id}&name=${nameUrl}`;
	}else{
		window.location.href = `draw.html?start&name=${nameUrl}`;
	}

}

function updateName() {
	updateGames({games});
}

socket.on('games', updateGames);

window.onload = function onload() {
	loadName();
	$("#painting-name").val("abc")
	//updateGames({games});
	// updateGames({ games: [
	// 	{
	// 		id: 'abcde',
	// 		players: ['Foo', 'bar', 'booo']
	// 	},
	// 	{
	// 		id: 'zzzzzz',
	// 		players: ['77777', 'ääää', '0000']
	// 	},
	// ]});

	// setInterval(() => {
	// 	console.log('Emit games');
	// 	socket.emit('games', {});
	// }, 5000);
};
