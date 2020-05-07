//Unit
class Ressource extends PIXI.Container{
	constructor(i, j, map, sprite, type){
		super();

        this.setParent(map);
		this.name = 'ressource';
		this.i = i;
		this.j = j;
		this.x = this.parent.grid[i][j].x;
		this.y = this.parent.grid[i][j].y;
		this.z = this.parent.grid[i][j].z;
		this.zIndex = getInstanceZIndex(this);
		this.type = type;

		this.addChild(sprite);
		sprite.on('click', () => {
			this.flashSelection();
			for(let u = 0; u < player.selectedUnits.length; u++){
				player.selectedUnits[u].setDestination(this);
			}
		})
	}
	flashSelection(){
		let selection = new PIXI.Graphics();
		selection.name = 'selection';
		selection.zIndex = 3;
		selection.lineStyle(1, 0x00FF00);
		selection.drawEllipse(0, 0, cellHeight, 10);
		this.addChildAt(selection, 0);
		setTimeout(() => {
			selection.alpha = 0;
			setTimeout(() => {
				selection.alpha = 1;
				setTimeout(() => {
					selection.alpha = 0;
					setTimeout(() => {
						selection.alpha = 1;
						setTimeout(() => {
							this.removeChild(selection);
						}, 300)
					}, 300)
				}, 300)
			}, 500)
		}, 500)
	}
}

class Tree extends Ressource{
	constructor(i, j, map){
		let spritesheet = app.loader.resources['ressource/texture.json'].spritesheet;
		let textureName = randomRange(1,4) + '.png';
		let texture = spritesheet.textures[textureName];
		let sprite = new PIXI.Sprite(texture);
		sprite.interactive = true;
		sprite.name = 'sprite';
		sprite.pivot = spritesheet.data.frames[textureName].pivot;
		sprite.hitArea = new PIXI.Polygon(spritesheet.data.frames[textureName].hitArea);
		super(i, j, map, sprite, 'tree');
	}
	step() {
	}
}