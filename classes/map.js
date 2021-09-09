/**
 * 
 *  Map size	    Tiny	    Small	    Medium	    Normal	    Large	
    Player count	2	        3	        4	        6	        8
    Dimensions	    120×120	    144×144 	168×168	    200×200	    220×220
 */

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

        this.players = [];
        this.generateMap();
        
	}
    generateMap(){
        this.removeChildren();
        this.generateCells();
                
        const playersPos = this.findPlayerPlaces();
        if (playersPos.length < 4){
            alert('Cannot find players position')
            return;
        }
        const poses = [];
        const randoms = Array.from(Array(playersPos.length).keys());
        for (let i = 0; i < 4; i++){
            const pos = randomItem(randoms);
            poses.push(pos);
            randoms.splice(randoms.indexOf(pos), 1);
        }

        this.players = [
            new Human(playersPos[poses[0]].i, playersPos[poses[0]].j, this, 'StoneAge', 'Greek', 'blue', true),
            //new AI(playersPos[poses[1]].i, playersPos[poses[1]].j, this, 'StoneAge', 'Greek', 'red'),
            //new AI(playersPos[poses[2]].i, playersPos[poses[2]].j, this, 'StoneAge', 'Greek', 'green'),
            //new AI(playersPos[poses[3]].i, playersPos[poses[3]].j, this, 'StoneAge', 'Greek', 'orange'),
        ]

        this.generateMapRelief();
        this.formatCellsRelief();
        this.formatCellsWaterBorder();
        this.formatCellsDesert();

        this.generateResourcesAroundPlayers(playersPos);

        this.generateSets();

        if (!this.revealEverything){
            for(let i = 0; i <= this.size; i++){
                for(let j = 0; j <= this.size; j++){
                    this.grid[i][j].setFog();
                }
            }
        }
        
        //Place a town center
        for (let i = 0; i < this.players.length; i++){
            const player = this.players[i];
            const towncenter = player.spawnBuilding(player.i, player.j, 'TownCenter', this, true);
            for (let i = 0; i < 3; i++ ){
                towncenter.placeUnit('Villager');
            }
        }

        //Set camera to player building else unit
        if (this.players[0].buildings.length){
            this.setCamera(this.players[0].buildings[0].x, this.players[0].buildings[0].y);
        }else if (this.players[0].units.length){
            this.setCamera(this.players[0].units[0].x, this.players[0].units[0].y);
        }

        this.displayInstancesOnScreen();
    }
    generateResourcesAroundPlayers(playersPos){
        for (let i = 0; i < playersPos.length; i ++){
            const pos = getPositionInZoneAroundInstance(playersPos[i], this.grid, [7, 15], 3, true);
            if (pos){
                this.placeResourceGroup('Berrybush', pos.i, pos.j);
            }
        }
        for (let i = 0; i < playersPos.length; i ++){
            const pos = getPositionInZoneAroundInstance(playersPos[i], this.grid, [7, 15], 3, true);
            if (pos){
                this.placeResourceGroup('Stone', pos.i, pos.j);
            }
        }
        for (let i = 0; i < playersPos.length; i ++){
            const pos = getPositionInZoneAroundInstance(playersPos[i], this.grid, [7, 15], 3, true);
            if (pos){
                this.placeResourceGroup('Gold', pos.i, pos.j);
            }
        }
    }
    generateCells(){
        const forestTrees = ['492', '493', '494', '503', '509'];
        const palmTrees = ['463', '464', '465', '466'];

        const lines = app.loader.resources['0'].data.split('\n').filter(Boolean);
        this.size = lines.length - 1;
        for(let i = 0; i <= this.size; i++){
            const cols = lines[i].split('').filter(Boolean);
            for(let j = 0; j <= this.size; j++){
                if(!this.grid[i]){
                    this.grid[i] = [];	
                }
                switch (cols[j]){
                    case '0':
                        this.grid[i][j] = new Grass(i, j, 0, this);
                        break;
                    case '1':
                        this.grid[i][j] = new Desert(i, j, 0, this);
                        break;
                    case '2':
                        this.grid[i][j] = new Grass(i, j, 0, this);
                        new Tree(i, j, this, forestTrees);
                        break;
                    case '3':
                        this.grid[i][j] = new Water(i, j, 0, this);
                        break;
                    case '4': 
                        this.grid[i][j] = new Desert(i, j, 0, this);
                        new Tree(i, j, this, palmTrees);
                        break;
                    case '5': 
                        this.grid[i][j] = new Grass(i, j, 0, this);
                        new Tree(i, j, this, palmTrees);
                        break;
                }
            }
        }
        for(let i = 0; i <= this.size; i++){
            for(let j = 0; j <= this.size; j++){
                this.grid[i][j].fillWaterCellsAroundCell();
            }
        }
    }
    generateSets(){
        const forestTrees = ['492', '493', '494', '503', '509'];
        const palmTrees = ['463', '464', '465', '466'];

        for(let i = 0; i <= this.size; i++){
            for(let j = 0; j <= this.size; j++){
                const cell = this.grid[i][j];
                if (cell.type !== 'water' && !cell.solid && !cell.border && !cell.inclined){
                    if (Math.random() < .03 && i > 1 && j > 1 && i < this.size && j < this.size){
                        const randomSpritesheet = randomRange(292, 301);
                        const spritesheet = app.loader.resources[randomSpritesheet].spritesheet;
                        const texture = spritesheet.textures['000_' + randomSpritesheet + '.png'];
                        const floor = new PIXI.Sprite(texture);
                        floor.name = 'floor';
                        floor.updateAnchor = true;
                        cell.addChild(floor);
                    }
                    if (Math.random() < this.chanceOfSets){
                        const type = randomItem(['Tree', 'rock']);
                        switch (type){
                            case 'Tree':
                                if (cell.type === 'grass'){
                                    new Tree(i, j, this, forestTrees);
                                }else if (cell.type === 'desert'){
                                    new Tree(i, j, this, palmTrees);
                                }
                                break;
                            case 'rock':
                                const randomSpritesheet = randomRange(531, 534);
                                const spritesheet = app.loader.resources[randomSpritesheet].spritesheet;
                                const texture = spritesheet.textures['000_' + randomSpritesheet + '.png'];
                                const rock = new PIXI.Sprite(texture);
                                rock.name = 'set';
                                rock.updateAnchor = true;
                                cell.addChild(rock);
                                break;
                        }
                    }
                }
            }
        }
    }
    generateMapRelief(){
        for(let i = 0; i <= this.size; i++){
            for(let j = 0; j <= this.size; j++){
                const cell = this.grid[i][j];
                if (Math.random() < this.chanceOfRelief){
                    const level = randomRange(this.reliefRange[0],this.reliefRange[1]);
                    let canGenerate = true;
                    if (getPlainCellsAroundPoint(i, j, this.grid, level * 2, (cell) => {
                        if (cell.type === 'water' || cell.type === 'building'){
                            canGenerate = false;
                        }
                    }));
                    if (canGenerate){
                        cell.setCellLevel(level);
                    }
                }
            }
        }
        //Format cell's relief
        for(let i = 0; i <= this.size; i++){
            for(let j = 0; j <= this.size; j++){
                const cell = this.grid[i][j];
                cell.fillReliefCellsAroundCell();
            }
        }
    }
    formatCellsRelief(){
        for(let i = 0; i <= this.size; i++){
            for(let j = 0; j <= this.size; j++){
                const cell = this.grid[i][j];
                //Side
                if ((this.grid[i-1] && this.grid[i-1][j].z - cell.z === 1) &&
                        (!this.grid[i+1] || (this.grid[i+1][j].z <= cell.z)) &&
                        (!this.grid[i][j-1] || (this.grid[i][j-1].z <= cell.z)) &&
                        (!this.grid[i][j+1] || (this.grid[i][j+1].z <= cell.z))){
                    cell.setReliefBorder('014', cellDepth/2);
                }else if ((this.grid[i+1] && this.grid[i+1][j].z - cell.z === 1) &&
                        (!this.grid[i-1] || (this.grid[i-1][j].z <= cell.z)) &&
                        (!this.grid[i][j-1] || (this.grid[i][j-1].z <= cell.z)) &&
                        (!this.grid[i][j+1] || (this.grid[i][j+1].z <= cell.z))){
                    cell.setReliefBorder('015', cellDepth/2);
                } else if ((this.grid[i][j-1] && this.grid[i][j-1].z - cell.z === 1) &&
                        (!this.grid[i+1] || (this.grid[i+1][j].z <= cell.z)) &&
                        (!this.grid[i][j+1] || (this.grid[i][j+1].z <= cell.z)) &&
                        (!this.grid[i-1] || (this.grid[i-1][j].z <= cell.z))){
                    cell.setReliefBorder('016', cellDepth/2);
                }else if ((this.grid[i][j+1] && this.grid[i][j+1].z - cell.z === 1) &&
                        (!this.grid[i+1] || (this.grid[i+1][j].z <= cell.z)) &&
                        (!this.grid[i][j-1] || (this.grid[i][j-1].z <= cell.z)) &&
                        (!this.grid[i-1] || (this.grid[i-1][j].z <= cell.z))){
                    cell.setReliefBorder('013', cellDepth/2);
                } //Corner
                else if ((this.grid[i-1] && (this.grid[i-1][j-1] && this.grid[i-1][j-1].z - cell.z === 1)) &&
                        (!this.grid[i][j-1] || (this.grid[i][j-1].z <= cell.z)) &&
                        (!this.grid[i-1] || (this.grid[i-1][j].z <= cell.z))){
                    cell.setReliefBorder('010', cellDepth/2);
                }else if ((this.grid[i+1] && (this.grid[i+1][j-1] && this.grid[i+1][j-1].z - cell.z === 1)) &&
                        (!this.grid[i][j-1] || (this.grid[i][j-1].z <= cell.z)) &&
                        (!this.grid[i+1] || (this.grid[i+1][j].z <= cell.z))){
                    cell.setReliefBorder('012');
                }else if ((this.grid[i-1] && (this.grid[i-1][j+1] && this.grid[i-1][j+1].z - cell.z === 1)) &&
                        (!this.grid[i][j+1] || (this.grid[i][j+1].z <= cell.z)) &&
                        (!this.grid[i-1] || (this.grid[i-1][j].z <= cell.z))){
                    cell.setReliefBorder('011');
                }else if ((this.grid[i+1] && (this.grid[i+1][j+1] && this.grid[i+1][j+1].z - cell.z === 1)) &&
                        (!this.grid[i][j+1] || (this.grid[i][j+1].z <= cell.z)) &&
                        (!this.grid[i+1] || (this.grid[i+1][j].z <= cell.z))){
                    cell.setReliefBorder('009', cellDepth/2);
                }
                //Deep corner
                else if ((this.grid[i][j-1] && (this.grid[i][j-1].z - cell.z === 1)) &&
                        (this.grid[i-1] && (this.grid[i-1][j].z - cell.z === 1))){
                    cell.setReliefBorder('022', cellDepth/2);
                }else if ((this.grid[i][j+1] && (this.grid[i][j+1].z - cell.z === 1)) &&
                        (this.grid[i+1] && (this.grid[i+1][j].z - cell.z === 1))){
                    cell.setReliefBorder('021', cellDepth/2);
                }else if ((this.grid[i][j-1] && (this.grid[i][j-1].z - cell.z === 1)) &&
                        (this.grid[i+1] && (this.grid[i+1][j].z - cell.z === 1))){
                    cell.setReliefBorder('023', cellDepth);
                }else if ((this.grid[i][j+1] && (this.grid[i][j+1].z - cell.z === 1)) &&
                        (this.grid[i-1] && (this.grid[i-1][j].z - cell.z === 1))){
                    cell.setReliefBorder('024', cellDepth);
                }
            }
        }
    }
    formatCellsWaterBorder(){
        for(let i = 0; i <= this.size; i++){
            for(let j = 0; j <= this.size; j++){
                const cell = this.grid[i][j];
                if (cell.type !== 'water'){
                    //Side
                    if ((this.grid[i-1] && this.grid[i-1][j].type === 'water') &&
                            (!this.grid[i+1] || (this.grid[i+1][j].type !== 'water')) &&
                            (!this.grid[i][j-1] || (this.grid[i][j-1].type !== 'water')) &&
                            (!this.grid[i][j+1] || (this.grid[i][j+1].type !== 'water'))){
                        cell.setWaterBorder(cell, '20000', '008');
                    }else if ((this.grid[i+1] && this.grid[i+1][j].type === 'water') &&
                            (!this.grid[i-1] || (this.grid[i-1][j].type !== 'water')) &&
                            (!this.grid[i][j-1] || (this.grid[i][j-1].type !== 'water')) &&
                            (!this.grid[i][j+1] || (this.grid[i][j+1].type !== 'water'))){
                        cell.setWaterBorder(cell, '20000', '009');
                    } else if ((this.grid[i][j-1] && this.grid[i][j-1].type === 'water') &&
                            (!this.grid[i+1] || (this.grid[i+1][j].type !== 'water')) &&
                            (!this.grid[i][j+1] || (this.grid[i][j+1].type !== 'water')) &&
                            (!this.grid[i-1] || (this.grid[i-1][j].type !== 'water'))){
                        cell.setWaterBorder(cell, '20000', '011');
                    }else if ((this.grid[i][j+1] && this.grid[i][j+1].type === 'water') &&
                            (!this.grid[i+1] || (this.grid[i+1][j].type !== 'water')) &&
                            (!this.grid[i][j-1] || (this.grid[i][j-1].type !== 'water')) &&
                            (!this.grid[i-1] || (this.grid[i-1][j].type !== 'water'))){
                        cell.setWaterBorder(cell, '20000', '010');
                    }//Corner
                    else if ((this.grid[i-1] && (this.grid[i-1][j-1] && this.grid[i-1][j-1].type === 'water')) &&
                            (!this.grid[i][j-1] || (this.grid[i][j-1].type !== 'water')) &&
                            (!this.grid[i-1] || (this.grid[i-1][j].type !== 'water'))){
                        cell.setWaterBorder(cell, '20000', '005');
                    }else if ((this.grid[i+1] && (this.grid[i+1][j-1] && this.grid[i+1][j-1].type === 'water')) &&
                            (!this.grid[i][j-1] || (this.grid[i][j-1].type !== 'water')) &&
                            (!this.grid[i+1] || (this.grid[i+1][j].type !== 'water'))){
                        cell.setWaterBorder(cell, '20000', '007');
                    }else if ((this.grid[i-1] && (this.grid[i-1][j+1] && this.grid[i-1][j+1].type === 'water')) &&
                            (!this.grid[i][j+1] || (this.grid[i][j+1].type !== 'water')) &&
                            (!this.grid[i-1] || (this.grid[i-1][j].type !== 'water'))){
                        cell.setWaterBorder(cell, '20000', '004');
                    }else if ((this.grid[i+1] && (this.grid[i+1][j+1] && this.grid[i+1][j+1].type === 'water')) &&
                            (!this.grid[i][j+1] || (this.grid[i][j+1].type !== 'water')) &&
                            (!this.grid[i+1] || (this.grid[i+1][j].type !== 'water'))){
                        cell.setWaterBorder(cell, '20000', '006');
                    }
                    //Deep corner
                    else if ((this.grid[i][j-1] && (this.grid[i][j-1].type === 'water')) &&
                            (this.grid[i-1] && (this.grid[i-1][j].type === 'water'))){
                        cell.setWaterBorder(cell, '20000', '001');
                    }else if ((this.grid[i][j+1] && (this.grid[i][j+1].type === 'water')) &&
                            (this.grid[i+1] && (this.grid[i+1][j].type === 'water'))){
                        cell.setWaterBorder(cell, '20000', '002');
                    }else if ((this.grid[i][j-1] && (this.grid[i][j-1].type === 'water')) &&
                            (this.grid[i+1] && (this.grid[i+1][j].type === 'water'))){
                        cell.setWaterBorder(cell, '20000', '003');
                    }else if ((this.grid[i][j+1] && (this.grid[i][j+1].type === 'water')) &&
                            (this.grid[i-1] && (this.grid[i-1][j].type === 'water'))){
                        cell.setWaterBorder(cell, '20000', '000');
                    }
                }else{
                    if (cell.has){
                        cell.has.destroy();
                    }
                }
            }
        }
    }
    findPlayerPlaces(){
        const results = [];
        const outBorder = 20;
        const inBorder = Math.floor(this.size / 4);
        const zones = [{              
                minX: outBorder,
                minY: this.size/2 + inBorder,
                maxX: this.size/2 - inBorder,
                maxY: this.size - outBorder,
            },
            {
                minX: outBorder,
                minY: outBorder,
                maxX: this.size/2 - inBorder,
                maxY: this.size/2 - inBorder,
            },
            {
                minX: this.size/2 + inBorder,
                minY: outBorder,
                maxX: this.size - outBorder,
                maxY: this.size/2 - inBorder,
            },
            {
                minX: this.size/2 + inBorder,
                minY: this.size/2 + inBorder,
                maxX: this.size - outBorder,
                maxY: this.size - outBorder,
            }
        ]
        for (let i = 0; i < zones.length; i ++){
            const pos = getZoneInZoneWithCondition(zones[i], this.grid, 5, (cell) => {
                return (!cell.border && !cell.solid && !cell.inclined);
            });
            if (pos){
                results.push(pos);
            }
        }
        return results;
    }
    placeResourceGroup(instance, startX, startY){
        const resources = {
            Tree,
            Berrybush,
            Stone,
            Gold
        }
        let cpt = 0;
        const max = randomRange(5, 6);
        for (let i = 0; i < 10; i++){
            getCellsAroundPoint(startX, startY, this.grid, i, (cell) => {
                if (cpt > max){
                    return;
                }
                if (Math.random() < .5 && !cell.solid && !cell.border){
                    cpt++;
                    new resources[instance](cell.i, cell.j, this);
                }
            })
            if (cpt > max){
                return;
            }
        }
    }
    formatCellsDesert(){
        for(let i = 0; i <= this.size; i++){
            for(let j = 0; j <= this.size; j++){
                const cell = this.grid[i][j];
                if (cell.type === 'desert'){
                    if (this.grid[i-1] && this.grid[i-1][j] && this.grid[i-1][j].type === 'grass'){
                        this.grid[i-1][j].setDesertBorder('est');
                    }
                    if (this.grid[i+1] && this.grid[i+1][j] && this.grid[i+1][j].type === 'grass'){
                        this.grid[i+1][j].setDesertBorder('west');
                    }
                    if (this.grid[i][j-1] && this.grid[i][j-1].type === 'grass'){
                        this.grid[i][j-1].setDesertBorder('south');
                    }
                    if (this.grid[i][j+1] && this.grid[i][j+1].type === 'grass'){
                        this.grid[i][j+1].setDesertBorder('north');
                    }
                }
            }
        }
    }
    moveCamera(dir, speed = 20){
        /**
         * 	/A\
         * /   \
         *B     D
         * \   /
         *  \C/ 
         */
        const A = { x:(cellWidth/2)-this.camera.x,  y:-this.camera.y };
        const B = { x:(cellWidth/2-(this.size * cellWidth)/2)-this.camera.x, y:((this.size * cellHeight)/2)-this.camera.y };
        const D = { x:(cellWidth/2+(this.size * cellWidth)/2)-this.camera.x, y:((this.size * cellHeight)/2)-this.camera.y };
        const C = { x:(cellWidth/2)-this.camera.x, y:(this.size * cellHeight)-this.camera.y };
        const cameraCenter = { x:((this.camera.x) + appWidth / 2)-this.camera.x, y:((this.camera.y) + appHeight / 2)-this.camera.y }
        this.clearInstancesOnScreen();
        if (dir === 'left'){
            if (cameraCenter.x - 100 > B.x && pointIsBetweenTwoPoint(A, B, cameraCenter, 50)){
                this.camera.y += speed/(cellWidth/cellHeight);		
                this.camera.x -= speed;
            }else if (cameraCenter.x - 100 > B.x && pointIsBetweenTwoPoint(B, C, cameraCenter, 50)){
                this.camera.y -= speed/(cellWidth/cellHeight);		
                this.camera.x -= speed;
            }else if (cameraCenter.x - 100 > B.x){
                this.camera.x -= speed;
            }
        }else if (dir === 'right'){
            if (cameraCenter.x + 100 < D.x && pointIsBetweenTwoPoint(A,D,cameraCenter,50)){
                this.camera.y += speed/(cellWidth/cellHeight);		
                this.camera.x += speed;
            }else if (cameraCenter.x + 100 < D.x && pointIsBetweenTwoPoint(D,C,cameraCenter, 50)){
                this.camera.y -= speed/(cellWidth/cellHeight);		
                this.camera.x += speed;
            }else if (cameraCenter.x + 100 < D.x){
                this.camera.x += speed;
            }
        }
        if (dir === 'up'){
            if (cameraCenter.y - 50 > A.y && pointIsBetweenTwoPoint(A, B, cameraCenter, 50)){
                this.camera.y -= speed/(cellWidth/cellHeight);		
                this.camera.x += speed;
            }else if (cameraCenter.y - 50 > A.y && pointIsBetweenTwoPoint(A, D, cameraCenter, 50)){
                this.camera.y -= speed/(cellWidth/cellHeight);		
                this.camera.x -= speed;
            }else if (cameraCenter.y - 50 > A.y){
                this.camera.y -= speed;
            }
        }else if (dir === 'down'){
            if (cameraCenter.y + 50 < C.y && pointIsBetweenTwoPoint(D, C, cameraCenter, 50)){
                this.camera.y += speed/(cellWidth/cellHeight);		
                this.camera.x -= speed;
            }else if (cameraCenter.y + 50 < C.y && pointIsBetweenTwoPoint(B, C, cameraCenter, 50)){
                this.camera.y += speed/(cellWidth/cellHeight);		
                this.camera.x += speed;
            }else if (cameraCenter.y + 100 < C.y){
                this.camera.y += speed;
            }
        }
        this.displayInstancesOnScreen();
    }
    moveCameraWithMouse(){
        if (mouse.out){
            return;
        }
        const coef = 1.2;
        const moveDist = 10;
        if (mouse.x >= 0 && mouse.x <= 0 + moveDist && mouse.y >= 0 && mouse.y <= appHeight){
            this.moveCamera('left', ((0 + moveDist) - mouse.x) * coef);
        }else if (mouse.x > appWidth - moveDist && mouse.x <= appWidth && mouse.y >= 0 && mouse.y <= appHeight){
            this.moveCamera('right',  (mouse.x - (appWidth - moveDist)) * coef);
        }
        if (mouse.x >= 0 && mouse.x <= appWidth && mouse.y >= 0 && mouse.y <= 0 + moveDist){
            this.moveCamera('up', ((0 + moveDist) - mouse.y) * coef);
        }else if (mouse.x >= 0 && mouse.x <= appWidth && mouse.y > appHeight - moveDist && mouse.y <= appHeight){
            this.moveCamera('down', (mouse.y - (appHeight - moveDist)) * coef);
        }
    }
    clearInstancesOnScreen(){
        this.x = -this.camera.x;
        this.y = -this.camera.y;
        const cameraCenter = {
            x:((this.camera.x) + app.screen.width / 2),
            y:((this.camera.y) + app.screen.height / 2)
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
        const cameraCenter = {
            x:((this.camera.x) + app.screen.width / 2),
            y:((this.camera.y) + app.screen.height / 2)
        }
        const coordinate = isometricToCartesian(cameraCenter.x, cameraCenter.y);
        const dist = Math.round(appWidth / cellWidth);
        getPlainCellsAroundPoint(coordinate[0], coordinate[1], this.grid, dist, (cell) => {
            if (!this.revealEverything && !player.views[cell.i][cell.j].viewed){
                return;
            }
            cell.visible = true;
            if (cell.has){
                if (this.revealEverything 
                    || !cell.has.player 
                    || cell.has.player.isPlayed
                    || instanceIsInPlayerSight(cell.has, player) 
                    || (cell.has.name === 'building' && player.views[cell.i][cell.j].has && player.views[cell.i][cell.j].has.id === cell.has.id)){
                    cell.has.visible = true;
                }
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
        if (!mouseRectangle){
            this.moveCameraWithMouse();
        }
    }
}
