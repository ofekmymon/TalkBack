const { app, BrowserWindow, ipcMain } = require('electron');
const Store = require("electron-store");
const path = require('path')

let loginWindow;
let registerWindow;
const store = new Store();

const createContactWindow = () => {
    const ContactWindow = new BrowserWindow({
        width: 650,
        height: 600,
        maximizable: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        }
    });
    // ContactWindow.removeMenu();
    ContactWindow.loadFile('./api/contacts/contacts.html');
};

const createLoginWindow = () => {
    loginWindow = new BrowserWindow({
        width: 250,
        height: 350,
        maximizable: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        }
        
    });
    loginWindow.removeMenu();
    loginWindow.loadFile('./api/login-register/login.html');
};

const createRegisterWindow = () => {
    registerWindow = new BrowserWindow({
        width: 250,
        height: 350,
        maximizable: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        }
    });
    registerWindow.removeMenu();
    registerWindow.loadFile('./api/login-register/register.html');
};

const createChatWindow = () => {
    chatWindow = new BrowserWindow({
        width: 330,
        height: 530,
        // maximizable: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        }
    });
    chatWindow.loadFile('./api/chat/chat.html');
}

app.on('ready', () => {
    createRegisterWindow();
});


///////Window Management///////////////

ipcMain.on('register-to-login', () => {
    if (registerWindow) {
        registerWindow.close();
    }
    createLoginWindow();
});

ipcMain.on('login-to-register', () => {
    if (loginWindow) {
        loginWindow.close();
    }
    createRegisterWindow();
});

ipcMain.on('login-to-contacts', () => {
    if (loginWindow) {
        loginWindow.close();
    }
    createContactWindow();
});


ipcMain.on('contacts-to-login', () => {
    if (ContactWindow) {
        ContactWindow.close();
    }
    createLoginWindow();
});
///////////////Token management////////////////
ipcMain.on('set-first-token',(event ,userToken) =>{
    store.set('userToken',userToken);
});
ipcMain.on('token-request',(event) =>{
    const token = store.get('userToken');
    event.sender.send('getToken', token);
});
