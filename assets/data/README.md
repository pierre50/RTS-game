Gameplay data is split by domain and merged at runtime by `app/screens/Loader.js`.

Directories:
- `gameplay/`: core gameplay definitions loaded into the shared config bundle
- `civilizations/`: civilization-specific visual overrides
- `technologies/`: technology definitions and progression data

`gameplay/` contains:
- `buildings.json`
- `units.json`
- `resources.json`
- `animals.json`
- `projectiles.json`
- `cells.json`

`civilizations/` contains:
- `greek.json`
- `egyptian.json`
- `babylonian.json`
- `asian.json`

`technologies/` contains:
- `technologies.json`
