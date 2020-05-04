class Unit extends PIXI.Container {
	constructor(x, y, z){
		//Prepair animation
		super();
		let standingSheet = app.loader.resources['unit/418/texture.json'].spritesheet;
		standingSheet.anchor = {x: -1.3,y: .5};
		standingSheet.anchorOpposite = {x: 2.3,y: .5};
		standingSheet.animationSpeed = .1;

		let walkingSheet = app.loader.resources['unit/657/texture.json'].spritesheet;
		walkingSheet.anchor = {x: -.5,y: .5};
		walkingSheet.anchorOpposite = {x: 1.8,y: .5};
		walkingSheet.animationSpeed = .3;

		//super(standingSheet.animations['south']);

		this.sprite = new PIXI.AnimatedSprite(standingSheet.animations['south']);

		this.standingSheet = standingSheet;
		this.walkingSheet = walkingSheet;

		this.name = 'unit'
		this.x = x;
		this.y = y;
		this.z = z;
		this.nextX = null;
		this.nextY = null;
		this.nextZ = null;
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
		this.addChild(this.sprite);

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
		selection.drawEllipse(this.sprite.width + 15, this.sprite.height / 3, this.sprite.width - 5, 10);
		this.addChildAt(selection,0);
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
	step(){
		if (this.hasPath()){
			this.nextX = this.path[this.path.length - 1].x;
			this.nextY = this.path[this.path.length - 1].y;
			this.nextZ = this.path[this.path.length - 1].z;
			this.dest = this.path[0];
			//Change move speed depend on ground inclination
			let pos = isometricToCartesian(this.x,this.y + (this.z * cellDepth));
			if (map.grid[pos[0]][pos[1]].inclined){
				this.speed = this.slowSpeed;
			}else{
				this.speed = this.normalSpeed;
			}
			this.zIndex = getInstanceZIndex(this); 
			if (pointDistance(this.x, this.y, this.nextX, this.nextY) < this.speed){
				this.x = this.nextX;
				this.y = this.nextY;
				this.z = this.nextZ;
				this.zIndex = getInstanceZIndex(this); 
				this.path.pop();
				if (!this.path.length){
					this.setAnimation('standingSheet');
				}
			}else{
				moveTowardPoint(this, this.nextX, this.nextY, this.speed);
				if (this.old.degree !== this.degree){	
					//Change animation
					this.setAnimation('walkingSheet');
				}
			}
			this.old = {...this}
		}
	}
	setAnimation(sheet){
		this.sprite.animationSpeed = this[sheet].animationSpeed || 0.3;
		if (this.degree > 67.5 && this.degree < 112.5){
			this.sprite.scale.x = 1;
			this.sprite.anchor.set(this[sheet].anchor.x,this[sheet].anchor.y);
			this.sprite.textures = this[sheet].animations['north']
		}else if (this.degree > 247.5 && this.degree < 292.5){
			this.sprite.scale.x = 1;
			this.sprite.anchor.set(this[sheet].anchor.x,this[sheet].anchor.y);
			this.sprite.textures = this[sheet].animations['south']
		}else if (this.degree > 337.5 || this.degree < 22.5){
			this.sprite.scale.x = 1;			
			this.sprite.anchor.set(this[sheet].anchor.x,this[sheet].anchor.y);
			this.sprite.textures = this[sheet].animations['west']
		}else if (this.degree >= 22.5 && this.degree <= 67.5){
			this.sprite.scale.x = 1;
			this.sprite.anchor.set(this[sheet].anchor.x,this[sheet].anchor.y);
			this.sprite.textures = this[sheet].animations['northwest'];
		}else if (this.degree >= 292.5 && this.degree <= 337.5){
			this.sprite.scale.x = 1;			
			this.sprite.anchor.set(this[sheet].anchor.x,this[sheet].anchor.y);
			this.sprite.textures = this[sheet].animations['southwest'];
		}else if (this.degree > 157.5 && this.degree < 202.5){
			this.sprite.scale.x = -1;
			this.sprite.anchor.set(this[sheet].anchorOpposite.x,this[sheet].anchorOpposite.y);
			this.sprite.textures = this[sheet].animations['west'];
		}else if (this.degree > 112.5 && this.degree < 157.5){
			this.sprite.scale.x = -1;
			this.sprite.anchor.set(this[sheet].anchorOpposite.x,this[sheet].anchorOpposite.y);
			this.sprite.textures = this[sheet].animations['northwest'];
		}else if (this.degree > 202.5 && this.degree < 247.5){
			this.sprite.scale.x = -1;
			this.sprite.anchor.set(this[sheet].anchorOpposite.x,this[sheet].anchorOpposite.y);
			this.sprite.textures = this[sheet].animations['southwest'];
		}
		this.sprite.play();
	}
}