//Cell
class Cell extends PIXI.Sprite{
	constructor(i, j, z, grid){
		let nbrTexture = randomRange(1,8);
		let texture = app.loader.resources[`00${nbrTexture}_15001`].texture
		super(texture);
		this.name = 'cell';
		this.x = cartesianToIsometric(i, j)[0];
		this.y = cartesianToIsometric(i, j)[1] - (z * cellDepth);
		this.z = z;
		this.i = i;
		this.j = j;
		this.grid = grid;
		this.zIndex = getInstanceZIndex(this);
		this.solid = false;
		this.interactive = true;
		this.inclined = false;
		this.originalTexture = texture;
		let points = [0,16, 32,0, 64,16, 32,32]
		this.hitArea = new PIXI.Polygon(points);
		this.on('click', () => {
			for(let u = 0; u < player.selectedUnits.length; u++){
				let unit = player.selectedUnits[u];
				unit.path = getPath(unit, this.i, this.j, map);
				if (unit.path.length){
					unit.setAnimation('walkingSheet');
				}
			}
		})
	}
	fillCellsAroundCell(){
        let neighbours = getCellAroundPoint(this.i, this.j, this.grid, 2);
        for(let i = 0; i < neighbours.length; i++){
            let neighbour = neighbours[i];
            if (neighbour.z === this.z){
                let dist = pointDistance(this.i, this.j, neighbour.i, neighbour.j);
                let velX = Math.round(((this.i - neighbour.i)/dist));
                let velY = Math.round(((this.j - neighbour.j)/dist));
                if (this.grid[neighbour.i+velX] && this.grid[neighbour.i+velX][neighbour.j+velY]){
                    let target = this.grid[neighbour.i+velX][neighbour.j+velY];
                    let aside = this.grid[this.i + neighbour.i - target.i][this.j + neighbour.j - target.j]
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
        let neighbours = getCellAroundPoint(this.i, this.j, this.grid, level - cpt);
        for(let i = 0; i < neighbours.length; i++){
            let neighbour = neighbours[i];
            if (neighbour.z < cpt){
                neighbour.y -= (cpt - neighbour.z) * cellDepth;
                neighbour.z = cpt;
                neighbour.zIndex = getInstanceZIndex(neighbour);
                neighbour.texture = this.originalTexture;
                neighbour.anchor.set(0);
                neighbour.fillCellsAroundCell(this.grid);
            }
        }
        if (cpt <= level){
            this.setCellLevel(level, cpt+1);	
        }
    }
}