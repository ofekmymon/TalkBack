const { log } = require('console');
const { app, BrowserWindow, ipcMain, ipcRenderer } = require('electron');
const Store = require("electron-store");
const e = require('express');
const path = require('path');
const {io} = require('socket.io-client');
const socket = io('http://localhost:3000');

let loginWindow;
let registerWindow;
let ContactWindow;
let RequestsWindow;
let Connect4Window;
let WinWindow;
let TieWindow;
const chatWindows = [];
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
    ContactWindow.removeMenu();
    ContactWindow.loadFile('./api/contacts/contacts.html');
    ContactWindow.on('closed', () => {
        ContactWindow = null;
    })
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

const createErrorWindow = (errorMessage) => {
    const ErrorMessageWindow = new BrowserWindow({
        width: 300,
        height: 200,
        modal: true,
        parent: ContactWindow,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        }
    });

    ErrorMessageWindow.loadFile('./api/errorWindow/error.html');
    ErrorMessageWindow.removeMenu();
    
    ErrorMessageWindow.webContents.once('did-finish-load', () => {
        console.log(errorMessage);
        ErrorMessageWindow.webContents.send('error-message', errorMessage);
    });
};

const createRequestsWindow = (requests) => {
    RequestsWindow = new BrowserWindow({
        width:300,
        height:500,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        }
    });
    RequestsWindow.loadFile('./api/requests/requests.html');
    RequestsWindow.removeMenu();
    //sends the client the activity requests
    RequestsWindow.webContents.once('did-finish-load', () => {
        RequestsWindow.send('requests',requests);
    });
};

const createChatWindow = (roomDetails) => {
    const ChatWindow = new BrowserWindow({
        width: 330,
        height: 530,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        }
    });
    ChatWindow.loadFile('./api/chat/chat.html');
    ChatWindow.removeMenu();
    ChatWindow.webContents.once('did-finish-load', () => {
        console.log(roomDetails);
        
        ChatWindow.send('chat-data',roomDetails);
    });
    const roomData = {
        roomName : roomDetails.roomName,
        chatRoom : ChatWindow
    }
    chatWindows.push(roomData);

    // Handle when the window is closed
    ChatWindow.on('closed', () => {
        console.log(' You left the chat ');
        chatWindows.every(chat => {
            if(chat.roomName){
                socket.emit('user-left-chat',{'room' : roomDetails.roomName , 'userLeft' : roomDetails.you});
                deleteChat(roomDetails.roomName);
                return false;
            }
            return true;
        });
    });
}

const createConnect4Window = async (gameData) => {
    Connect4Window = new BrowserWindow({
        width: 650,
        height: 600,
        maximizable: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        }
    });
    Connect4Window.loadFile('./api/connect4/connect4.html');

    const sender = gameData.roomName.split('-')[0];

    //decide on who is which color
    async function returnColor(){
        if(await getUsername() === sender){
            return 'blue';
        }
        else{
            return 'orange';
        }
    };
    const color = await returnColor();

    Connect4Window.webContents.once('did-finish-load', () => {
        Connect4Window.send('setup-game',{ you:gameData.you, opponent:gameData.otherUser, color, room:gameData.roomName});
    });

    Connect4Window.on('closed', () => {
        Connect4Window = null;
        console.log(' You left the game: ', gameData.roomName);
        socket.emit('user-left-game', {room : gameData.roomName, userLeft : gameData.you});
    });

}

const createWinWindow = (data) => {
    WinWindow = new BrowserWindow({
        width: 325,
        height:400,
        modal:true,
        parent:Connect4Window,
        maximizable:false,
        webPreferences:{
            nodeIntegration: true,
            contextIsolation: false
        }
    });
    WinWindow.loadFile('./api/connect4/winScreen/win.html');

    WinWindow.webContents.once('did-finish-load', () => {
        WinWindow.send('get-data', data);
    })
}

const createTieWindow = (data) => {
    TieWindow = new BrowserWindow({
        width: 325,
        height:400,
        modal:true,
        parent:Connect4Window,
        maximizable:false,
        webPreferences:{
            nodeIntegration: true,
            contextIsolation: false
        }
    });
    TieWindow.loadFile('./api/connect4/tieScreen/tie.html');

    TieWindow.webContents.once('did-finish-load', () => {
        TieWindow.send('get-data', data);
    })
}


//testing line
app.setPath('userData', path.join(app.getPath('userData'), 'client_' + Math.random()));




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

ipcMain.on('log-in', (event, username) => {
    console.log('lol');
    socket.emit('log-user', username);
    console.log('no connect?');
    
});
ipcMain.on('log-out', () => {
    if (ContactWindow) {
        ContactWindow.close();
        ContactWindow = null;
    }
    store.delete('userToken');  
    createLoginWindow();
});
ipcMain.on('get-active-users',() => {
    socket.emit('active-users');
    socket.once('active-users-response', (activeClients) => {
        ContactWindow.webContents.send('active-users', activeClients);
    });
});
ipcMain.on('open-requests-menu',(event, requests) => {
    createRequestsWindow(requests);
});
ipcMain.on('refresh-requests', (event) => {
    if (ContactWindow && !ContactWindow.isDestroyed()) {
        ContactWindow.webContents.send('get-requests-data');
    }

    ipcMain.once('requests-data-response', (event, requestData) => {
        if (RequestsWindow) {
            RequestsWindow.close();
        }
        createRequestsWindow(requestData);
    });
});
ipcMain.on('send-request', (event, request) => {
    const roomName = `${request.sender}-${request.recipient}`
    console.log(request.activityType);
    
    if(request.activityType === 'chat' && findExistingChat(roomName)){
        createErrorWindow('A chat with this user already exists');
    }
    if(request.activityType === 'game' && Connect4Window){
        createErrorWindow('You can only play one game');
    }
    else{
        socket.emit('send-request', request);
    }
});
//send requests to contact to delete them from the storage
ipcMain.on('reject-request',(event, messageId)=>{
    try{
        ContactWindow.webContents.send('rejected-request', messageId);
    }
    catch{
        console.log('user left');
        
    }
    console.log('rejected request');

});
ipcMain.on('accept-request', async (event, messageId)=>{
    if(findExistingChat(messageId)){
        createErrorWindow('A chat with this user already exists');
    }
    
    else{
        if(messageId.split('-')[1] === 'game' && Connect4Window){
            createErrorWindow('You already have an open game');
        }
        else{
            await sendRequestToServer(messageId);
        }
        
    }
    
});

ipcMain.on('send-message', (event, messageDetails) => {
    console.log(messageDetails);
    socket.emit('sent-message-to-server', messageDetails);

});

ipcMain.on('send-turn-to-server', (event, data) => {
    socket.emit('send-turn-to-server',data);
});

ipcMain.on('win-game', (event, data) => {
    createWinWindow(data);
});

ipcMain.on('rematch-request', (event, data) => {
    socket.emit('rematch-request', data);
});
ipcMain.on('rematch', (event) => {
    if(Connect4Window){
        Connect4Window.webContents.send('rematch');
    }
    else{
        createErrorWindow('Could not create a new game after leaving');
    }
});
ipcMain.on('quit-game', (event,data) => {
    if(WinWindow){
        WinWindow.close();
    }
    else if(TieWindow){
        TieWindow.close();
    }
    Connect4Window.close();
    socket.emit('user-quit', {room : data.room, userLeft : data.you})
});

ipcMain.on('send-tie', (event, data) => {
    createTieWindow(data);
});

///////////////Token management////////////////
ipcMain.on('set-first-token',(event ,userToken) =>{
    store.set('userToken',userToken);
});
ipcMain.on('token-request',(event) =>{
    const token = store.get('userToken');
    event.sender.send('getToken', token);
});
//////////////////////////////////////////////

function getUsername() {
    return new Promise((resolve, reject) => {
        ContactWindow.webContents.send('ask-username');
        ipcMain.once('get-username', (event, username) => {
            if (username) {
                resolve(username);
            } else {
                reject(new Error('Username not received'));
            }
        });
    });
}

async function sendRequestToServer(messageId){
    ContactWindow.webContents.send('accepted-request',messageId);
    console.log('accepted message');
    const message = messageId.split('-');
    const senderName = message[0];
    const activity = message[1];
    const recipientName = await getUsername();
    socket.emit('request-accepted',{ sender:senderName , recipient: recipientName , activity});
}

function findChatRoom(roomName){
    try{
        const obj =  chatWindows.find(room => room.roomName === roomName);
        console.log(obj);
        
        return obj.chatRoom;
    }
    catch{
        return null
    }
    
}

function findExistingChat(roomName){
    const temp = roomName.split('-');
    const roomNameInverted = `${temp[1]}-${temp[0]}`;
    console.log(roomName);
    console.log(roomNameInverted);
    return findChatRoom(roomName) || findChatRoom(roomNameInverted) ? true : false;
}

function deleteChat(roomName){
    const index = chatWindows.findIndex(chat => chat.roomName === roomName);
    chatWindows.splice(index, 1);
}

socket.on('connect', ()=> {
    console.log('Connected to server with socket ID: ', socket.id);
    socket.on('active-users-update', activeClients => {
        if(ContactWindow != null){
            ContactWindow.webContents.send('active-users-update', activeClients);        
        }
    });
    socket.on('listen-for-requests', request => {
        if(ContactWindow){
            ContactWindow.webContents.send('listen-for-requests', request)
        }
    });

    socket.on('join-room', data => {
        console.log(data);
        
        socket.emit('request-to-join-room', data.roomName);
        console.log(`Joined room: ${data.roomName} with ${data.otherUser}`);
        if(data.activity === 'chat'){
            createChatWindow(data);
        }
        else if(data.activity === 'game'){
            createConnect4Window(data)
        }
    });  
    
    socket.on('join-failed',otherUser => {
        createErrorWindow(`Error: ${otherUser} failed to join room `);
    });
    
    socket.on('get-message', messageDetails => {
        console.log('sending message: ');
        try{
            const chatRoom = findChatRoom(messageDetails.messageRoom); 
            chatRoom.webContents.send('get-message',messageDetails);
        }
        catch(error){
            console.log('Error getting message from server:' + error);
        }
    });
    socket.on('user-left-chat', details => {
        try{
            console.log('line 430:');
            console.log(details);
            socket.emit('leave-chat-room',details.room);
            const chatRoom = findChatRoom(details.room);
            if(chatRoom){
                chatRoom.webContents.send('user-left',details);
                deleteChat(details.room)
            }
        }
        catch(error){
            console.log('user left');
        }  

    });
    socket.on('change-turns', data => {
        if(Connect4Window){
            Connect4Window.webContents.send('turn-changed',data);
        }
        else{
            createErrorWindow('Opponent has left the game')
        }
    });
    socket.on('rematch-requested', sender => {
        console.log('rematch request from server.');
        if(WinWindow){
            console.log('boutta reach player');
            WinWindow.webContents.send('rematch-requested', sender);
        }
        else if(TieWindow){
            console.log('boutta reach the tied player');
            TieWindow.webContents.send('rematch-requested', sender);
        }
    });
    socket.on('user-left-game-room', data => {
        console.log(data.userLeft , ` Has left the game`);
        socket.emit('leave-game-room' , data.room);
        if(!(getUsername() === data.userLeft)){
            createErrorWindow('Your opponent has left the game');
            try{
                Connect4Window.webContents.send('user-left');
            }
            catch(error){
                console.log(`Error: ${error}`);
            }
        }
    });
    socket.on('user-quit-game-room', userLeft => {
        if(!(getUsername() === userLeft)){
            try{
                WinWindow.webContents.send('user-quit');
                
            }
            catch{
                console.log('The rematch is accepted');
                
            }
        }
    })
});




app.on('ready', () => { 
    createRegisterWindow();
});
