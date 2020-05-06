//Cell
class Cell extends PIXI.Container{
	constructor(i, j, z, map){
        super();

        //super(texture);
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
        let points = [0,(cellHeight/2), (cellWidth/2),0, cellWidth,(cellHeight/2), (cellWidth/2),cellHeight]
        /*const graphics = new PIXI.Graphics();
        graphics.lineStyle(0);
        graphics.beginFill(0x3500FA, 1);
        graphics.drawPolygon(points);
        graphics.endFill();
        this.addChild(graphics);*/
        
        this.hitArea = new PIXI.Polygon(points);
		this.on('click', () => {
			for(let u = 0; u < player.selectedUnits.length; u++){
                let unit = player.selectedUnits[u];
                //this.getChildByName('sprite').tint = colorBlue;
                unit.path = getInstancePath(unit, this.i, this.j, this.parent);
                /*for (let i = 0; i < unit.path.length; i++){
                    let path = unit.path[i];
                    const graphics = new PIXI.Graphics();
                    graphics.lineStyle(0);
                    graphics.beginFill(0x3500FA, 1);
                    graphics.drawCircle(path.x, path.y, 5);
                    graphics.endFill();
                    graphics.zIndex = 1000;
                    this.parent.addChild(graphics);
                }*/
				if (unit.path.length){
					unit.setAnimation('walkingSheet');
				}
			}
		})
    }
    setTexture(nbr, inclined = false, elevation = 0){
        let spritesheet = app.loader.resources['terrain/15001/texture.json'].spritesheet;
        let texture = spritesheet.textures[nbr + '.png'];
        this.pivot.x = texture.width/2;
        this.pivot.y = texture.height/2;
        if (elevation){
            this.y -= elevation;
        }
        this.inclined = inclined;
        let sprite = new PIXI.Sprite(texture);
        sprite.name = 'sprite';
        this.addChild(sprite);
    }
	fillCellsAroundCell(){
        let grid = this.parent.grid;
        let neighbours = getCellAroundPoint(this.i, this.j, grid, 2);
        for(let i = 0; i < neighbours.length; i++){
            let neighbour = neighbours[i];
            if (neighbour.z === this.z){
                let dist = pointDistance(this.i, this.j, neighbour.i, neighbour.j);
                let velX = Math.round(((this.i - neighbour.i)/dist));
                let velY = Math.round(((this.j - neighbour.j)/dist));
                if (grid[neighbour.i+velX] && grid[neighbour.i+velX][neighbour.j+velY]){
                    let target = grid[neighbour.i+velX][neighbour.j+velY];
                    let aside = grid[this.i + neighbour.i - target.i][this.j + neighbour.j - target.j]
                    if (target.z > this.z || target.z === this.z || aside.z === this.z){
                        continue
                    }
                    if ((Math.floor(pointDistance(this.i, this.j, neighbour.i, neighbour.j)) === 2)){
                        target.setCellLevel(target.z + 1);
                    }
                }
            }
        }
    }
    setCellLevel(level, cpt = 1) {
        let grid = this.parent.grid;
        let neighbours = getCellAroundPoint(this.i, this.j, grid, level - cpt);
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