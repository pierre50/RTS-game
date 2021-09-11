const { app, BrowserWindow} = require('electron');
const path = require('path');

app.commandLine.appendSwitch('high-dpi-support', 1);
app.commandLine.appendSwitch('force-device-scale-factor', 1);
app.once('ready', () => {
	var mainWindow = new BrowserWindow();
	mainWindow.loadURL(path.join(__dirname, 'index.html'));
})