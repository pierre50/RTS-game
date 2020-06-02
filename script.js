
//Settings
const cellWidth = 64;
const cellHeight = 32;
const cellDepth = 16;

const ua = window.navigator.userAgent.toLowerCase();
const isMobile = ua.indexOf('mobile') !== -1 || ua.indexOf('android') !== -1;

const appLeft = 0;
const appTop = 0;
const appWidth = window.innerWidth;
const appHeight = window.innerHeight;
const gamebox = document.getElementById('game');

const maxSelectUnits = 25;

//Map default values
const mapDefaultSize = 200;
const mapDefaultReliefRange = [1, 2];
const mapDefaultChanceOfRelief = .01;
const mapDefaultChanceOfSets = .02;
const mapRevealEverything = true;

//Colors
const colorWhite = 0xffffff;
const colorBlack = 0x000000;
const colorGrey = 0x808080;
const colorRed = 0xff0000;
const colorOrange = 0xffa500;
const colorYellow = 0xffff00;
const colorGreen = 0x008000;
const colorBlue = 0x0000ff;
const colorIndigo = 0x4b0082;
const colorViolet = 0xee82ee;
const colorBone = 0xe2dac2;
const colorShipgrey = 0x3c3b3d;

//Game variables
let app;
let map;
let mouseRectangle;
let mouseBuilding;
let pointerStart;
let empires;

window.onload = preload();
function preload(){
	PIXI.settings.ROUND_PIXELS = true;
	app = new PIXI.Application({
		width: appWidth,
		height: appHeight, 
		antialias: false,
		resolution: window.devicePixelRatio, 
		autoResize: true
	});

	//Set loading screen
	let loading = document.createElement('div');
	loading.id = 'loading';
	loading.textContent = 'Loading..';
	Object.assign(loading.style, {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		height: '100%'
	});
	gamebox.appendChild(loading);

	//Disable contextmenu on rightclick
	gamebox.setCursor = (status) => {
		const icons = {
			default: "url('data/interface/51000/000_51000.png'),auto",
			hover: "url('data/interface/51000/003_51000.png'),auto",
		}
		gamebox.style.cursor = icons[status];
		gamebox.cursor = status;
	}
	gamebox.setCursor('default');
	gamebox.style.background = 'black';
	gamebox.addEventListener('contextmenu', (e) => {
		e.preventDefault();
	});

	//Preload assets
	app.loader.baseUrl = 'data';
	app.loader
		.add('0', 'seeds/0.txt')
		.add('empires', 'empires.json')
		.add('15000','terrain/15000/texture.json')
		.add('15001','terrain/15001/texture.json')
		.add('15002','terrain/15002/texture.json')
		.add('15003','terrain/15003/texture.json')
		.add('20000','border/20000/texture.json')
		.add('20002','border/20002/texture.json')
		.add('50405','interface/50405/texture.json')
		.add('64','graphics/64/texture.json')
		.add('83','graphics/83/texture.json')
		.add('212','graphics/212/texture.json')
		.add('218','graphics/218/texture.json')
		.add('230','graphics/230/texture.json')
		.add('233','graphics/233/texture.json')
		.add('235','graphics/235/texture.json')
		.add('240','graphics/240/texture.json')
		.add('254','graphics/254/texture.json')
		.add('261','graphics/261/texture.json')
		.add('273','graphics/273/texture.json')
		.add('280','graphics/280/texture.json')
		.add('292','graphics/292/texture.json')
		.add('293','graphics/293/texture.json')
		.add('294','graphics/294/texture.json')
		.add('295','graphics/295/texture.json')
		.add('296','graphics/296/texture.json')
		.add('297','graphics/297/texture.json')
		.add('298','graphics/298/texture.json')
		.add('299','graphics/299/texture.json')
		.add('300','graphics/300/texture.json')
		.add('301','graphics/301/texture.json')
		.add('347','graphics/347/texture.json')
		.add('418','graphics/418/texture.json')
		.add('419','graphics/419/texture.json')
		.add('425','graphics/425/texture.json')
		.add('432','graphics/432/texture.json')
		.add('440','graphics/440/texture.json')
		.add('463','graphics/463/texture.json')
		.add('464','graphics/464/texture.json')
		.add('465','graphics/465/texture.json')
		.add('466','graphics/466/texture.json')
		.add('489','graphics/489/texture.json')
		.add('492','graphics/492/texture.json')
		.add('493','graphics/493/texture.json')
		.add('494','graphics/494/texture.json')
		.add('503','graphics/503/texture.json')
		.add('509','graphics/509/texture.json')
		.add('527','graphics/527/texture.json')
		.add('531','graphics/531/texture.json')
		.add('532','graphics/532/texture.json')
		.add('533','graphics/533/texture.json')
		.add('534','graphics/534/texture.json')
		.add('623','graphics/623/texture.json')
		.add('625','graphics/625/texture.json')
		.add('628','graphics/628/texture.json')
		.add('632','graphics/632/texture.json')
		.add('636','graphics/636/texture.json')
		.add('657','graphics/657/texture.json')
		.add('658','graphics/658/texture.json')
		.add('664','graphics/664/texture.json')
		.add('672','graphics/672/texture.json')
		.add('682','graphics/682/texture.json')
	;

	app.loader.onProgress.add(showProgress);
	app.loader.onComplete.add(create);
	app.loader.onError.add(reportError);
	app.loader.load();
}
function showProgress(e){
}
function reportError(e){
	document.getElementById('loading').textContent = 'ERROR: ' + e.message;
}
function create(){
	//Remove loading screen
	document.getElementById('loading').remove();

	//Set our Pixi application
	gamebox.appendChild(app.view);

	//Init map
	empires = app.loader.resources['empires'].data;

	map = new Map(mapDefaultSize, mapDefaultReliefRange, mapDefaultChanceOfRelief, mapDefaultChanceOfSets, mapRevealEverything);
	app.stage.addChild(map);
	

	//Set-up global interactions
	const interactionManager = new PIXI.interaction.InteractionManager(app.renderer);
	interactionManager.on('pointerdown', (evt) => {
		pointerStart = {
			x: evt.data.global.x,
			y: evt.data.global.y,
		}
	})
	interactionManager.on('pointerup', (evt) => {
		pointerStart = null;
		
		//Select units on mouse rectangle
		if (mouseRectangle){
			let selectVillager;
			//Select units inside the rectangle
			for(let i = 0; i < map.player.units.length; i++){
				let unit = map.player.units[i];
				if (map.player.selectedUnits.length < maxSelectUnits && pointInRectangle(unit.x-map.camera.x, unit.y-map.camera.y, mouseRectangle.x, mouseRectangle.y, mouseRectangle.width, mouseRectangle.height)){
					unit.select();
					if (unit.type === 'Villager'){
						selectVillager = unit;
					}
					map.player.selectedUnits.push(unit);
				}
			}
			//Set our bottombar
			if (selectVillager){
				map.interface.setBottombar(selectVillager);
			}else{
				//TODO SELECT UNITS THAT HAVE THE MOST FREQUENCY
				map.interface.setBottombar(map.player.selectedUnits[0]);
			}
			//Reset mouse selection
			mouseRectangle.graph.destroy();
			mouseRectangle = null;
			return;
		}
		const pos = isometricToCartesian(evt.data.global.x - map.x, evt.data.global.y - map.y);
		const i = Math.floor(pos[0]);
		const j = Math.floor(pos[1]);
		if (map.grid[i] && map.grid[i][j]){
			const cell = map.grid[i][j];
			if ((cell.solid || cell.inclined || cell.border || gamebox.cursor !== 'default') && cell.visible){
				return;
			}
			if (mouseBuilding){
				if (mouseBuilding.isFree){
					if (mouseBuilding.onClick){
						mouseBuilding.onClick();
					}
					const building = map.player.createBuilding(i, j, mouseBuilding.type, map);
					let selectVillager;
					map.interface.removeMouseBuilding();
					for(let u = 0; u < map.player.selectedUnits.length; u++){
						let unit = map.player.selectedUnits[u];
						if (unit.type === 'Villager'){
							selectVillager = unit;
							drawInstanceBlinkingSelection(building);
							if (unit.work !== 'builder'){
								unit.loading = 0;
								unit.work = 'builder';
								unit.actionSheet = app.loader.resources['628'].spritesheet;
								unit.standingSheet = app.loader.resources['419'].spritesheet;
								unit.walkingSheet = app.loader.resources['658'].spritesheet;
							}
							unit.previousDest = null;
							unit.setDestination(building, 'build');
						}
					}
					//Set our bottombar
					if (selectVillager){
						map.interface.setBottombar(selectVillager);
					}else{
						//TODO SELECT UNITS THAT HAVE THE MOST FREQUENCY
						map.interface.setBottombar(map.player.selectedUnits[0]);
					}
				}
				return;
			}
			if (map.player.selectedUnits.length){
				//Pointer animation
				let pointerSheet = app.loader.resources['50405'].spritesheet;
				let pointer = new PIXI.AnimatedSprite(pointerSheet.animations['animation']);
				pointer.animationSpeed = .2;
				pointer.loop = false;
				pointer.anchor.set(.5,.5)
				pointer.x = evt.data.global.x;
				pointer.y = evt.data.global.y;
				pointer.onComplete = () => {
					pointer.destroy();
				};
				pointer.play();
				app.stage.addChild(pointer);
				//Send units
				const minX = Math.min(...map.player.selectedUnits.map(unit => unit.i));
				const minY = Math.min(...map.player.selectedUnits.map(unit => unit.j));
				const maxX = Math.max(...map.player.selectedUnits.map(unit => unit.i));
				const maxY = Math.max(...map.player.selectedUnits.map(unit => unit.j));
				const centerX = minX + Math.round((maxX - minX)/2); 
				const centerY = minY + Math.round((maxY - minY)/2);
				for(let u = 0; u < map.player.selectedUnits.length; u++){
					const unit = map.player.selectedUnits[u];
					const distCenterX = unit.i - centerX;
					const distCenterY = unit.j - centerY;
					const finalX = cell.i+distCenterX;
					const finalY = cell.j+distCenterY;
					if (map.grid[finalX] && map.grid[finalX][finalY]){
						map.player.selectedUnits[u].setDestination(map.grid[finalX][finalY]);
					}else{
						map.player.selectedUnits[u].setDestination(cell);
					}
				}
			}
		}
	})
	let hammertime = new Hammer(gamebox);
	hammertime.on('swipe', (evt) => {
		//app.stage.removeChildren();
	})
	interactionManager.on('pointermove', (evt) => {
		const pos = isometricToCartesian(evt.data.global.x - map.x, evt.data.global.y - map.y);
		const i = Math.floor(pos[0]);
		const j = Math.floor(pos[1]);
		//Mouse building to place construction
		if (map.grid[i] && map.grid[i][j]){
			const cell = map.grid[i][j];
			if (mouseBuilding){
				mouseBuilding.x = cell.x - map.camera.x;
				mouseBuilding.y = cell.y - map.camera.y;
				let isFree = true;
				getPlainCellsAroundPoint(i, j, map.grid, mouseBuilding.size === 3 ? 1 : 0, (cell) => {
					if (cell.solid || cell.inclined || cell.border || !cell.visible){
						isFree = false;
						return;
					}
				});
				//Color image of mouse building depend on buildable or not
				let sprite = mouseBuilding.getChildByName('sprite');
				let color = mouseBuilding.getChildByName('color');
				if (isFree){
					sprite.tint = colorWhite;
					if (color){
						color.tint = colorWhite;
					}
				}else{
					sprite.tint = colorRed;
					if (color){
						color.tint = colorRed;
					}
				}
				mouseBuilding.isFree = isFree;
				return;
			}
		}
		
		//Create and draw mouse selection
		const mousePos = evt.data.global;
		if (!mouseRectangle && pointerStart && pointsDistance(mousePos.x, mousePos.y, pointerStart.x, pointerStart.y) > 15){
			mouseRectangle = {
				x: evt.data.global.x,
				y: evt.data.global.y,
				width: 0,
				height: 0,
				graph: new PIXI.Graphics()
			}
			app.stage.addChild(mouseRectangle.graph);
		}
		if (mouseRectangle && !mouseBuilding){
			if (map.player.selectedUnits.length || map.player.selectedBuilding){
				map.player.unselectAll();
			}
			mouseRectangle.graph.clear();
			if (mousePos.x > mouseRectangle.x && mousePos.y > mouseRectangle.y){
				mouseRectangle.width = Math.round(mousePos.x - mouseRectangle.x);
				mouseRectangle.height = Math.round(mousePos.y - mouseRectangle.y);
				mouseRectangle.graph.lineStyle(1, colorWhite, 1);
				mouseRectangle.graph.drawRect(mouseRectangle.x, mouseRectangle.y, mouseRectangle.width, mouseRectangle.height);
			}
		}
	})
	//Start main loop
	app.ticker.add(step);
}


function step(){
	if (map){
		map.step();
	}
}
