class Map extends PIXI.Container{
	constructor(size, reliefRange, chanceOfRelief, chanceOfSets, revealEverything){
        super();
		this.size = size;
        this.reliefRange = reliefRange;
        this.chanceOfRelief = chanceOfRelief;
        this.chanceOfSets = chanceOfSets;
        this.revealEverything = revealEverything;
        this.grid = [];
        this.sortableChildren = true;
        this.camera = {
            x: -appWidth / 2,
            y: -(appHeight / 2) + 200
        }
        this.top = appTop + 24;
        this.bottom = appHeight - 100;
        this.x = -this.camera.x;
        this.y = -this.camera.y;
        this.resources = [];
        this.cursor = 'default';
        this.player = new Player(this);
        this.interface = new Interface(this);
        this.initMap();
	}
    initMap(){
        this.removeChildren();
        //Set cell's to map
        for(let i = 0; i <= this.size; i++){
            for(let j = 0; j <= this.size; j++){
                if(this.grid[i] == null){
                    this.grid[i] = [];	
                }
                let level = 0;
                if (Math.random() < this.chanceOfRelief){
                    level = randomRange(this.reliefRange[0],this.reliefRange[1]);
                }
                
                let cell = new Cell(i, j, level, this);
                this.grid[i][j] = cell;
            }
        }
        //Format cell's
        for(let i = 0; i <= this.size; i++){
            for(let j = 0; j <= this.size; j++){
                let cell = this.grid[i][j];
                if (cell.z > 0){
                    cell.setCellLevel(cell.z);
                }
                cell.fillCellsAroundCell();
            }
        }
        this.formatCells();
        //Set seed's to map
        for(let i = 0; i <= this.size; i++){
            for(let j = 0; j <= this.size; j++){
                let cell = this.grid[i][j];
                if (Math.random() < .03 && i > 1 && j > 1 && i < this.size && j < this.size){
                    const randomSpritesheet = randomRange(292, 301);
                    const spritesheet = app.loader.resources[randomSpritesheet].spritesheet;
                    const texture = spritesheet.textures['000_' + randomSpritesheet + '.png'];
                    let floor = new PIXI.Sprite(texture);
                    floor.name = 'floor';
                    floor.updateAnchor = true;
                    cell.addChild(floor);
                }
                if (!cell.solid && !cell.inclined && Math.random() < this.chanceOfSets){
                    const type = randomItem(['tree', 'rock']);
                    switch (type){
                        case 'tree':
                            let tree = new Tree(i, j, this);
                            cell.has = tree;
                            cell.solid = true;
                            this.resources.push(tree);
                            break;
                        case 'rock':
                            const randomSpritesheet = randomRange(531, 534);
		                    const spritesheet = app.loader.resources[randomSpritesheet].spritesheet;
		                    const texture = spritesheet.textures['000_' + randomSpritesheet + '.png'];
                            let rock = new PIXI.Sprite(texture);
                            rock.name = 'set';
                            rock.updateAnchor = true;
                            cell.addChild(rock);
                            break;
                    }
            
                }
            }
        }
        //Set berrybush's to map
        /*for(let i = 0; i < this.size; i++){
            for(let j = 0; j < this.size; j++){
                let cell = this.grid[i][j];
                if (!cell.solid && !cell.inclined && Math.random() < this.chanceOfTree){
                    let berrybush = new Berrybush(i, j, this);
                    this.resources.push(berrybush);
                }
            }
        }*/
        //Place a town center
        const i = Math.floor(randomRange(3, this.size-3));
        const j = Math.floor(randomRange(3, this.size-3));
        getPlainCellsAroundPoint(i, j, this.grid, 4, (cell) => {
            if (cell.has){
                if (cell.has.name === 'resource'){
                    cell.has.destroy();
                }
            }
        });
        let towncenter = this.player.createBuilding(i, j, 'TownCenter', this, true);
        this.setCamera(towncenter.x, towncenter.y);
        this.displayInstancesOnScreen();
    }
    formatCells(){
        for(let i = 0; i <= this.size; i++){
            for(let j = 0; j <= this.size; j++){
                let cell = this.grid[i][j];
                //Side
                if ((this.grid[i-1] && this.grid[i-1][j].z - cell.z === 1) &&
                        (!this.grid[i+1] || (this.grid[i+1][j].z <= cell.z)) &&
                        (!this.grid[i][j-1] || (this.grid[i][j-1].z <= cell.z)) &&
                        (!this.grid[i][j+1] || (this.grid[i][j+1].z <= cell.z))){
                    cell.setTexture('014', true, cellDepth/2);
                }else if ((this.grid[i+1] && this.grid[i+1][j].z - cell.z === 1) &&
                        (!this.grid[i-1] || (this.grid[i-1][j].z <= cell.z)) &&
                        (!this.grid[i][j-1] || (this.grid[i][j-1].z <= cell.z)) &&
                        (!this.grid[i][j+1] || (this.grid[i][j+1].z <= cell.z))){
                    cell.setTexture('015', true, cellDepth/2);
                } else if ((this.grid[i][j-1] && this.grid[i][j-1].z - cell.z === 1) &&
                        (!this.grid[i+1] || (this.grid[i+1][j].z <= cell.z)) &&
                        (!this.grid[i][j+1] || (this.grid[i][j+1].z <= cell.z)) &&
                        (!this.grid[i-1] || (this.grid[i-1][j].z <= cell.z))){
                    cell.setTexture('016', true, cellDepth/2);
                }else if ((this.grid[i][j+1] && this.grid[i][j+1].z - cell.z === 1) &&
                        (!this.grid[i+1] || (this.grid[i+1][j].z <= cell.z)) &&
                        (!this.grid[i][j-1] || (this.grid[i][j-1].z <= cell.z)) &&
                        (!this.grid[i-1] || (this.grid[i-1][j].z <= cell.z))){
                    cell.setTexture('013', true, cellDepth/2);
                } //Corner
                else if ((this.grid[i-1] && (this.grid[i-1][j-1] && this.grid[i-1][j-1].z - cell.z === 1)) &&
                        (!this.grid[i][j-1] || (this.grid[i][j-1].z <= cell.z)) &&
                        (!this.grid[i-1] || (this.grid[i-1][j].z <= cell.z))){
                    cell.setTexture('010', true, cellDepth/2);
                }else if ((this.grid[i+1] && (this.grid[i+1][j-1] && this.grid[i+1][j-1].z - cell.z === 1)) &&
                        (!this.grid[i][j-1] || (this.grid[i][j-1].z <= cell.z)) &&
                        (!this.grid[i+1] || (this.grid[i+1][j].z <= cell.z))){
                    cell.setTexture('012', true);
                }else if ((this.grid[i-1] && (this.grid[i-1][j+1] && this.grid[i-1][j+1].z - cell.z === 1)) &&
                        (!this.grid[i][j+1] || (this.grid[i][j+1].z <= cell.z)) &&
                        (!this.grid[i-1] || (this.grid[i-1][j].z <= cell.z))){
                    cell.setTexture('011', true);
                }else if ((this.grid[i+1] && (this.grid[i+1][j+1] && this.grid[i+1][j+1].z - cell.z === 1)) &&
                        (!this.grid[i][j+1] || (this.grid[i][j+1].z <= cell.z)) &&
                        (!this.grid[i+1] || (this.grid[i+1][j].z <= cell.z))){
                    cell.setTexture('009', true, cellDepth/2);
                }
                //Deep corner
                else if ((this.grid[i][j-1] && (this.grid[i][j-1].z && this.grid[i][j-1].z - cell.z === 1)) &&
                        (this.grid[i-1] && (this.grid[i-1][j].z && this.grid[i-1][j].z - cell.z === 1))){
                    cell.setTexture('022', true, cellDepth/2);
                }else if ((this.grid[i][j+1] && (this.grid[i][j+1].z && this.grid[i][j+1].z - cell.z === 1)) &&
                        (this.grid[i+1] && (this.grid[i+1][j].z && this.grid[i+1][j].z - cell.z === 1))){
                    cell.setTexture('021', true, cellDepth/2);
                }else if ((this.grid[i][j-1] && (this.grid[i][j-1].z && this.grid[i][j-1].z - cell.z === 1)) &&
                        (this.grid[i+1] && (this.grid[i+1][j].z && this.grid[i+1][j].z - cell.z === 1))){
                    cell.setTexture('023', true, cellDepth);
                }else if ((this.grid[i][j+1] && (this.grid[i][j+1].z && this.grid[i][j+1].z - cell.z === 1)) &&
                        (this.grid[i-1] && (this.grid[i-1][j].z && this.grid[i-1][j].z - cell.z === 1))){
                    cell.setTexture('024', true, cellDepth);
                }else{
                    let nbrTexture = randomRange(1,8);
                    cell.setTexture('00' + nbrTexture);
                }
                /*let text = new PIXI.Text(i+'/'+j,{ fontSize: 12, fill : colorBlack, align : 'center'});
                text.x = -10;
                text.y = -10;
                text.zIndex = 10000;
                cell.addChild(text);*/
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
        const moveSpeed = 10;
        const moveDist = 10;
        const A = { x:(cellWidth/2)-this.camera.x,  y:-this.camera.y };
        const B = { x:(cellWidth/2-(this.size * cellWidth)/2)-this.camera.x, y:((this.size * cellHeight)/2)-this.camera.y };
        const D = { x:(cellWidth/2+(this.size * cellWidth)/2)-this.camera.x, y:((this.size * cellHeight)/2)-this.camera.y };
        const C = { x:(cellWidth/2)-this.camera.x, y:(this.size * cellHeight)-this.camera.y };
        const cameraCenter = { x:((this.camera.x) + appWidth / 2)-this.camera.x, y:((this.camera.y) + appHeight / 2)-this.camera.y }
        //Left 
        if (mousePos.x >= appLeft && mousePos.x <= appLeft + moveDist && mousePos.y >= appTop && mousePos.y <= appHeight){
            this.clearInstancesOnScreen();
            if (cameraCenter.x - 100 > B.x && pointIsBetweenTwoPoint(A, B, cameraCenter, 50)){
                this.camera.y += moveSpeed/(cellWidth/cellHeight);		
                this.camera.x -= moveSpeed;
            }else if (cameraCenter.x - 100 > B.x && pointIsBetweenTwoPoint(B, C, cameraCenter, 50)){
                this.camera.y -= moveSpeed/(cellWidth/cellHeight);		
                this.camera.x -= moveSpeed;
            }else if (cameraCenter.x - 100 > B.x){
                this.camera.x -= moveSpeed;
            }
            this.displayInstancesOnScreen();
        }else //Right
        if (mousePos.x > appWidth - moveDist && mousePos.x <= appWidth && mousePos.y >= appTop && mousePos.y <= appHeight){
            this.clearInstancesOnScreen();
            if (cameraCenter.x + 100 < D.x && pointIsBetweenTwoPoint(A,D,cameraCenter,50)){
                this.camera.y += moveSpeed/(cellWidth/cellHeight);		
                this.camera.x += moveSpeed;
            }else if (cameraCenter.x + 100 < D.x && pointIsBetweenTwoPoint(D,C,cameraCenter, 50)){
                this.camera.y -= moveSpeed/(cellWidth/cellHeight);		
                this.camera.x += moveSpeed;
            }else if (cameraCenter.x + 100 < D.x){
                this.camera.x += moveSpeed;
            }
            this.displayInstancesOnScreen();
        }
        //Top
        if (mousePos.x >= appLeft && mousePos.x <= appWidth && mousePos.y >= appTop && mousePos.y <= appTop + moveDist){
            this.clearInstancesOnScreen();
            if (cameraCenter.y - 50 > A.y && pointIsBetweenTwoPoint(A, B, cameraCenter, 50)){
                this.camera.y -= moveSpeed/(cellWidth/cellHeight);		
                this.camera.x += moveSpeed;
            }else if (cameraCenter.y - 50 > A.y && pointIsBetweenTwoPoint(A, D, cameraCenter, 50)){
                this.camera.y -= moveSpeed/(cellWidth/cellHeight);		
                this.camera.x -= moveSpeed;
            }else if (cameraCenter.y - 50 > A.y){
                this.camera.y -= moveSpeed;
            }
            this.displayInstancesOnScreen();
        }else //Bottom
        if (mousePos.x >= appLeft && mousePos.x <= appWidth && mousePos.y > appHeight - moveDist && mousePos.y <= appHeight){
            this.clearInstancesOnScreen();
            if (cameraCenter.y + 50 < C.y && pointIsBetweenTwoPoint(D, C, cameraCenter, 50)){
                this.camera.y += moveSpeed/(cellWidth/cellHeight);		
                this.camera.x -= moveSpeed;
            }else if (cameraCenter.y + 50 < C.y && pointIsBetweenTwoPoint(B, C, cameraCenter, 50)){
                this.camera.y += moveSpeed/(cellWidth/cellHeight);		
                this.camera.x += moveSpeed;
            }else if (cameraCenter.y + 100 < C.y){
                this.camera.y += moveSpeed;
            }
            this.displayInstancesOnScreen();
        }
    }
    clearInstancesOnScreen(){
        this.x = -this.camera.x;
        this.y = -this.camera.y;
        if (!this.revealEverything){
            return;
        }
        const cameraCenter = {
            x:((this.camera.x) + appWidth / 2),
            y:((this.camera.y) + appHeight / 2)
        }
        const coordinate = isometricToCartesian(cameraCenter.x, cameraCenter.y);
        const dist = Math.round(appWidth / cellWidth) + 2;
        getPlainCellsAroundPoint(coordinate[0], coordinate[1], this.grid, dist, (cell) => {
            cell.visible = false;
            if (cell.has){
                cell.has.visible = false;
            }
        })
    }
    displayInstancesOnScreen(){
        this.x = -this.camera.x;
        this.y = -this.camera.y;
        if (!this.revealEverything){
            return;
        }
        const cameraCenter = {
            x:((this.camera.x) + appWidth / 2),
            y:((this.camera.y) + appHeight / 2)
        }
        const coordinate = isometricToCartesian(cameraCenter.x, cameraCenter.y);
        const dist = Math.round(appWidth / cellWidth);
        getPlainCellsAroundPoint(coordinate[0], coordinate[1], this.grid, dist, (cell) => {
            cell.visible = true;
            if (cell.has){
                cell.has.visible = true;
            }
        })
    }
    setCamera(x, y){
        this.camera = {
            x: x-appWidth / 2,
            y: y-appHeight / 2
        }
        this.x = -this.camera.x;
        this.y = -this.camera.y;
    }
    step(){
        /*for(let i = 0; i <= this.size; i++){
            for(let j = 0; j <= this.size; j++){
                let cell = this.grid[i][j];
                let sprite = cell.getChildByName('sprite');
                if (cell.has && cell.has.name === 'unit'){
                    sprite.tint = colorRed;
                }else if (cell.solid && cell.has && cell.has.name === 'resource'){
                    sprite.tint = colorBlue;
                }else if (cell.solid && cell.has && cell.has.name === 'building'){
                    sprite.tint = colorViolet;
                }else{
                    sprite.tint = colorWhite;
                }
            }
        }*/
        if (!mouseRectangle){
            this.moveCamera();
        }
        for(let i = 0; i < this.children.length; i++){
            if (typeof this.children[i].step === 'function'){
                this.children[i].step();
            }
        }
    }
}
