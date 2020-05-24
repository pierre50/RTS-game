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
        this.border = false;
        this.has = null;
        this.visible = false;
        this.type = 'grass';
    }
    addDesertBorder(direction){
        const resourceName = '20002';
        let index;
        const cellSprite = this.getChildByName('sprite');
        const cellSpriteTextureName = cellSprite.texture.textureCacheIds[0];
        const cellSpriteIndex = cellSpriteTextureName.split('_')[0];
        let val = {}
        let cpt = 0;
        for (let i = 0; i < 25; i++){
            val[i] = [];
            if (i < 9){
                val[i].push(0, 1, 2, 3);
            }else{
                for (let j = cpt; j < cpt + 4; j++){
                    val[i].push(j + 4);
                }
                cpt += 4;
            }
        }
        switch (direction){
            case 'west':
                index = val[cellSpriteIndex*1][0];
                break;
            case 'north':
                index = val[cellSpriteIndex*1][1];
                break;
            case 'south':
                index = val[cellSpriteIndex*1][2];
                break;      
            case 'est':
                index = val[cellSpriteIndex*1][3];
                break;
        }
        const spritesheet = app.loader.resources[resourceName].spritesheet;
        const texture = spritesheet.textures[formatNumber(index) + '_' + resourceName + '.png'];
        let sprite = new PIXI.Sprite(texture);
        sprite.direction = direction;
        sprite.anchor.set(0.5, 0.5);
        sprite.type = 'border';
        this.addChild(sprite);
    }
    setBorder(cell, resourceName, index){
        let sprite = this.getChildByName('sprite');
        const spritesheet = app.loader.resources[resourceName].spritesheet;
        const texture = spritesheet.textures[index + '_' + resourceName + '.png'];
        cell.type = 'desert';
        cell.border = true;
        if (cell.has && typeof cell.has.destroy === 'function'){
            cell.has.destroy();
        }
        sprite.texture = texture;
    }
    setResource(resourceName){
        let sprite = this.getChildByName('sprite');
        const textureName = sprite.texture.textureCacheIds[0];
        const spritesheet = app.loader.resources[resourceName].spritesheet;
        let index = textureName.split('_')[0];
        if (['15002', '15003'].indexOf(resourceName) >= 0){
            //this.removeChild(sprite);
            if (index * 1 < 9){
                index = '00' + randomRange(0, 3);
            }else{
                index = '00' + (index *  1 - 4);
            }
            /*let animated = new PIXI.AnimatedSprite(spritesheet.animations['wave']);
            animated.gotoAndPlay(randomRange(0, 3));
            animated.animationSpeed = .01;
            animated.name = 'sprite';
            animated.anchor.set(.5, .5);
            this.addChild(animated);
            return;*/
        }
        sprite.texture = spritesheet.textures[index + '_' + resourceName + '.png'];
    }
    setTexture(index, inclined = false, elevation = 0){
        const resourceName = '15001';
        const spritesheet = app.loader.resources[resourceName].spritesheet;
        const texture = spritesheet.textures[index + '_' + resourceName + '.png'];
        if (elevation){
            this.y -= elevation;
        }
        this.inclined = inclined;
        let sprite = new PIXI.Sprite(texture);
        sprite.name = 'sprite';
        sprite.anchor.set(.5, .5);

        this.addChild(sprite);
    }
    fillWaterCellsAroundCell(){
        let grid = this.parent.grid;
        getCellsAroundPoint(this.i, this.j, grid, 2, (cell) => {
            if (cell.type === 'water' && this.type === 'water'){
                let dist = instancesDistance(this, cell, true);
                let velX = Math.round(((this.i - cell.i)/dist));
                let velY = Math.round(((this.j - cell.j)/dist));
                if (grid[cell.i+velX] && grid[cell.i+velX][cell.j+velY]){
                    let target = grid[cell.i+velX][cell.j+velY];
                    let aside = grid[this.i + cell.i - target.i][this.j + cell.j - target.j]
                    if (target.type !== this.type && aside.type !== this.type){
                        if ((Math.floor(instancesDistance(this, cell, true)) === 2)){
                            target.type = 'water';
                            target.setResource('15002');
                            target.solid = true;
                        }
                    }
                }
            }
        });
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