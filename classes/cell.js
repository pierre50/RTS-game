class Cell extends PIXI.Container{
	constructor(i, j, z, map, options){
        super();

        this.setParent(map);
        this.name = 'cell';
        const pos = cartesianToIsometric(i, j);
        
		this.x = pos[0];
        this.y = pos[1] - (z * cellDepth);
		this.z = z;
		this.i = i;
		this.j = j;
		this.zIndex = 0;
		this.interactive = false;
        this.inclined = false;
        this.border = false;
        this.has = null;
        this.visible = false;
        this.viewed = false;
        this.viewBy = [];
		Object.keys(options).forEach((prop) => {
			this[prop] = options[prop];
        })
        if (this.sprite){
            this.sprite.anchor.set(.5,.5);
			this.addChild(this.sprite);
		}
    }
    setDesertBorder(direction){
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
        const sprite = new PIXI.Sprite(texture);
        sprite.direction = direction;
        sprite.anchor.set(0.5, 0.5);
        sprite.type = 'border';
        this.addChild(sprite);
    }
    setWaterBorder(cell, resourceName, index){
        const sprite = this.getChildByName('sprite');
        const spritesheet = app.loader.resources[resourceName].spritesheet;
        const texture = spritesheet.textures[index + '_' + resourceName + '.png'];
        cell.type = 'desert';
        cell.border = true;
        if (cell.has && typeof cell.has.destroy === 'function'){
            cell.has.destroy();
        }
        sprite.texture = texture;
    }
    setReliefBorder(index, elevation = 0){
        const sprite = this.getChildByName('sprite');
        const resourceName = sprite.texture.textureCacheIds[0].split('_')[1].split('.')[0];
        const spritesheet = app.loader.resources[resourceName].spritesheet;
        const texture = spritesheet.textures[index + '_' + resourceName + '.png'];
        if (elevation){
            this.y -= elevation;
        }
        this.inclined = true;
        sprite.name = 'sprite';
        sprite.anchor.set(.5, .5);
        sprite.texture = texture;
    }
    fillWaterCellsAroundCell(){
        const grid = this.parent.grid;
        getCellsAroundPoint(this.i, this.j, grid, 2, (cell) => {
            if (cell.type === 'water' && this.type === 'water'){
                const dist = instancesDistance(this, cell);
                const velX = Math.round(((this.i - cell.i)/dist));
                const velY = Math.round(((this.j - cell.j)/dist));
                if (grid[cell.i+velX] && grid[cell.i+velX][cell.j+velY]){
                    const target = grid[cell.i+velX][cell.j+velY];
                    const aside = grid[this.i + cell.i - target.i][this.j + cell.j - target.j]
                    if (target.type !== this.type && aside.type !== this.type){
                        if ((Math.floor(instancesDistance(this, cell)) === 2)){
                            const sprite = target.getChildByName('sprite')
                            const index = formatNumber(randomRange(0, 3));
                            const resourceName = '15002';
                            const spritesheet = app.loader.resources[resourceName].spritesheet;
                            sprite.texture = spritesheet.textures[ index + '_' + resourceName + '.png'];;
                            target.type = 'water';
                            target.solid = true;
                        }
                    }
                }
            }
        });
    }
	fillReliefCellsAroundCell(){
        const grid = this.parent.grid;
        getCellsAroundPoint(this.i, this.j, grid, 2, (cell) => {
            if (cell.z === this.z){
                const dist = instancesDistance(this, cell);
                const velX = Math.round(((this.i - cell.i)/dist));
                const velY = Math.round(((this.j - cell.j)/dist));
                if (grid[cell.i+velX] && grid[cell.i+velX][cell.j+velY]){
                    const target = grid[cell.i+velX][cell.j+velY];
                    const aside = grid[this.i + cell.i - target.i][this.j + cell.j - target.j]
                    if (target.z <= this.z && target.z !== this.z && aside.z !== this.z){
                        if ((Math.floor(instancesDistance(this, cell)) === 2)){
                            target.setCellLevel(target.z + 1);
                        }
                    }
                }
            }
        });
    }
    setCellLevel(level, cpt = 1) {
        const grid = this.parent.grid;
        getCellsAroundPoint(this.i, this.j, grid, level - cpt, (cell) => {
            if (cell.z < cpt){
                cell.y -= (cpt - cell.z) * cellDepth;
                cell.z = cpt;
                cell.fillReliefCellsAroundCell(grid);
            }
        });
        if (cpt <= level){
            this.setCellLevel(level, cpt+1);	
        }
    }
    setFog(){
        const color = 0x666666;
        for (let i = 0; i < this.children.length; i++){
            if (this.children[i].tint){
                this.children[i].tint = color;
            }
        }
        if (this.has){
            if (this.has.name === 'unit' && !this.has.player.isPlayed){
                this.has.visible = false;
            }else{
                for (let i = 0; i < this.has.children.length; i++){
                    if (this.has.children[i].tint){
                        this.has.children[i].tint = color;
                    }
                }
            }
        }
    }
    removeFog(){
        if (!this.visible){
            this.visible = true;
        }
        for (let i = 0; i < this.children.length; i++){
            if (this.children[i].tint){
                this.children[i].tint = colorWhite;
            }
        }
        if (this.has){
            if (instanceInCamera(this.has)){
                this.has.visible = true;
                if (this.has.player && !this.has.player.isPlayed && this.has.name === 'building'){
                    this.has.updateTexture();
                }
            }
            for (let i = 0; i < this.has.children.length; i++){
                if (this.has.children[i].tint){
                    this.has.children[i].tint = colorWhite;
                }
            }
        }
    }
}
class Grass extends Cell{
    constructor(i, j, z, map){
        const randomSpritesheet = randomRange(0, 8);
        const resourceName = '15001';
        const spritesheet = app.loader.resources[resourceName].spritesheet;
        const texture = spritesheet.textures[formatNumber(randomSpritesheet) + '_' + resourceName + '.png'];
		const sprite = new PIXI.Sprite(texture);
        sprite.name = 'sprite';
        super(i, j, z, map, {
            sprite,
            solid: false,
            type: 'grass'
        })
    }
}
class Desert extends Cell{
    constructor(i, j, z, map){
        const randomSpritesheet = randomRange(0, 8);
        const resourceName = '15000';
        const spritesheet = app.loader.resources[resourceName].spritesheet;
        const texture = spritesheet.textures[formatNumber(randomSpritesheet) + '_' + resourceName + '.png'];
		const sprite = new PIXI.Sprite(texture);
        sprite.name = 'sprite';
        super(i, j, z, map, {
            sprite,
            solid: false,
            type: 'desert'
        })
    }
}
class Water extends Cell{
    constructor(i, j, z, map){
        const randomSpritesheet = randomRange(0, 3);
        const resourceName = '15002';
        const spritesheet = app.loader.resources[resourceName].spritesheet;
        const texture = spritesheet.textures[formatNumber(randomSpritesheet) + '_' + resourceName + '.png'];
		const sprite = new PIXI.Sprite(texture);
        sprite.name = 'sprite';
        super(i, j, z, map, {
            sprite,
            solid: true,
            type: 'water'
        })
    }
}