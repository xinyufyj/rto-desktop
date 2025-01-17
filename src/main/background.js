"use strict";

import "./api/";
import { app, protocol, BrowserWindow, Menu, MenuItem, Tray, ipcMain } from "electron";
import path from "path";
// import { createProtocol } from 'vue-cli-plugin-electron-builder/lib'
import installExtension, { VUEJS_DEVTOOLS } from "electron-devtools-installer";
import { appInjectDev, appInjectProd, interceptUrl } from "./appInject";
import * as mainconfigs from "./mainconfig";

const isDevelopment = process.env.NODE_ENV !== "production";

// Scheme must be registered before the app is ready
protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { secure: true, standard: true } },
]);

let win, tray, splashWin;

async function createWindow() {
  // Create the browser window.
  win = new BrowserWindow({
    width: 1400,
    minWidth: 1024,
    height: 900,
    minHeight: 600,
    titleBarStyle: "hidden",
    frame: false,
    show: false,
    webPreferences: {
      // Use pluginOptions.nodeIntegration, leave this alone
      // See nklayman.github.io/vue-cli-plugin-electron-builder/guide/security.html#node-integration for more info
      nodeIntegration: process.env.ELECTRON_NODE_INTEGRATION,
      contextIsolation: false,
      preload: path.join(__dirname, "preload.js"),
      webSecurity: false,
    },
  });
  win.maximize();
  win.once('ready-to-show', () => {
    splashWin.destroy();
    splashWin = null;
    win.show();
    if (process.env.WEBPACK_DEV_SERVER_URL && !process.env.IS_TEST) win.webContents.openDevTools();
    // win.webContents.openDevTools()
  });

  // https://www.electronjs.org/docs/api/window-open
  win.webContents.on(
    "new-window",
    async (event, url, frameName, disposition, options, additionalFeatures) => {
      event.preventDefault();
      Object.assign(options, {
        titleBarStyle: "default",
        frame: true,
      });
      event.newGuest = new BrowserWindow({ 
        ...options, 
        width: 1024, 
        height:600,
     });
      // Menu.setApplicationMenu(null)
      event.newGuest.setMenuBarVisibility(false);
      // event.newGuest.removeMenu();
      event.newGuest.loadURL(interceptUrl(url));

      event.newGuest.webContents.on("new-window", async (event, url, options) => {
        event.preventDefault();
        event.newGuest = new BrowserWindow({ 
          ...options,
          y: '50%', 
          x: '50%'
        });
        event.newGuest.setMenuBarVisibility(false);
        event.newGuest.loadURL(url);
      })
    }
  );

  // win.on('close', function(e){
  //   e.preventDefault();
  //   win.webContents.send('window-close');
  // });

  if (process.env.WEBPACK_DEV_SERVER_URL) {
    // Load the url of the dev server if in development mode
    await win.loadURL(process.env.WEBPACK_DEV_SERVER_URL);
  } else {
    // createProtocol('app')
    // Load the index.html when not in development
    win.loadURL("app://./index.html");
    //https://github.com/electron/electron/issues/14978
    win.webContents.on("did-fail-load", () => {
      win.loadURL("app://./index.html");
    });
  }
}

function createSplashWindow() {
  splashWin = new BrowserWindow({
    width: 800,
    height: 500,
    frame: false,
    resizable: false,
    // alwaysOnTop: true,
    webPreferences: {
      // Use pluginOptions.nodeIntegration, leave this alone
      // See nklayman.github.io/vue-cli-plugin-electron-builder/guide/security.html#node-integration for more info
      nodeIntegration: process.env.ELECTRON_NODE_INTEGRATION,
      preload: path.join(__dirname, "preload.js"),
      webSecurity: false,
      contextIsolation: false,
    },
  });
  if (process.env.WEBPACK_DEV_SERVER_URL) {
    splashWin.loadURL(process.env.WEBPACK_DEV_SERVER_URL + 'splash.html');
  } else {
    splashWin.loadURL(`app://./splash.html`);
  }
}

function createTray() {
  // https://www.electronjs.org/docs/api/native-image#high-resolution-image
  tray = new Tray(path.join(mainconfigs.assetsPath, "logo.png"));
  tray.on("click", () => {
    if (win === null) {
      createWindow();
    } else {
      win.show();
    }
  });
  if (mainconfigs.platform == "win") {
    const contextMenu = Menu.buildFromTemplate([
      new MenuItem({
        label: "退出",
        click() {
          win.destroy();
          app.quit();
        },
      }),
    ]);
    tray.setToolTip("Suanpan RTO");
    tray.setContextMenu(contextMenu);
  }
}

// Quit when all windows are closed.
app.on("window-all-closed", () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.

/**
 * SingleInstanceLock
 */
 const gotTheLock = app.requestSingleInstanceLock()

 if (!gotTheLock) {
   app.quit()
 } else {
   app.on('second-instance', (event, commandLine, workingDirectory) => {
     // Someone tried to run a second instance, we should focus our window.
     if (win) {
       if (win.isMinimized()) win.restore()
       win.focus()
     }
   })
   app.on("ready", async () => {
     if (isDevelopment && !process.env.IS_TEST) {
       // Install Vue Devtools
       try {
         await installExtension(VUEJS_DEVTOOLS);
       } catch (e) {
         console.error("Vue Devtools failed to install:", e.toString());
       }
     }
     if(!isDevelopment) {
       appInjectProd();
     }
     ipcMain.on('splash-over', async () => {
       if (isDevelopment) {
         await appInjectDev();
       }
       createWindow();
     // createTray()
     })
     createSplashWindow();
   });
 }
