const { log } = require('console');
const { app, BrowserWindow, ipcMain, ipcRenderer } = require('electron');
const Store = require("electron-store");
const path = require('path');
const {io} = require('socket.io-client');
const socket = io('http://localhost:3000');

let loginWindow;
let registerWindow;
let ContactWindow;
let ChatRequestWindow;
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
    // loginWindow.removeMenu();
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
        width:300,
        height:200,
        modal:true,
        parent:ContactWindow, // maybe make it interchangable
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        }
    })
    ErrorMessageWindow.webContents.send('did-finish-load', () => {
        ErrorMessageWindow.send('error-message', errorMessage);
    });
}

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

const createChatWindow = (roomDetails) => {
    const ChatWindow = new BrowserWindow({
        width: 330,
        height: 530,
        // maximizable: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        }
    });
    ChatWindow.loadFile('./api/chat/chat.html');
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
        delete chatWindows[roomDetails.roomName]; 
        if(ContactWindow){
            ContactWindow.webContents.send('user-left-chat', roomDetails.you);
        }
    });
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

ipcMain.on('log-in', (event, username) => {
    console.log('lol');
    socket.emit('log-user', username);
    console.log('no connect?');
    
});
ipcMain.on('get-active-users',() => {
    socket.emit('active-users');
    socket.once('active-users-response', (activeClients) => {
        ContactWindow.webContents.send('active-users', activeClients);
    });
})

ipcMain.on('open-chat-requests-menu',(event, requests) => {
    createChatRequestsWindow(requests);
})
ipcMain.on('send-chat-request', (event, request) => {
    // should check if user is already in a chat with recipient 
    socket.emit('send-chat-request', request);
}) 
//send requests to contact to delete them from the storage
ipcMain.on('reject-request',(event, messageId)=>{
    ContactWindow.webContents.send('rejected-chat-request', messageId);
    console.log('rejected request');

});
ipcMain.on('accept-request', async (event, messageId)=>{
    ContactWindow.webContents.send('accepted-chat-request',messageId);
    console.log('accepted message');
    const message = messageId.split('-');
    const senderName = message[0];
    const recipientName = await getUsername();
    socket.emit('chat-accepted',{ sender:senderName , recipient: recipientName});
})
// ipcMain.on('create-chat',(event, roomDetails) => {
//     console.log(roomDetails);
//     createChatWindow(roomDetails);
// })
ipcMain.on('send-message',(event, messageDetails) => {
    console.log(messageDetails);
    socket.emit('sent-message-to-server', messageDetails);

})
function findChatRoom(roomName){
    console.log('roomName ', roomName);
    const obj =  chatWindows.find(room => room.roomName === roomName);
    return obj.chatRoom;
}


///////////////Token management////////////////
ipcMain.on('set-first-token',(event ,userToken) =>{
    store.set('userToken',userToken);
});
ipcMain.on('token-request',(event) =>{
    const token = store.get('userToken');
    event.sender.send('getToken', token);
});


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

socket.on('connect', ()=> {
    console.log('Connected to server with socket ID: ', socket.id);
    socket.on('active-users-update', activeClients => {
        if(ContactWindow){
            ContactWindow.webContents.send('active-users-update', activeClients);        
        }
    });
    socket.on('listen-for-chat-requests', request => {
        if(ContactWindow){
            ContactWindow.webContents.send('listen-for-chat-requests', request)
        }
    });

    socket.on('join-room', data => {
        console.log(data);
        
        socket.emit('request-to-join-chat', data.roomName);
        console.log(`Joined room: ${data.roomName} with ${data.otherUser}`);
        createChatWindow(data);
    });  
    
    socket.on('join-failed',otherUser => {
        createErrorWindow(`Error: ${otherUser} failed to join room `)
    });
    
    socket.on('get-message', messageDetails => {
        console.log('sending message: ');
        try{
            const chatRoom = findChatRoom(messageDetails.messageRoom); 
            console.log(chatRoom);
                    
            chatRoom.webContents.send('get-message',messageDetails);
        }
        catch(error){
            console.log('Error getting message from server:' + error);
        }
    });

    
})
