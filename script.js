//Game variables
let app;
let viewport;
const cellWidth = 64;
const cellHeight = 32;
const cellDepth = 16;

let appLeft = 0;
let appTop = 0;
let appWidth = window.innerWidth - 150;
let appHeight = window.innerHeight;

//Map default values
const mapDefaultSize = 16;
const mapDefaultReliefRange = [1, 3];
const mapDefaultChanceOfRelief = .1;
const mapDefaultChanceOfTree = .1;

//Colors
const colorRed = 0xff0000;
const colorOrange = 0xffa500;
const colorYellow = 0xffff00;
const colorGreen = 0x008000;
const colorBlue = 0x0000ff;
const colorIndigo = 0x4b0082;
const colorViolet = 0xee82ee;

//Players
let player;
let map;

window.onload = preload();
function preload(){
	app = new PIXI.Application({
		width: appWidth,
		height: appHeight, 
		antialias: false,
		forceFXAA: false,
		forceCanvas: false,
		clearBeforeRender: true,
		preserveDrawingBuffer: false,
		roundPixels: true
	});

	let div = document.getElementById('game');
	div.appendChild(app.view);

	app.view.addEventListener('contextmenu', (e) => {
		e.preventDefault();
	});
	
	//Preload assets
	app.loader.baseUrl = 'assets/images';
	app.loader
		.add('ressource/texture.json')
		.add('unit/657/texture.json')
		.add('unit/418/texture.json')
		.add('terrain/15001/texture.json')
	;

	app.loader.onProgress.add(showProgress);
	app.loader.onComplete.add(create);
	app.loader.onError.add(reportError);
	app.loader.load();
}
function showProgress(e){
	console.log(e.progress)
}
function reportError(e){
	document.getElementById('loading').innerText = 'ERROR: ' + e.message;
}
function create(){
	//Remove loading screen
	document.getElementById('loading').remove();
	
	//Init game
	player = new Player();
	map = new Map(mapDefaultSize, mapDefaultReliefRange, mapDefaultChanceOfRelief, mapDefaultChanceOfTree);
	app.stage.addChild(map);
	//Set-up global interactions
	const interactionManager = new PIXI.interaction.InteractionManager(app.renderer);
	interactionManager.on('rightdown', () => {
		for(let i = 0; i < player.selectedUnits.length; i++){
			player.selectedUnits[i].unselect();
		}
		player.selectedUnits = [];
	})
	//Start main loop
	app.ticker.add(step);
}


function step(){
	if (map){
		map.step();
	}
}
