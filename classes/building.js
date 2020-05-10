class Building extends PIXI.Container {
	constructor(i, j, map, options){
		super();

        this.setParent(map);
        this.name = 'building';
		this.i = i;
		this.j = j;
		this.x = this.parent.grid[i][j].x;
		this.y = this.parent.grid[i][j].y;
		this.z = this.parent.grid[i][j].z;
		this.zIndex = getInstanceZIndex(this);
		this.interactive = true;

		this.type = options.type;
		this.size = options.size;
		this.addChild(options.sprite)
    }
}

class TownCenter extends Building {
	constructor(i, j, map){
		const spritesheet = app.loader.resources['280'].spritesheet;
		const textureName = '0.png';
		const texture = spritesheet.textures[textureName];
		let sprite = new PIXI.Sprite(texture);
		sprite.name = 'sprite';
		sprite.pivot = spritesheet.data.frames[textureName].pivot;
		sprite.hitArea = new PIXI.Polygon(spritesheet.data.frames[textureName].hitArea);
		
		const options = {
			type: 'towncenter',
			sprite,
			size: 2
		}
		super(i, j, map, options);
	}
}