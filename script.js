//Game variables
let app;
let viewport;
let cellWidth = 64;
let cellHeight = 32;
let cellDepth = 16;

let appLeft = 0;
let appTop = 0;
let appWidth = window.innerWidth - 150;
let appHeight = window.innerHeight;

//Map default values
const mapDefaultCols = 16;
const mapDefaultRows = 16;
const mapDefaultReliefRange = [1, 3];
const mapDefaultChanceOfRelief = .1;

//Colors
const colorRed = 0xff0000;
const colorOrange = 0xffa500;
const colorYellow = 0xffff00;
const colorGreen = 0x008000;
const colorBlue = 0x0000ff;
const colorIndigo = 0x4b0082;
const colorViolet = 0xee82ee;

//Players
let map;
let player = new Player();
let camera = {
	x: 0,
	y: 0
}
const texturesAnchor = {
	'000_001': [.25,.6],
	'000_002': [0,.6],
	'000_003': [0,.6],
	'000_004': [0,.7],
}
const spritesTree = Array.apply(null, Array(4)).map((val, index) => {
	return { name: `000_00${index + 1}`, url: `tree/000_00${index + 1}.png` }
});
const spritesGrass = Array.apply(null, Array(24)).map((val, index) => {
	let finalIndex = index + 1;
	if (finalIndex < 10){
		finalIndex = '00' + finalIndex;
	}else if (finalIndex < 100){ 
		finalIndex = '0' + finalIndex;
	}
	return { name: `${finalIndex}_15001`, url: `ground/${finalIndex}_15001.png` }
});
//Containers
let instances = new PIXI.Container();
instances.sortableChildren = true;

window.onload = preload();
function preload(){
	app = new PIXI.Application({
		width: appWidth,
		height: appHeight, 
		antialias: false 
	});

	let div = document.getElementById('game');
	div.appendChild(app.view);

	app.view.addEventListener('contextmenu', (e) => {
		e.preventDefault();
	});
	
	//Preload assets
	app.loader.baseUrl = "assets/images";
	app.loader
		.add('unit','unit.png')
		.add(spritesTree)
		.add(spritesGrass)
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
	console.log('ERROR: ' + e.message);
}
function create(){
	console.log('DONE LOADING !');
	app.stage.addChild(instances);
	//Init map
	map = new Map(mapDefaultCols, mapDefaultRows, mapDefaultReliefRange, mapDefaultChanceOfRelief);
	
	//Change camera position
	camera.x = -appWidth / 2;
	camera.y = -(appHeight / 2) + 200;	
	instances.x = -camera.x;
	instances.y = -camera.y;
	//Start main loop
	const interactionManager = new PIXI.interaction.InteractionManager(app.renderer);
	interactionManager.on('rightdown', (evt) => {
		for(let i = 0; i < player.selectedUnits.length; i++){
			player.selectedUnits[i].unselect();
		}
		player.selectedUnits = [];
	})
	app.ticker.add(step);
}
function moveCamera(){
	/**
	 * 	/A\
	 * /   \
	 *B     D
	 * \   /
	 *  \C/ 
	 */
	let mousePos = app.renderer.plugins.interaction.mouse.global;
	let moveSpeed = 10;
	let moveDist = 100;
	let A = {
		x:(cellWidth/2)-camera.x,
		y:-camera.y
	};
	let B = {
		x:(cellWidth/2-(map.cols * cellWidth)/2)-camera.x,
		y:((map.rows * cellHeight)/2)-camera.y
	};
	let D = {
		x:(cellWidth/2+(map.cols * cellWidth)/2)-camera.x,
		y:((map.rows * cellHeight)/2)-camera.y
	};
	let C = {
		x:(cellWidth/2)-camera.x,
		y:(map.rows * cellHeight)-camera.y
	};
	let cameraCenter = {
		x:((camera.x) + appWidth / 2)-camera.x,
		y:((camera.y) + appHeight / 2)-camera.y
	}
	//Left 
	if (mousePos.x >= appLeft && mousePos.x <= appLeft + moveDist && mousePos.y >= appTop && mousePos.y <= appHeight){
		if (cameraCenter.x - 100 > B.x && pointIsBeetweenTwoPoint(A, B, cameraCenter, 50)){
			camera.y += moveSpeed/(cellWidth/cellHeight);		
			camera.x -= moveSpeed;
		}else if (cameraCenter.x - 100 > B.x && pointIsBeetweenTwoPoint(B, C, cameraCenter, 50)){
			camera.y -= moveSpeed/(cellWidth/cellHeight);		
			camera.x -= moveSpeed;
		}else if (cameraCenter.x - 100 > B.x){
			camera.x -= moveSpeed;
		}
		refreshInstancesOnScreen();
	}else //Right
	if (mousePos.x > appWidth - moveDist && mousePos.x <= appWidth && mousePos.y >= appTop && mousePos.y <= appHeight){
		if (cameraCenter.x + 100 < D.x && pointIsBeetweenTwoPoint(A,D,cameraCenter,50)){
			camera.y += moveSpeed/(cellWidth/cellHeight);		
			camera.x += moveSpeed;
		}else if (cameraCenter.x + 100 < D.x && pointIsBeetweenTwoPoint(D,C,cameraCenter, 50)){
			camera.y -= moveSpeed/(cellWidth/cellHeight);		
			camera.x += moveSpeed;
		}else if (cameraCenter.x + 100 < D.x){
			camera.x += moveSpeed;
		}
		refreshInstancesOnScreen();
	}
	//Top
	if (mousePos.x >= appLeft && mousePos.x <= appWidth && mousePos.y >= appTop && mousePos.y <= appTop + moveDist){
		if (cameraCenter.y - 50 > A.y && pointIsBeetweenTwoPoint(A, B, cameraCenter, 50)){
			camera.y -= moveSpeed/(cellWidth/cellHeight);		
			camera.x += moveSpeed;
		}else if (cameraCenter.y - 50 > A.y && pointIsBeetweenTwoPoint(A, D, cameraCenter, 50)){
			camera.y -= moveSpeed/(cellWidth/cellHeight);		
			camera.x -= moveSpeed;
		}else if (cameraCenter.y - 50 > A.y){
			camera.y -= moveSpeed;
		}
		refreshInstancesOnScreen();
	}else //Bottom
	if (mousePos.x >= appLeft && mousePos.x <= appWidth && mousePos.y > appHeight - moveDist && mousePos.y <= appHeight){
		if (cameraCenter.y + 50 < C.y && pointIsBeetweenTwoPoint(D, C, cameraCenter, 50)){
			camera.y += moveSpeed/(cellWidth/cellHeight);		
			camera.x -= moveSpeed;
		}else if (cameraCenter.y + 50 < C.y && pointIsBeetweenTwoPoint(B, C, cameraCenter, 50)){
			camera.y += moveSpeed/(cellWidth/cellHeight);		
			camera.x += moveSpeed;
		}else if (cameraCenter.y + 100 < C.y){
			camera.y += moveSpeed;
		}
		refreshInstancesOnScreen();
	}
	function refreshInstancesOnScreen(){
		instances.x = -camera.x;
		instances.y = -camera.y;
		for (let i = 0; i < instances.children.length; i++){
			let instance = instances.children[i];
			if (instance.x + cellWidth > camera.x && instance.x < camera.x + appWidth && instance.y + cellHeight > camera.y && instance.y - cellHeight < camera.y + appHeight){
				instance.visible = true;
			}else{
				instance.visible = false;
				instance.interaction = false;
			}
		}
	}
}

function step(){
	moveCamera();
	for(let i = 0; i < instances.children.length; i++){
		if (typeof instances.children[i].step === 'function'){
			instances.children[i].step();
		}
	}
}
