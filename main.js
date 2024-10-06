const { app, BrowserWindow, ipcMain } = require('electron');
const Store = require("electron-store");
const path = require('path')

let loginWindow;
let registerWindow;
let ContactWindow;
let ChatRequestWindow;
const store = new Store();


const createContactWindow = () => {
    ContactWindow = new BrowserWindow({
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

const createChatRequestsWindow = (requests) => {
    ChatRequestWindow = new BrowserWindow({
        width:300,
        height:500,
        modal:true,
        parent:ContactWindow,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        }
    });
    ChatRequestWindow.loadFile('./api/chatRequest/chatRequest.html');
    //sends the client the activity requests
    ChatRequestWindow.webContents.once('did-finish-load', () => {
        ChatRequestWindow.send('chat-request',requests);
    });
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
//development line
app.setPath('userData', path.join(app.getPath('userData'), 'client_' + Math.random()));

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
ipcMain.on('open-chat-requests-menu',(event,requests) => {
    createChatRequestsWindow(requests);
})
ipcMain.on('reject-message',(event,messageId)=>{
    ContactWindow.webContents.send('delete-message', messageId);
});

///////////////Token management////////////////
ipcMain.on('set-first-token',(event ,userToken) =>{
    store.set('userToken',userToken);
});
ipcMain.on('token-request',(event) =>{
    const token = store.get('userToken');
    event.sender.send('getToken', token);
});
