//Unit
class Ressource extends PIXI.Sprite{
	constructor(x, y, z, texture, type){
		super(texture);
		if (texturesAnchor[texture.textureCacheIds[0]]){
			this.anchor.set(texturesAnchor[texture.textureCacheIds[0]][0], texturesAnchor[texture.textureCacheIds[0]][1])
		}

		this.name = 'ressource';
		this.x = x;
		this.y = y;
		this.z = z;
		this.zIndex = getInstanceZIndex(this);
		this.type = type;
	}
}

class Tree extends Ressource{
	constructor(x, y, z){
		let nbrTexture = randomRange(1,4);
		let texture = app.loader.resources[`000_00${nbrTexture}`].texture;
		super(x, y, z, texture, 'tree');
	}
	step() {
	}
}