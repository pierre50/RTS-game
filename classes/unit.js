class Unit extends PIXI.Container {
	constructor(i, j, map){
		super();

		this.setParent(map);
		this.name = 'unit'
		this.i = i;
		this.j = j;
		this.x = this.parent.grid[i][j].x;
		this.y = this.parent.grid[i][j].y;
		this.z = this.parent.grid[i][j].z;
		this.next = null;
		this.dest = null;
		this.path = [];
		this.zIndex = getInstanceZIndex(this);
		this.normalSpeed = 1;
		this.speed = 1;
		this.slowSpeed = this.speed / 1.30;
		this.interactive = true;
		this.selected = false;
		this.radian = 0;
		this.degree = randomRange(1,360);
		this.old = {...this};
		let standingSheet = app.loader.resources['unit/418/texture.json'].spritesheet;
		let walkingSheet = app.loader.resources['unit/657/texture.json'].spritesheet;
		this.standingSheet = standingSheet;
		this.walkingSheet = walkingSheet;
		let sprite = new PIXI.AnimatedSprite(standingSheet.animations['south']);
		sprite.name = 'sprite';
		this.addChild(sprite);
		this.setAnimation('standingSheet');
	}
	select(){
		if (this.selected){
			return;
		}
		this.selected = true;
		let selection = new PIXI.Graphics();
		selection.name = 'selection';
		selection.zIndex = 3;
		selection.lineStyle(1, 0x00FF00);
		selection.drawEllipse(0, 0, this.width - 5, 10);
		this.addChildAt(selection, 0);
	}
	unselect(){
		this.selected = false;
		let selection = this.getChildByName('selection');
		if (selection){
			this.removeChild(selection);
		}
	}
	hasPath(){
		return this.path.length > 0;
	}
	setDestination(instance){
		this.parent.grid[this.i][this.j].solid = false;
		if (this.parent.grid[instance.i][instance.j].solid){
			this.path = getInstanceClosestFreeCell(this, instance.i, instance.j, this.parent);
		}else{
			this.path = getInstancePath(this, instance.i, instance.j, this.parent);
		}
		if (this.path.length){
			this.dest = instance;
			this.setAnimation('walkingSheet');
		}else{
			this.parent.grid[this.i][this.j].solid = true;
		}
	}
	moveToPath(){
		this.next = this.path[this.path.length - 1];
		if (this.path.length === 1 && this.parent.grid[this.next.i][this.next.j].solid){
			this.path = getInstanceClosestFreeCell(this, this.dest.i, this.dest.j, this.parent);
			return;
		}
		this.zIndex = getInstanceZIndex(this); 
		if (pointDistance(this.x, this.y, this.next.x, this.next.y) < this.speed){
			this.x = this.next.x;
			this.y = this.next.y;
			this.z = this.next.z;
			this.i = this.next.i;
			this.j = this.next.j;
			if (this.parent.grid[this.i][this.j].inclined){
				this.speed = this.slowSpeed;
			}else{
				this.speed = this.normalSpeed;
			}
			this.zIndex = getInstanceZIndex(this); 
			this.path.pop();
			if (!this.path.length){
				this.parent.grid[this.i][this.j].solid = true;
				this.setAnimation('standingSheet');
				return;
			}
		}else{
			moveTowardPoint(this, this.next.x, this.next.y, this.speed);
			if (this.old.degree !== this.degree){	
				//Change animation
				this.setAnimation('walkingSheet');
			}
		}
	}
	step(){
		if (this.hasPath()){
			this.moveToPath();
		}
		this.old = {...this}
	}
	setAnimation(sheet){
		let sprite = this.getChildByName('sprite');
		sprite.animationSpeed = this[sheet].data.animationSpeed || 0.2;
		sprite.pivot = this[sheet].data.pivot;
		if (this.degree > 67.5 && this.degree < 112.5){
			sprite.scale.x = 1;
			sprite.textures = this[sheet].animations['north']
		}else if (this.degree > 247.5 && this.degree < 292.5){
			sprite.scale.x = 1;
			sprite.textures = this[sheet].animations['south']
		}else if (this.degree > 337.5 || this.degree < 22.5){
			sprite.scale.x = 1;			
			sprite.textures = this[sheet].animations['west']
		}else if (this.degree >= 22.5 && this.degree <= 67.5){
			sprite.scale.x = 1;
			sprite.textures = this[sheet].animations['northwest'];
		}else if (this.degree >= 292.5 && this.degree <= 337.5){
			sprite.scale.x = 1;			
			sprite.textures = this[sheet].animations['southwest'];
		}else if (this.degree > 157.5 && this.degree < 202.5){
			sprite.scale.x = -1;
			sprite.textures = this[sheet].animations['west'];
		}else if (this.degree > 112.5 && this.degree < 157.5){
			sprite.scale.x = -1;
			sprite.textures = this[sheet].animations['northwest'];
		}else if (this.degree > 202.5 && this.degree < 247.5){
			sprite.scale.x = -1;
			sprite.textures = this[sheet].animations['southwest'];
		}
		sprite.play();
	}
}