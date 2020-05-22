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
		this.interactive = false;
        this.inclined = false;
        this.has = null;
        this.visible = false;
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