class Building extends PIXI.Container {
	constructor(i, j, map, options){
		super();

		this.setParent(map);
		this.id = this.parent.children.length;
        this.name = 'building';
		this.i = i;
		this.j = j;
		this.x = this.parent.grid[i][j].x;
		this.y = this.parent.grid[i][j].y;
		this.z = this.parent.grid[i][j].z;
		this.zIndex = getInstanceZIndex(this);

		this.type = options.type;
		this.size = options.size;
		this.addChild(options.sprite);
		this.addChild(options.spriteColor);
    }
}

class TownCenter extends Building {
	constructor(i, j, map){
		//Define sprite
		const spritesheet = app.loader.resources['280'].spritesheet;
		const textureName = '000_280.png';
		const texture = spritesheet.textures[textureName];
		let sprite = new PIXI.Sprite(texture);
		sprite.interactive = true;
		sprite.updateAnchor = true;
		sprite.name = 'sprite';
		sprite.hitArea = new PIXI.Polygon(spritesheet.data.frames[textureName].hitArea);
		//Set solid zone
		let neighbours = getCellsAroundPoint(i, j, map.grid, 1, false, true);
        for (let n = 0; n < neighbours.length; n ++){
            neighbours[n].solid = true;
		}
		//Set player color
		const spritesheetColor = app.loader.resources['230'].spritesheet;
		const textureNameColor = '000_230.png';
		const textureColor = spritesheetColor.textures[textureNameColor];
		let spriteColor =  new PIXI.Sprite(textureColor);

		super(i, j, map, {
			type: 'towncenter',
			sprite,
			size: 2,
			spriteColor
		});
	}
}