class Interface {
	constructor(map){
        const barStyle = {
            borderStyle: 'inset',
            borderColor: '#686769',
            background: '#3c3b3d',
            width: '100%',
        }
        this.parent = map;
        this.topbar = document.createElement('div');
        this.topbar.id = 'topbar';
        this.icons = {
            'wood': 'assets/images/interface/50732/000_50732.png',
            'food': 'assets/images/interface/50732/002_50732.png',
            'stone': 'assets/images/interface/50732/001_50732.png',
            'gold': 'assets/images/interface/50732/003_50732.png',
        }
        Object.assign(this.topbar.style, {
            top: '0',
            position: 'absolute',
            padding: '0 5px',
            height: '20px',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            ...barStyle
        });
        
        this.resources = document.createElement('div');
        Object.assign(this.resources.style, {
            display: 'flex'
        });
        ['wood', 'food', 'stone', 'gold'].forEach((res) => {
            this.setresourcebox(res)
        })

        this.age = document.createElement('div');
        Object.assign(this.age.style, {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        });
        this.options = document.createElement('div');
    
        this.topbar.appendChild(this.resources);
        this.topbar.appendChild(this.age);
        this.topbar.appendChild(this.options);
        gamebox.appendChild(this.topbar)

        let bottombar = document.createElement('div');
        Object.assign(bottombar.style, {
            bottom: '0',
            position: 'absolute',
            display: 'grid',
            gridTemplateColumns: '120px auto',
            gridGap: '10px',
            padding: '5px',
            marginBottom: '1px',
            ...barStyle
        });
        this.bottombarInfo = document.createElement('div');
        Object.assign(this.bottombarInfo.style, {
            height: '114px',
            width: '120px',
            position: 'relative',
            border: '4px inset #686769',
            borderRadius: '2px'
        })
        this.bottombarMenu = document.createElement('div');
        bottombar.appendChild(this.bottombarInfo);
        bottombar.appendChild(this.bottombarMenu);
        gamebox.appendChild(bottombar);

        this.updateTopbar();
    }
    setresourcebox(name){
        let box = document.createElement('div');
        Object.assign(box.style, {
            display: 'flex',
            marginRight: '40px',
            alignItems: 'center',
        })
        let img = document.createElement('img');
        Object.assign(img.style, {
            objectFit: 'none',
            height: '13px',
            width: '20px',
            marginRight: '2px',
            border: '1.5px inset #686769',
            borderRadius: '2px'
        })
        img.src = this.icons[name];
        this[name] = document.createElement('div');
        box.appendChild(img);
        box.appendChild(this[name]);
        this.resources.appendChild(box);
    }
    updateTopbar(){
        ['wood', 'food', 'stone', 'gold', 'age'].forEach((prop) => {
            this[prop].innerText = this.parent.player[prop];
        })
    }
    setBottombar(selection){
        const iconStyle = {
            objectFit: 'none',
            height: '50px',
            width: '50px',
            marginRight: '2px',
            border: '1.5px inset #686769',
            borderRadius: '2px'
        }
        this.bottombarInfo.innerHTML = '';
        this.bottombarInfo.style.background = 'transparent';
        this.bottombarMenu.innerHTML = '';
        if (mouseBuilding){
            this.parent.interface.removeMouseBuilding();
        }
        if (selection && selection.interface){
            this.bottombarInfo.style.background = 'black';
            let img = document.createElement('img');
            img.src = selection.interface.icon;
            this.bottombarInfo.appendChild(img);
            setMenuRecurs(selection, this.bottombarMenu, selection.interface.menu || []);
        }
        function setMenuRecurs(selection, element, menu, parent){
            menu.forEach((btn) => {
                let img = document.createElement('img');
                img.src = btn.icon;
                Object.assign(img.style, iconStyle);
                if (btn.children){
                    img.addEventListener('pointerdown', (evt) => {
                        element.innerHTML = '';
                        setMenuRecurs(selection, element, btn.children, menu);
                    });
                }else {
                    img.addEventListener('pointerdown', (evt) => btn.onClick(selection, evt));
                }
                element.appendChild(img) 
            })
            if (parent){
                let back = document.createElement('img');
                back.src = 'assets/images/interface/50721/010_50721.png';
                Object.assign(back.style, iconStyle);
                back.addEventListener('pointerdown', (evt) => {
                    element.innerHTML = '';
                    setMenuRecurs(selection, element, parent);
                })
                element.appendChild(back);
            }else if (selection.selected){
                let unselect = document.createElement('img');
                unselect.src = 'assets/images/interface/50721/010_50721.png';
                Object.assign(unselect.style, iconStyle);
                unselect.addEventListener('pointerdown', (evt) => {
                    selection.parent.player.unselectAll();
                })
                element.appendChild(unselect);
            }
        }
    }
    setMouseBuilding(building){
        mouseBuilding = new PIXI.Sprite(building.texture);
        mouseBuilding.type = building.type;
        mouseBuilding.size = building.size;
        mouseBuilding.x = window.event.clientX;
        mouseBuilding.y = window.event.clientY;
        mouseBuilding.name = 'mouseBuilding';
        mouseBuilding.onClick = building.onClick;
        app.stage.addChild(mouseBuilding);
    }
    removeMouseBuilding(){
        if (!mouseBuilding){
            return;
        }
        app.stage.removeChild(mouseBuilding);
        mouseBuilding.destroy();
        mouseBuilding = null;
    }
}