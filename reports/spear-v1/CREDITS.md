# Lance slash V1 — prototype visuel

Dérivé des sprites LPC de hallebarde locaux, par Benjamin K. Smith (BenCreating), bluecarrot16 et Sander Frenken (castelonia).
Source : https://opengameart.org/content/lpc-medieval-weapons
Licence retenue pour les sprites dérivés : CC-BY-SA 3.0 (https://creativecommons.org/licenses/by-sa/3.0/).
Crédits originaux : scripts/lpc/sheet_definitions/weapon_polearm_halberd.json.
Modifications : tête affinée, pointe axiale grise ; conservation des manches et des couches ; traînées extraites de la dague LPC, recolorées et orientées selon chaque pose, au pixel le plus proche sans anticrénelage.
Traînées de cet aperçu : dague LPC, bluecarrot16, Johannes Sjölund (wulax), Matthew Krohn (makrohn). Licence retenue CC-BY-SA 3.0. Crédits : scripts/lpc/sheet_definitions/weapon_sword_dagger.json.
La lance LPC a servi de référence visuelle uniquement ; aucun de ses pixels n'est importé.
Les aperçus utilisent le héros Hellas existant du projet, dont les crédits LPC restent applicables (scripts/lpc/sheet_definitions/).

Régénération : python3 scripts/lpc/build_spear_prototype.py
Ouvrir index.html pour comparer slash/marche, ralentir et avancer image par image.
Les PNG dans sources/ conservent la lance courte ; sources-long/ contient la version longue, avec la hampe de marche ajustée à 48 pixels pour rejoindre le slash. Toutes les cases longues font 192 × 192 pixels, marche comprise. Version longue utilisée par le générateur LPC pour les lances pierre, bronze et fer. Raccords définis par pose, rotation au pixel le plus proche, aucune transparence partielle.
Les quatre directions sources sont conservées. Le runtime actuel ne conserve que dos/gauche/face et reflète gauche pour droite.
