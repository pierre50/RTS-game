/**
 * 
 */
class Map{
	constructor(cols, rows, reliefRange, chanceOfRelief){
		this.cols = cols;
        this.rows = rows;
        this.reliefRange = reliefRange;
        this.chanceOfRelief = chanceOfRelief;
        this.grid = [];
        this.initMap();
	}
    initMap(){
        //Build this.grid
        this.grid = [];
        instances.removeChildren();
        for(let i = 0; i < this.cols; i++){
            for(let j = 0; j < this.rows; j++){
                if(this.grid[i] == null){
                    this.grid[i] = [];	
                }
                let level = 0;
                if (Math.random() < this.chanceOfRelief){
                    level = randomRange(this.reliefRange[0],this.reliefRange[1]);
                }
                
                let cellPos = cartesianToIsometric(i, j);
                cellPos[1] -= (level * cellDepth);
                let cell = new Cell(cellPos[0], cellPos[1], i, j, level);
                /* FOR EDITOR 
                cell.on('mouseover', () => {
                    cell.tint = 0xff0000;
                })
                cell.on('mouseout', () => {
                    cell.tint = 0xffffff;
                })*/
                cell.on('click', () => {
                    /* FOR EDITOR
                    setCellLevel(cell, 3);
                     */
                    for(let u = 0; u < player.selectedUnits.length; u++){
                        let unit = player.selectedUnits[u]
                        unit.path = getPath(unit, i, j, this);
                    }
                })
                this.grid[i][j] = cell;
                instances.addChild(cell)
                /*let text = new PIXI.Text(i+'/'+j,{ fontSize: 10, fill : 0xffffff, align : 'center'});
                text.x = 22;
                text.y = 16;
                cell.addChild(text);*/
            }
        }
        for(let i = 0; i < this.cols; i++){
            for(let j = 0; j < this.rows; j++){
                let cell = this.grid[i][j];
                if (cell.z > 0){
                    this.setCellLevel(cell, cell.z);
                }
                this.fillCellsAroundCell(cell);
            }
        }
        this.formatCells();
        //Set map instances
        for(let i = 0; i < this.cols; i++){
            for(let j = 0; j < this.rows; j++){
                if (!this.grid[i][j].inclined && Math.random() < .4){
                    let cellPos = cartesianToIsometric(i, j);
                    cellPos[1] -= (this.grid[i][j].z * cellDepth);
                    let tree = new Tree(cellPos[0], cellPos[1], this.grid[i][j].z);
                    instances.addChild(tree);
                    //this.grid[i][j].tint = 0xff0000;
                    this.grid[i][j].solid = true;
                    /*let text = new PIXI.Text(tree.zIndex,{fontFamily : 'Arial', fontSize: 8, fill : 0xffff00, align : 'center'});
                    text.x = 22;
                    text.y = 16;
                    tree.addChild(text);*/
                }
            }
        }
        //Place a unit
        let i = Math.floor(Math.random() * this.cols);
        let j = Math.floor(Math.random() * this.rows)
        let unitPos = cartesianToIsometric(i, j);
        unitPos[1] -= (this.grid[i][j].z * cellDepth);
        let unit = player.createUnit(unitPos[0], unitPos[1], this.grid[i][j].z);
        instances.addChild(unit);
    }
    fillCellsAroundCell(cell){
        let neighbours = getCellAroundPoint(cell.i, cell.j, this.grid, 2);
        for(let i = 0; i < neighbours.length; i++){
            let neighbour = neighbours[i];
            if (neighbour.z === cell.z){
                let dist = pointDistance(cell.i, cell.j, neighbour.i, neighbour.j);
                let velX = Math.round(((cell.i - neighbour.i)/dist));
                let velY = Math.round(((cell.j - neighbour.j)/dist));
                if (this.grid[neighbour.i+velX] && this.grid[neighbour.i+velX][neighbour.j+velY]){
                    let target = this.grid[neighbour.i+velX][neighbour.j+velY];
                    let aside = this.grid[cell.i + neighbour.i - target.i][cell.j + neighbour.j - target.j]
                    if (target.z > cell.z || target.z === cell.z || aside.z === cell.z){
                        continue
                    }
                    if ((Math.floor(pointDistance(cell.i, cell.j, neighbour.i, neighbour.j)) === 2)){
                        this.setCellLevel(target, target.z + 1);
                    }
                }
            }
        }
    }
    setCellLevel(cell, level, cpt = 1) {
        let neighbours = getCellAroundPoint(cell.i, cell.j, this.grid, level - cpt);
        for(let i = 0; i < neighbours.length; i++){
            let neighbour = neighbours[i];
            if (neighbour.z < cpt){
                neighbour.y -= (cpt - neighbour.z) * cellDepth;
                neighbour.z = cpt;
                neighbour.zIndex = getInstanceZIndex(neighbour);
                neighbour.texture = cell.originalTexture;
                neighbour.anchor.set(0);
                this.fillCellsAroundCell(neighbour);
            }
        }
        if (cpt <= level){
            this.setCellLevel(cell, level, cpt+1);	
        }else{
            /* FOR EDITOR
            this.formatCells();
            */
        }
    }
    formatCells(){
        for(let i = 0; i < this.cols; i++){
            for(let j = 0; j < this.rows; j++){
                this.grid[i][j].anchor.set(0);
                this.grid[i][j].texture = this.grid[i][j].originalTexture;
                this.grid[i][j].inclined = false;
                //Side
                if ((this.grid[i-1] && this.grid[i-1][j].z - this.grid[i][j].z === 1) &&
                        (!this.grid[i+1] || (this.grid[i+1][j].z <= this.grid[i][j].z)) &&
                        (!this.grid[i][j-1] || (this.grid[i][j-1].z <= this.grid[i][j].z)) &&
                        (!this.grid[i][j+1] || (this.grid[i][j+1].z <= this.grid[i][j].z))){
                    this.grid[i][j].anchor.set(0,.32)
                    //this.grid[i][j].tint = colorOrange;
                    this.grid[i][j].inclined = true;
                    this.grid[i][j].texture = app.loader.resources['014_15001'].texture;
                }else if ((this.grid[i+1] && this.grid[i+1][j].z - this.grid[i][j].z === 1) &&
                        (!this.grid[i-1] || (this.grid[i-1][j].z <= this.grid[i][j].z)) &&
                        (!this.grid[i][j-1] || (this.grid[i][j-1].z <= this.grid[i][j].z)) &&
                        (!this.grid[i][j+1] || (this.grid[i][j+1].z <= this.grid[i][j].z))){
                    //this.grid[i][j].tint = colorOrange;
                    this.grid[i][j].inclined = true;
                    this.grid[i][j].texture = app.loader.resources['015_15001'].texture;
                } else if ((this.grid[i][j-1] && this.grid[i][j-1].z - this.grid[i][j].z === 1) &&
                        (!this.grid[i+1] || (this.grid[i+1][j].z <= this.grid[i][j].z)) &&
                        (!this.grid[i][j+1] || (this.grid[i][j+1].z <= this.grid[i][j].z)) &&
                        (!this.grid[i-1] || (this.grid[i-1][j].z <= this.grid[i][j].z))){
                    this.grid[i][j].anchor.set(0,.32)
                    //this.grid[i][j].tint = colorOrange;
                    this.grid[i][j].inclined = true;
                    this.grid[i][j].texture = app.loader.resources['016_15001'].texture;
                }else if ((this.grid[i][j+1] && this.grid[i][j+1].z - this.grid[i][j].z === 1) &&
                        (!this.grid[i+1] || (this.grid[i+1][j].z <= this.grid[i][j].z)) &&
                        (!this.grid[i][j-1] || (this.grid[i][j-1].z <= this.grid[i][j].z)) &&
                        (!this.grid[i-1] || (this.grid[i-1][j].z <= this.grid[i][j].z))){
                    //this.grid[i][j].tint = colorOrange;
                    this.grid[i][j].inclined = true;
                    this.grid[i][j].texture = app.loader.resources['013_15001'].texture;
                } //Corner
                else if ((this.grid[i-1] && (this.grid[i-1][j-1] && this.grid[i-1][j-1].z - this.grid[i][j].z === 1)) &&
                        (!this.grid[i][j-1] || (this.grid[i][j-1].z <= this.grid[i][j].z)) &&
                        (!this.grid[i-1] || (this.grid[i-1][j].z <= this.grid[i][j].z))){
                    this.grid[i][j].anchor.set(0,.32)
                    //this.grid[i][j].tint = colorViolet;
                    this.grid[i][j].inclined = true;
                    this.grid[i][j].texture = app.loader.resources['010_15001'].texture;
                }else if ((this.grid[i+1] && (this.grid[i+1][j-1] && this.grid[i+1][j-1].z - this.grid[i][j].z === 1)) &&
                        (!this.grid[i][j-1] || (this.grid[i][j-1].z <= this.grid[i][j].z)) &&
                        (!this.grid[i+1] || (this.grid[i+1][j].z <= this.grid[i][j].z))){
                    //this.grid[i][j].tint = colorViolet;
                    this.grid[i][j].inclined = true;
                    this.grid[i][j].texture = app.loader.resources['012_15001'].texture;
                }else if ((this.grid[i-1] && (this.grid[i-1][j+1] && this.grid[i-1][j+1].z - this.grid[i][j].z === 1)) &&
                        (!this.grid[i][j+1] || (this.grid[i][j+1].z <= this.grid[i][j].z)) &&
                        (!this.grid[i-1] || (this.grid[i-1][j].z <= this.grid[i][j].z))){
                    //this.grid[i][j].tint = colorViolet;
                    this.grid[i][j].inclined = true;
                    this.grid[i][j].texture = app.loader.resources['011_15001'].texture;
                }else if ((this.grid[i+1] && (this.grid[i+1][j+1] && this.grid[i+1][j+1].z - this.grid[i][j].z === 1)) &&
                        (!this.grid[i][j+1] || (this.grid[i][j+1].z <= this.grid[i][j].z)) &&
                        (!this.grid[i+1] || (this.grid[i+1][j].z <= this.grid[i][j].z))){
                    //this.grid[i][j].tint = colorViolet;
                    this.grid[i][j].inclined = true;
                    this.grid[i][j].texture = app.loader.resources['009_15001'].texture;
                }
                //Deep corner
                else //(this.grid[i-1] && (this.grid[i-1][j-1] && this.grid[i-1][j-1].z - this.grid[i][j].z === 1)) &&
                if ((this.grid[i][j-1] && (this.grid[i][j-1].z && this.grid[i][j-1].z - this.grid[i][j].z === 1)) &&
                        (this.grid[i-1] && (this.grid[i-1][j].z && this.grid[i-1][j].z - this.grid[i][j].z === 1))){
                    this.grid[i][j].anchor.set(0,.32)
                    //this.grid[i][j].tint = colorIndigo;
                    this.grid[i][j].inclined = true;
                    this.grid[i][j].texture = app.loader.resources['022_15001'].texture;
                }else //(this.grid[i+1] && (this.grid[i+1][j+1] && this.grid[i+1][j+1].z - this.grid[i][j].z === 1)) &&
                if ((this.grid[i][j+1] && (this.grid[i][j+1].z && this.grid[i][j+1].z - this.grid[i][j].z === 1)) &&
                        (this.grid[i+1] && (this.grid[i+1][j].z && this.grid[i+1][j].z - this.grid[i][j].z === 1))){
                    //this.grid[i][j].tint = colorIndigo;
                    this.grid[i][j].inclined = true;
                    this.grid[i][j].texture = app.loader.resources['021_15001'].texture;
                }else //(this.grid[i+1] && (this.grid[i+1][j-1] && this.grid[i+1][j-1].z - this.grid[i][j].z === 1)) &&
                if ((this.grid[i][j-1] && (this.grid[i][j-1].z && this.grid[i][j-1].z - this.grid[i][j].z === 1)) &&
                        (this.grid[i+1] && (this.grid[i+1][j].z && this.grid[i+1][j].z - this.grid[i][j].z === 1))){
                    //this.grid[i][j].tint = colorIndigo;
                    this.grid[i][j].anchor.set(0,.49)
                    this.grid[i][j].inclined = true;
                    this.grid[i][j].texture = app.loader.resources['023_15001'].texture;
                }else //(this.grid[i-1] && (this.grid[i-1][j+1] && this.grid[i-1][j+1].z - this.grid[i][j].z === 1)) &&
                if ((this.grid[i][j+1] && (this.grid[i][j+1].z && this.grid[i][j+1].z - this.grid[i][j].z === 1)) &&
                        (this.grid[i-1] && (this.grid[i-1][j].z && this.grid[i-1][j].z - this.grid[i][j].z === 1))){
                    //this.grid[i][j].tint = colorIndigo;
                    this.grid[i][j].anchor.set(0,.49)
                    this.grid[i][j].inclined = true;
                    this.grid[i][j].texture = app.loader.resources['024_15001'].texture;
                }
            }
        }
    }
}
