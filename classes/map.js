/**
 * 
 */
class Map{
	constructor(size, reliefRange, chanceOfRelief, chanceOfTree){
		this.size = size;
        this.reliefRange = reliefRange;
        this.chanceOfRelief = chanceOfRelief;
        this.chanceOfTree = chanceOfTree;
        this.grid = [];
        this.initMap();
	}
    initMap(){
        //Build this.grid
        this.grid = [];
        instances.removeChildren();
        for(let i = 0; i < this.size; i++){
            for(let j = 0; j < this.size; j++){
                if(this.grid[i] == null){
                    this.grid[i] = [];	
                }
                let level = 0;
                if (Math.random() < this.chanceOfRelief){
                    level = randomRange(this.reliefRange[0],this.reliefRange[1]);
                }
                
                let cell = new Cell(i, j, level, this.grid);
                this.grid[i][j] = cell;
                instances.addChild(cell)
                /*let text = new PIXI.Text(i+'/'+j,{ fontSize: 10, fill : 0xffffff, align : 'center'});
                text.x = 22;
                text.y = 16;
                cell.addChild(text);*/
            }
        }
        for(let i = 0; i < this.size; i++){
            for(let j = 0; j < this.size; j++){
                let cell = this.grid[i][j];
                if (cell.z > 0){
                    cell.setCellLevel(cell.z);
                }
                cell.fillCellsAroundCell();
            }
        }
        this.formatCells();
        //Set map instances
        for(let i = 0; i < this.size; i++){
            for(let j = 0; j < this.size; j++){
                if (!this.grid[i][j].inclined && Math.random() < this.chanceOfTree){
                    let cellPos = cartesianToIsometric(i, j);
                    cellPos[1] -= (this.grid[i][j].z * cellDepth);
                    let tree = new Tree(cellPos[0], cellPos[1], this.grid[i][j].z);
                    instances.addChild(tree);
                    this.grid[i][j].solid = true;
                    /*let text = new PIXI.Text(tree.zIndex,{fontFamily : 'Arial', fontSize: 8, fill : 0xffff00, align : 'center'});
                    text.x = 22;
                    text.y = 16;
                    tree.addChild(text);*/
                }
            }
        }
        //Place a unit
        let i = Math.floor(Math.random() * this.size);
        let j = Math.floor(Math.random() * this.size)
        let unitPos = cartesianToIsometric(i, j);
        unitPos[1] -= (this.grid[i][j].z * cellDepth);
        let unit = player.createUnit(unitPos[0], unitPos[1], this.grid[i][j].z);
        instances.addChild(unit);
    }
    formatCells(){
        for(let i = 0; i < this.size; i++){
            for(let j = 0; j < this.size; j++){
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
