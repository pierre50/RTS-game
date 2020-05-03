//Cell
class Cell extends PIXI.Sprite{
	constructor(x, y, i, j, z){
		let nbrTexture = randomRange(1,8);
		let texture = app.loader.resources[`00${nbrTexture}_15001`].texture
		super(texture);
		this.name = "cell";
		
		this.x = x;
		this.y = y;
		this.z = z;
		this.i = i;
		this.j = j;
		this.zIndex = getInstanceZIndex(this);
		this.solid = false;
		this.interactive = true;
		this.inclined = false;
		this.originalTexture = texture;
		let points = [0,16, 32,0, 64,16, 32,32]
		this.hitArea = new PIXI.Polygon(points);
	}
}