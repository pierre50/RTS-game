class Cell extends PIXI.Container{
	constructor(i, j, z, map){
        super();

        this.setParent(map);
        this.name = 'cell';
        let pos = cartesianToIsometric(i, j);
		this.x = pos[0];
        this.y = pos[1] - (z * cellDepth);
		this.z = z;
		this.i = i;
		this.j = j;
		this.zIndex = getInstanceZIndex(this);
		this.solid = false;
		this.interactive = true;
        this.inclined = false;
        this.has = null;
        this.renderable =  false;
        let points = [-32, 0, 0,-16, 32,0, 0,16]
        /*
        MUST TO BE FIXED, HITPOINT ON TERRAIN INCLINAISON
        const graphics = new PIXI.Graphics();
        graphics.lineStyle(0);
        graphics.beginFill(0x3500FA, 1);
        graphics.drawPolygon(points);
        graphics.endFill();
        this.addChild(graphics);*/
        
        this.hitArea = new PIXI.Polygon(points);
        this.on('mouseover', () => {
            if (mouseBuilding){
                mouseBuilding.x = this.x - this.parent.camera.x;
                mouseBuilding.y = this.y - this.parent.camera.y;
                let isFree = true;
                let neighbours = getCellsAroundPoint(this.i, this.j, this.parent.grid, mouseBuilding.size - 1, false, true);
                for (let n = 0; n < neighbours.length; n ++){
                    if (neighbours[n].solid){
                        isFree = false;
                        break;
                    }
                }
                mouseBuilding.tint = isFree ? colorWhite : colorRed;
                mouseBuilding.isFree = isFree;
            }
       
		})
		this.on('click', (evt) => {
            if (mouseBuilding){
                if (mouseBuilding.isFree){
                    if (mouseBuilding.onClick){
                        mouseBuilding.onClick();
                    }
                    const building = this.parent.player.createBuilding(this.i, this.j, mouseBuilding.type, this.parent);
                    this.parent.interface.removeMouseBuilding();
			        for(let i = 0; i < this.parent.player.selectedUnits.length; i++){
                        let unit = this.parent.player.selectedUnits[i];
                        if (unit.type === 'villager'){
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
                }
                return;
            }
            if (this.parent.player.selectedUnits.length){
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
            }
			for(let u = 0; u < this.parent.player.selectedUnits.length; u++){
                this.parent.player.selectedUnits[u].setDestination(this);
			}
		})
    }
    setTexture(nbr, inclined = false, elevation = 0){
        let resourceName = '15001';
        let spritesheet = app.loader.resources[resourceName].spritesheet;
        let texture = spritesheet.textures[nbr + '_' + resourceName + '.png'];
        if (elevation){
            this.y -= elevation;
        }
        this.inclined = inclined;
        let sprite = new PIXI.Sprite(texture);
        sprite.name = 'sprite';
        sprite.anchor.set(.5, .5);
        sprite.cursor = 'default';

        this.addChild(sprite);
    }
	fillCellsAroundCell(){
        let grid = this.parent.grid;
        let neighbours = getCellsAroundPoint(this.i, this.j, grid, 2);
        for(let i = 0; i < neighbours.length; i++){
            let neighbour = neighbours[i];
            if (neighbour.z === this.z){
                let dist = instancesDistance(this, neighbour, true);
                let velX = Math.round(((this.i - neighbour.i)/dist));
                let velY = Math.round(((this.j - neighbour.j)/dist));
                if (grid[neighbour.i+velX] && grid[neighbour.i+velX][neighbour.j+velY]){
                    let target = grid[neighbour.i+velX][neighbour.j+velY];
                    let aside = grid[this.i + neighbour.i - target.i][this.j + neighbour.j - target.j]
                    if (target.z > this.z || target.z === this.z || aside.z === this.z){
                        continue
                    }
                    if ((Math.floor(instancesDistance(this, neighbour, true)) === 2)){
                        target.setCellLevel(target.z + 1);
                    }
                }
            }
        }
    }
    setCellLevel(level, cpt = 1) {
        let grid = this.parent.grid;
        let neighbours = getCellsAroundPoint(this.i, this.j, grid, level - cpt);
        for(let i = 0; i < neighbours.length; i++){
            let neighbour = neighbours[i];
            if (neighbour.z < cpt){
                neighbour.y -= (cpt - neighbour.z) * cellDepth;
                neighbour.z = cpt;
                neighbour.zIndex = getInstanceZIndex(neighbour);
                neighbour.fillCellsAroundCell(grid);
            }
        }
        if (cpt <= level){
            this.setCellLevel(level, cpt+1);	
        }
    }
}