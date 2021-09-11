
//Settings
const cellWidth = 63;
const cellHeight = 30;
const cellDepth = 16;

const appTop = 24;
const appBottom = 136;
const gamebox = document.getElementById('game');

const maxSelectUnits = 25;

//Map default values
const mapDefaultSize = 168;
const mapDefaultReliefRange = [
1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1 , 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1 , 1,
2, 2, 
3];
const mapDefaultChanceOfRelief = .06;
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
let mouse = {
    x: 0,
    y: 0,
	out: true,
	hover: null
};
let mouseRectangle;
let mouseBuilding;
let pointerStart;
let empires;
let player;

window.onload = preload;

function preload(){
	app = new PIXI.Application({
        autoResize: true,
		resizeTo: window,
		resolution: 1,
        powerPreference: 'high-performance'
	});

	//Set loading screen
	const loading = document.createElement('div');
	loading.id = 'loading';
	loading.textContent = 'Loading..';
	Object.assign(loading.style, {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		height: '100%'
	});
	gamebox.appendChild(loading);
	gamebox.style.background = 'black';

	//Disable contextmenu on rightclick
	gamebox.addEventListener('contextmenu', (evt) => {
		evt.preventDefault();
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
		.add('154','graphics/154/texture.json')
		.add('155','graphics/155/texture.json')
		.add('212','graphics/212/texture.json')
		.add('218','graphics/218/texture.json')
		.add('224','graphics/224/texture.json')
		.add('230','graphics/230/texture.json')
		.add('233','graphics/233/texture.json')
		.add('235','graphics/235/texture.json')
		.add('240','graphics/240/texture.json')
		.add('254','graphics/254/texture.json')
		.add('261','graphics/261/texture.json')
		.add('273','graphics/273/texture.json')
		.add('274','graphics/274/texture.json')
		.add('280','graphics/280/texture.json')
		.add('281','graphics/281/texture.json')
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
		.add('314','graphics/314/texture.json')
		.add('321','graphics/321/texture.json')
		.add('339','graphics/339/texture.json')
		.add('347','graphics/347/texture.json')
		.add('400','graphics/400/texture.json')
		.add('418','graphics/418/texture.json')
		.add('419','graphics/419/texture.json')
		.add('425','graphics/425/texture.json')
		.add('432','graphics/432/texture.json')
		.add('440','graphics/440/texture.json')
		.add('441','graphics/441/texture.json')
		.add('450','graphics/450/texture.json')
		.add('452','graphics/452/texture.json')
		.add('463','graphics/463/texture.json')
		.add('464','graphics/464/texture.json')
		.add('465','graphics/465/texture.json')
		.add('466','graphics/466/texture.json')
		.add('481','graphics/481/texture.json')
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
		.add('622','graphics/622/texture.json')
		.add('623','graphics/623/texture.json')
		.add('625','graphics/625/texture.json')
		.add('628','graphics/628/texture.json')
		.add('632','graphics/632/texture.json')
		.add('633','graphics/633/texture.json')
		.add('636','graphics/636/texture.json')
		.add('657','graphics/657/texture.json')
		.add('658','graphics/658/texture.json')
		.add('664','graphics/664/texture.json')
		.add('672','graphics/672/texture.json')
		.add('682','graphics/682/texture.json')
		.add('683','graphics/683/texture.json')
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

	window.addEventListener('resize', () => {
		map.clearInstancesOnScreen();
		map.displayInstancesOnScreen();
	})

    //Set-up global interactions
    document.addEventListener('keydown', (evt) => {
		if (evt.key === 'Delete'){
			for (let i = 0; i < player.selectedUnits.length; i++){
				player.selectedUnits[i].die();
			}
			if (player.selectedBuilding){
				player.selectedBuilding.die();
			}
			return;
		}
        switch (evt.code){
            case 'ArrowLeft': 
                map.moveCamera('left');
                break;
            case 'ArrowRight': 
                map.moveCamera('right');
                break;  
            case 'ArrowUp': 
                map.moveCamera('up');
                break;  
            case 'ArrowDown': 
                map.moveCamera('down');
                break;
        }
    })
    document.addEventListener('mouseleave', () => {
        mouse.out = true;
    })
    document.addEventListener('mouseenter', () => {
        mouse.out = false;
    })
    document.addEventListener('mousemove', (evt) => {
        mouse.x = evt.pageX;
        mouse.y = evt.pageY;     
        if (!player){
			return;
        }
		//Mouse building to place construction
		if (mouseBuilding){
            const pos = isometricToCartesian(mouse.x - map.x, mouse.y >= app.screen.height ? app.screen.height - map.y : mouse.y - map.y);
            const i = Math.floor(pos[0]);
            const j = Math.floor(pos[1]);
            if (map.grid[i] && map.grid[i][j]){
                const cell = map.grid[i][j];
                mouseBuilding.x = cell.x - map.camera.x;
                mouseBuilding.y = cell.y - map.camera.y;
                let isFree = true;
                getPlainCellsAroundPoint(i, j, map.grid, 1, (cell) => {
                    if (cell.solid || cell.inclined || cell.border || !cell.visible){
                        isFree = false;
                        return;
                    }
                });
                //Color image of mouse building depend on buildable or not
                const sprite = mouseBuilding.getChildByName('sprite');
                const color = mouseBuilding.getChildByName('color');
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
            }
            return;
		}
		
		//Create and draw mouse selection
		if (!mouseRectangle && pointerStart && pointsDistance(mouse.x, mouse.y, pointerStart.x, pointerStart.y) > 5){
			mouseRectangle = {
				x: pointerStart.x,
				y: pointerStart.y - 20,
				width: 0,
				height: 0,
				graph: new PIXI.Graphics()
			}
			app.stage.addChild(mouseRectangle.graph);
		}
		if (mouseRectangle && !mouseBuilding){
			if (player.selectedUnits.length || player.selectedBuilding){
				player.unselectAll();
			}
			mouseRectangle.graph.clear();
			mouseRectangle.width = Math.round(mouse.x - mouseRectangle.x);
			mouseRectangle.height = mouse.y >= app.screen.height ? Math.round(app.screen.height - 2 - mouseRectangle.y) : Math.round(mouse.y - 20 - mouseRectangle.y);
			mouseRectangle.graph.lineStyle(1, colorWhite, 1);
			mouseRectangle.graph.drawRect(mouseRectangle.x, mouseRectangle.y, mouseRectangle.width, mouseRectangle.height);
		}   
    })
	document.addEventListener('pointerdown', () => {
		if ((mouse.y < appTop) || (mouse.y > window.innerHeight - appBottom)){
			return;
		}
		pointerStart = {
			x: mouse.x,
			y: mouse.y,
		}
	})
	document.addEventListener('pointerup', () => {
		pointerStart = null;
		if (!player){
			return;
		}
		//Select units on mouse rectangle
		if (mouseRectangle){
            let selectVillager;
            player.unselectAll();
			//Select units inside the rectangle
			for(let i = 0; i < player.units.length; i++){
				const unit = player.units[i];
				if (player.selectedUnits.length < maxSelectUnits && pointInRectangle(unit.x-map.camera.x, unit.y-map.camera.y, mouseRectangle.x, mouseRectangle.y, mouseRectangle.width, mouseRectangle.height, true)){
					unit.select();
					if (unit.type === 'Villager'){
						selectVillager = unit;
					}
					player.selectedUnits.push(unit);
				}
			}
			//Set our bottombar
			if (selectVillager){
				player.selectedUnit = selectVillager;
				player.interface.setBottombar(selectVillager);
			}else{
				//TODO SELECT UNITS THAT HAVE THE MOST FREQUENCY
				player.selectedUnit = player.selectedUnits[0];
				player.interface.setBottombar(player.selectedUnits[0]);
			}
			//Reset mouse selection
			mouseRectangle.graph.destroy();
			mouseRectangle = null;
			return;
        }
        if (mouseIsInApp()){
            const pos = isometricToCartesian(mouse.x - map.x, mouse.y - map.y);
            const i = Math.floor(pos[0]);
            const j = Math.floor(pos[1]);
            if (map.grid[i] && map.grid[i][j]){
                const cell = map.grid[i][j];
                if ((cell.solid || mouse.hover) && cell.visible){
                    return;
                }
                if (mouseBuilding){
					if ( cell.inclined || cell.border){
						return;
					}
                    if (mouseBuilding.isFree){
                        if (player.buyBuilding(i, j, mouseBuilding.type, map)){
                            player.interface.removeMouseBuilding();
                            if (player.interface.selection){
                                player.interface.setBottombar(player.interface.selection);
                            }
                        }
                    }
                }else if (player.selectedUnits.length){
                    //Pointer animation
                    const pointerSheet = app.loader.resources['50405'].spritesheet;
                    const pointer = new PIXI.AnimatedSprite(pointerSheet.animations['animation']);
                    pointer.animationSpeed = .2;
                    pointer.loop = false;
                    pointer.anchor.set(.5,.5)
                    pointer.x = mouse.x;
                    pointer.y = mouse.y - 20;
                    pointer.onComplete = () => {
                        pointer.destroy();
                    };
                    pointer.play();
                    app.stage.addChild(pointer);
                    //Send units
                    const minX = Math.min(...player.selectedUnits.map(unit => unit.i));
                    const minY = Math.min(...player.selectedUnits.map(unit => unit.j));
                    const maxX = Math.max(...player.selectedUnits.map(unit => unit.i));
                    const maxY = Math.max(...player.selectedUnits.map(unit => unit.j));
                    const centerX = minX + Math.round((maxX - minX)/2); 
                    const centerY = minY + Math.round((maxY - minY)/2);
                    for(let u = 0; u < player.selectedUnits.length; u++){
                        const unit = player.selectedUnits[u];
                        const distCenterX = unit.i - centerX;
                        const distCenterY = unit.j - centerY;
                        const finalX = cell.i+distCenterX;
                        const finalY = cell.j+distCenterY;
                        if (map.grid[finalX] && map.grid[finalX][finalY]){
                            player.selectedUnits[u].sendTo(map.grid[finalX][finalY]);
                        }else{
                            player.selectedUnits[u].sendTo(cell);
                        }
                    }
                }
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
