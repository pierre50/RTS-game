class Interface {
	constructor(map){
        this.parent = map;
        this.topbar = document.createElement('div');
        this.topbar.id = 'topbar';
        this.icons = {
            'wood': 'assets/images/interface/50732/000_50732.png',
            'food': 'assets/images/interface/50732/002_50732.png',
            'stone': 'assets/images/interface/50732/001_50732.png',
            'gold': 'assets/images/interface/50732/003_50732.png' 
        }
        Object.assign(this.topbar.style, {
            top: 0,
            position: 'absolute',
            background: '#3c3b3d',
            padding: '0 5px',
            height: '20px',
            width: 'calc(100% - 164px)',
            borderStyle: 'inset',
            borderColor: '#686769',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr'
        });
        
        this.ressources = document.createElement('div');
        Object.assign(this.ressources.style, {
            display: 'flex'
        });
        ['wood', 'food', 'stone', 'gold'].forEach((res) => {
            this.setRessourcebox(res)
        })

        this.age = document.createElement('div');
        Object.assign(this.age.style, {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        });
        this.options = document.createElement('div');
    
        this.topbar.appendChild(this.ressources);
        this.topbar.appendChild(this.age);
        this.topbar.appendChild(this.options);
        gamebox.appendChild(this.topbar)

        this.updateTopbar();
    }
    setRessourcebox(name){
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
        img.width = 20;
        img.src = this.icons[name];
        this[name] = document.createElement('div');
        box.appendChild(img);
        box.appendChild(this[name]);
        this.ressources.appendChild(box);
    }
    updateTopbar(){
        ['wood', 'food', 'stone', 'gold', 'age'].forEach((prop) => {
            this[prop].innerText = this.parent.player[prop];
        })
    }
}