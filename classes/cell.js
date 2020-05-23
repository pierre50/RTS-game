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
        getCellsAroundPoint(this.i, this.j, grid, 2, (cell) => {
            if (cell.z === this.z){
                let dist = instancesDistance(this, cell, true);
                let velX = Math.round(((this.i - cell.i)/dist));
                let velY = Math.round(((this.j - cell.j)/dist));
                if (grid[cell.i+velX] && grid[cell.i+velX][cell.j+velY]){
                    let target = grid[cell.i+velX][cell.j+velY];
                    let aside = grid[this.i + cell.i - target.i][this.j + cell.j - target.j]
                    if (target.z <= this.z && target.z !== this.z && aside.z !== this.z){
                        if ((Math.floor(instancesDistance(this, cell, true)) === 2)){
                            target.setCellLevel(target.z + 1);
                        }
                    }
                }
            }
        });
    }
    setCellLevel(level, cpt = 1) {
        let grid = this.parent.grid;
        getCellsAroundPoint(this.i, this.j, grid, level - cpt, (cell) => {
            if (cell.z < cpt){
                cell.y -= (cpt - cell.z) * cellDepth;
                cell.z = cpt;
                cell.zIndex = getInstanceZIndex(cell);
                cell.fillCellsAroundCell(grid);
            }
        });
        if (cpt <= level){
            this.setCellLevel(level, cpt+1);	
        }
    }
}