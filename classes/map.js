/**
 * 
 */
class Map extends PIXI.Container{
	constructor(size, reliefRange, chanceOfRelief, chanceOfTree){
        super();
		this.size = size;
        this.reliefRange = reliefRange;
        this.chanceOfRelief = chanceOfRelief;
        this.chanceOfTree = chanceOfTree;
        this.grid = [];
        this.sortableChildren = true;
        this.camera = {
            x: -appWidth / 2,
            y: -(appHeight / 2) + 200
        }
        this.x = -this.camera.x;
        this.y = -this.camera.y;
        this.initMap();
	}
    initMap(){
        this.removeChildren();
        for(let i = 0; i < this.size; i++){
            for(let j = 0; j < this.size; j++){
                if(this.grid[i] == null){
                    this.grid[i] = [];	
                }
                let level = 0;
                if (Math.random() < this.chanceOfRelief){
                    level = randomRange(this.reliefRange[0],this.reliefRange[1]);
                }
                
                let cell = new Cell(i, j, level, this);
                this.grid[i][j] = cell;
                this.addChild(cell)
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
                let cell = this.grid[i][j];
                if (!cell.inclined && Math.random() < this.chanceOfTree){
                    let tree = new Tree(i, j, this);
                    this.addChild(tree);
                    cell.has = tree;
                    cell.solid = true;
                    /*let text = new PIXI.Text(tree.zIndex,{fontFamily : 'Arial', fontSize: 8, fill : 0xffff00, align : 'center'});
                    text.x = 22;
                    text.y = 16;
                    tree.addChild(text);*/
                }
            }
        }
        //Place a unit
        for (let u = 0; u < 5; u++){
            let i = Math.floor(Math.random() * this.size);
            let j = Math.floor(Math.random() * this.size)
            if (this.grid[i][j].has){
                this.removeChild(this.grid[i][j].has)
            }
            let unit = player.createUnit(i, j, this);
            this.addChild(unit);
        }
    }
    formatCells(){
        for(let i = 0; i < this.size; i++){
            for(let j = 0; j < this.size; j++){
                let cell = this.grid[i][j];
                //Side
                if ((this.grid[i-1] && this.grid[i-1][j].z - cell.z === 1) &&
                        (!this.grid[i+1] || (this.grid[i+1][j].z <= cell.z)) &&
                        (!this.grid[i][j-1] || (this.grid[i][j-1].z <= cell.z)) &&
                        (!this.grid[i][j+1] || (this.grid[i][j+1].z <= cell.z))){
                    cell.setTexture('14', true, cellDepth/2);
                }else if ((this.grid[i+1] && this.grid[i+1][j].z - cell.z === 1) &&
                        (!this.grid[i-1] || (this.grid[i-1][j].z <= cell.z)) &&
                        (!this.grid[i][j-1] || (this.grid[i][j-1].z <= cell.z)) &&
                        (!this.grid[i][j+1] || (this.grid[i][j+1].z <= cell.z))){
                    cell.setTexture('15', true, cellDepth/2);
                } else if ((this.grid[i][j-1] && this.grid[i][j-1].z - cell.z === 1) &&
                        (!this.grid[i+1] || (this.grid[i+1][j].z <= cell.z)) &&
                        (!this.grid[i][j+1] || (this.grid[i][j+1].z <= cell.z)) &&
                        (!this.grid[i-1] || (this.grid[i-1][j].z <= cell.z))){
                    cell.setTexture('16', true, cellDepth/2);
                }else if ((this.grid[i][j+1] && this.grid[i][j+1].z - cell.z === 1) &&
                        (!this.grid[i+1] || (this.grid[i+1][j].z <= cell.z)) &&
                        (!this.grid[i][j-1] || (this.grid[i][j-1].z <= cell.z)) &&
                        (!this.grid[i-1] || (this.grid[i-1][j].z <= cell.z))){
                    cell.setTexture('13', true, cellDepth/2);
                } //Corner
                else if ((this.grid[i-1] && (this.grid[i-1][j-1] && this.grid[i-1][j-1].z - cell.z === 1)) &&
                        (!this.grid[i][j-1] || (this.grid[i][j-1].z <= cell.z)) &&
                        (!this.grid[i-1] || (this.grid[i-1][j].z <= cell.z))){
                    cell.setTexture('10', true, cellDepth/2);
                }else if ((this.grid[i+1] && (this.grid[i+1][j-1] && this.grid[i+1][j-1].z - cell.z === 1)) &&
                        (!this.grid[i][j-1] || (this.grid[i][j-1].z <= cell.z)) &&
                        (!this.grid[i+1] || (this.grid[i+1][j].z <= cell.z))){
                    cell.setTexture('12', true);
                }else if ((this.grid[i-1] && (this.grid[i-1][j+1] && this.grid[i-1][j+1].z - cell.z === 1)) &&
                        (!this.grid[i][j+1] || (this.grid[i][j+1].z <= cell.z)) &&
                        (!this.grid[i-1] || (this.grid[i-1][j].z <= cell.z))){
                    cell.setTexture('11', true);
                }else if ((this.grid[i+1] && (this.grid[i+1][j+1] && this.grid[i+1][j+1].z - cell.z === 1)) &&
                        (!this.grid[i][j+1] || (this.grid[i][j+1].z <= cell.z)) &&
                        (!this.grid[i+1] || (this.grid[i+1][j].z <= cell.z))){
                    cell.setTexture('9', true, cellDepth/2);
                }
                //Deep corner
                else if ((this.grid[i][j-1] && (this.grid[i][j-1].z && this.grid[i][j-1].z - cell.z === 1)) &&
                        (this.grid[i-1] && (this.grid[i-1][j].z && this.grid[i-1][j].z - cell.z === 1))){
                    cell.setTexture('22', true, cellDepth/2);
                }else if ((this.grid[i][j+1] && (this.grid[i][j+1].z && this.grid[i][j+1].z - cell.z === 1)) &&
                        (this.grid[i+1] && (this.grid[i+1][j].z && this.grid[i+1][j].z - cell.z === 1))){
                    cell.setTexture('21', true, cellDepth/2);
                }else if ((this.grid[i][j-1] && (this.grid[i][j-1].z && this.grid[i][j-1].z - cell.z === 1)) &&
                        (this.grid[i+1] && (this.grid[i+1][j].z && this.grid[i+1][j].z - cell.z === 1))){
                    cell.setTexture('23', true, cellDepth);
                }else if ((this.grid[i][j+1] && (this.grid[i][j+1].z && this.grid[i][j+1].z - cell.z === 1)) &&
                        (this.grid[i-1] && (this.grid[i-1][j].z && this.grid[i-1][j].z - cell.z === 1))){
                    cell.setTexture('24', true, cellDepth);
                }else{
                    let nbrTexture = randomRange(1,8);
                    cell.setTexture(nbrTexture);
                }
            }
        }
    }
    moveCamera(){
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
            x:(cellWidth/2)-this.camera.x,
            y:-this.camera.y
        };
        let B = {
            x:(cellWidth/2-(this.size * cellWidth)/2)-this.camera.x,
            y:((this.size * cellHeight)/2)-this.camera.y
        };
        let D = {
            x:(cellWidth/2+(this.size * cellWidth)/2)-this.camera.x,
            y:((this.size * cellHeight)/2)-this.camera.y
        };
        let C = {
            x:(cellWidth/2)-this.camera.x,
            y:(this.size * cellHeight)-this.camera.y
        };
        let cameraCenter = {
            x:((this.camera.x) + appWidth / 2)-this.camera.x,
            y:((this.camera.y) + appHeight / 2)-this.camera.y
        }
        //Left 
        if (mousePos.x >= appLeft && mousePos.x <= appLeft + moveDist && mousePos.y >= appTop && mousePos.y <= appHeight){
            if (cameraCenter.x - 100 > B.x && pointIsBeetweenTwoPoint(A, B, cameraCenter, 50)){
                this.camera.y += moveSpeed/(cellWidth/cellHeight);		
                this.camera.x -= moveSpeed;
            }else if (cameraCenter.x - 100 > B.x && pointIsBeetweenTwoPoint(B, C, cameraCenter, 50)){
                this.camera.y -= moveSpeed/(cellWidth/cellHeight);		
                this.camera.x -= moveSpeed;
            }else if (cameraCenter.x - 100 > B.x){
                this.camera.x -= moveSpeed;
            }
            refreshInstancesOnScreen(this);
        }else //Right
        if (mousePos.x > appWidth - moveDist && mousePos.x <= appWidth && mousePos.y >= appTop && mousePos.y <= appHeight){
            if (cameraCenter.x + 100 < D.x && pointIsBeetweenTwoPoint(A,D,cameraCenter,50)){
                this.camera.y += moveSpeed/(cellWidth/cellHeight);		
                this.camera.x += moveSpeed;
            }else if (cameraCenter.x + 100 < D.x && pointIsBeetweenTwoPoint(D,C,cameraCenter, 50)){
                this.camera.y -= moveSpeed/(cellWidth/cellHeight);		
                this.camera.x += moveSpeed;
            }else if (cameraCenter.x + 100 < D.x){
                this.camera.x += moveSpeed;
            }
            refreshInstancesOnScreen(this);
        }
        //Top
        if (mousePos.x >= appLeft && mousePos.x <= appWidth && mousePos.y >= appTop && mousePos.y <= appTop + moveDist){
            if (cameraCenter.y - 50 > A.y && pointIsBeetweenTwoPoint(A, B, cameraCenter, 50)){
                this.camera.y -= moveSpeed/(cellWidth/cellHeight);		
                this.camera.x += moveSpeed;
            }else if (cameraCenter.y - 50 > A.y && pointIsBeetweenTwoPoint(A, D, cameraCenter, 50)){
                this.camera.y -= moveSpeed/(cellWidth/cellHeight);		
                this.camera.x -= moveSpeed;
            }else if (cameraCenter.y - 50 > A.y){
                this.camera.y -= moveSpeed;
            }
            refreshInstancesOnScreen(this);
        }else //Bottom
        if (mousePos.x >= appLeft && mousePos.x <= appWidth && mousePos.y > appHeight - moveDist && mousePos.y <= appHeight){
            if (cameraCenter.y + 50 < C.y && pointIsBeetweenTwoPoint(D, C, cameraCenter, 50)){
                this.camera.y += moveSpeed/(cellWidth/cellHeight);		
                this.camera.x -= moveSpeed;
            }else if (cameraCenter.y + 50 < C.y && pointIsBeetweenTwoPoint(B, C, cameraCenter, 50)){
                this.camera.y += moveSpeed/(cellWidth/cellHeight);		
                this.camera.x += moveSpeed;
            }else if (cameraCenter.y + 100 < C.y){
                this.camera.y += moveSpeed;
            }
            refreshInstancesOnScreen(this);
        }
        function refreshInstancesOnScreen(map){
            map.x = -map.camera.x;
            map.y = -map.camera.y;
            for (let i = 0; i < map.children.length; i++){
                let instance = map.children[i];
                if (instance.x > map.camera.x && instance.x < map.camera.x + appWidth && instance.y > map.camera.y && instance.y < map.camera.y + appHeight){
                    instance.visible = true;
                }else{
                    instance.visible = false;
                }
            }
        }
    }
    step(){
        this.moveCamera();
        for(let i = 0; i < this.children.length; i++){
            if (typeof this.children[i].step === 'function'){
                this.children[i].step();
            }
        }
    }
}
