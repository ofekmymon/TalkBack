const {ipcRenderer} = require('electron');
const {io} = require('socket.io-client');
const socket = io('http://localhost:3000');



class Request {
    constructor(sender,activityType,recipient){
        this.activityType = activityType,
        this.sender = sender
        this.recipient = recipient
    };
};




function signOut(){
    goToLogin();
}

function goToLogin(){
    ipcRenderer.send('switch-to-login');
}


//store on local storage
function storeToken (token){
    sessionStorage.setItem('token',token);
}
function storeUsername (username){
    sessionStorage.setItem('username', username);
}
function storeRequests(request) {
    let requests = askRequests() || [];
    if (!Array.isArray(requests)) {
        if(typeof requests === 'string'){
            requests = JSON.parse(requests);
        }
        else{
            console.error('Expected an array but got:', typeof requests);
            return;
        }
    }
    requests.push(request);
    requests = removeDuplicates(requests);
    sessionStorage.setItem('requests', JSON.stringify(requests));
}
//sends request to get from local storage
function askUsername(){
    const username = sessionStorage.getItem('username');
    return username;
}
function askToken(){
    const token = sessionStorage.getItem('token');
    return token;
}
function askRequests(){
    const requests = sessionStorage.getItem('requests') || [];
    return requests;
}


async function askFirstToken(){
    return new Promise((resolve,reject)=>{
        ipcRenderer.send('token-request');
        ipcRenderer.once('getToken', (event, token) => {
            resolve(token);
        });
        //timeout if promise takes too long
        setTimeout(() => {
            reject(new Error('Timeout: Token request took too long'));
        }, 5000);
    });
}
document.getElementById('signout').addEventListener('click',signOut);

function removeDuplicates(list){
    
    const uniqueArray = list.filter((item, index) => {
    const itemString = JSON.stringify(item);
    return index === list.findIndex(obj => {
        return JSON.stringify(obj) === itemString;
    });
    });
    
    return uniqueArray;
};
ipcRenderer.on('rejected-chat-request',(event,messageId) => {
    deleteRequest(messageId);
});

ipcRenderer.on('accepted-chat-request',(event,messageId) => {
    deleteRequest(messageId);
});
ipcRenderer.on('ask-username', () => {
    ipcRenderer.send('get-username',askUsername());
})

// ipcRenderer.on('user-left-chat',(event, username) => {
//     socket.emit('user-left-chat', username)
// });

function deleteAllChildren(container){
    while(container.firstChild){
        container.removeChild(container.firstChild);
    }
};

function deleteRequest(request){
    const list = JSON.parse(askRequests());
    const message = request.split('-');
    //order is important
    const tempObject = {activityType:message[1],sender:message[0],recipient:askUsername()};
    console.log(tempObject);
    const toDelete = JSON.stringify(tempObject);
    console.log(toDelete);
    
    const updatedList = list.filter((item)=>{
        console.log(JSON.stringify(item));
        return JSON.stringify(item) !== toDelete;
    })
    console.log(updatedList);
    
    sessionStorage.setItem('requests', JSON.stringify(updatedList));
}

async function getUsernameFromServer(token){
    //used for the first instance of getting a username before storing it
    const request =  await fetch('http://localhost:3000/getUsernameFromServer',{
        method:'POST',
        headers:{
            'Content-Type':'application/json'
        },
        body:JSON.stringify({token})
    })
    const data = await request.json();
    return data.username;
}

function convertBoolToStatus(bool){
    if(bool){
        return 'Online'
    }
    return 'Offline'
}

function searchbar(list) {
    const filter = document.getElementById('searchBar').value.toLowerCase(); 
    return list.filter(item => item.toLowerCase().includes(filter)); 
}

document.getElementById('searchBar').addEventListener('input',()=>{
    ipcRenderer.send('get-active-users');
    ipcRenderer.on('active-users',(event, activeClients) => {
        const filteredUsers = searchbar(activeClients);
        console.log('filtered users ',filteredUsers);
        createContactList(askUsername(), filteredUsers);
    })

});

document.getElementById('refresh').addEventListener('click',()=>{
    ipcRenderer.send('get-active-users');
    ipcRenderer.on('active-users',(event, activeClients) => {
        createContactList(askUsername(), activeClients);
    })

});

async function getPictureFromServer(username,method){
    console.log('getting username for picture ',username);
    
    const response = await fetch(`http://localhost:3000/getProfilePicture?username=${username}`);
    const data = await response.json();
    if(data.image){
        if(method === 'profile'){
            const imgElement = document.getElementById('profileIcon');
            imgElement.src = `data:${data.contentType};base64,${data.image}`
        }
        else if(method === 'contacts'){
            const imgElement = document.getElementById(`img-${username}`);
            imgElement.src = `data:${data.contentType};base64,${data.image}`
        }
    }
    else if(data.status == 500){
        alert('Sorry we could not fetch your image')
    }
}
document.getElementById('requestsMenu').addEventListener('click',()=>{
    document.getElementById('requestsMenuNotifier').classList.remove('new');
    const requests = askRequests();
    ipcRenderer.send('open-chat-requests-menu',requests);
});
document.getElementById('profileIcon').addEventListener('click',()=>{
    document.getElementById('fileInput').click();
})
document.getElementById('fileInput').addEventListener('change',async (event)=>{
    const file = event.target.files[0]; 
    if (file) {
        const reader = new FileReader();
        reader.onload = async (e) =>{
            // puts the image now to the client
            const imageUrl = e.target.result;
            document.getElementById('profileIcon').src = imageUrl;
            //
            const formData = new FormData();
            const username = askUsername();
            formData.append('username', username);
            formData.append('image',file);
            const bytes = new Uint8Array(imageUrl);
            fetch('http://localhost:3000/uploadPicture',{
                method:'POST',
                body: formData
            }).then(response => {return response.json();}).then(data => {
                console.log('Success:', data);
            }).catch(error => {
                console.error('Error:', error);
                alert('Failed to save image to database.')
            });
        }
        reader.readAsDataURL(file);
    }

})

function createContactList(username,userList){
    console.log('getting data from contactlist');
    
    console.log(username);
    console.log(userList);
    
    
    if(!userList){
        console.log(data.error);
        signOut();
    }
    else{
        console.log('sending create contact list userlist : ', userList);
        
        //remove own username from list
        let allClients = userList.toSpliced(userList.indexOf(username),1); 
        const container = document.getElementById('contacts');
        deleteAllChildren(container);

        console.log('SHOULD SHOW ALL OTHER USERS: ',allClients);
        allClients.map(item => {
            //THIS IS THE FORMAT
            //     <div class="contactContainer">
            //         <div class="contactName">Name</div>
            //         <div class="contactDetails">
            //             <button class="gameButton">PlayGame</button>
            //             <button class="chatButton">Chat</button>
            //         </div>
            //     </div>

            //get online status from the false/true in db
            
            const status = convertBoolToStatus(item.onlinestatus);

            const contactContainer = document.createElement('div');
            contactContainer.id = item;
            contactContainer.classList.add('contactContainer');

            const contactName = document.createElement('div');
            contactName.textContent = item;
            contactName.classList.add('contactName');

            const profilePicture = document.createElement('img');
            profilePicture.classList.add('contactProfilePicture')
            profilePicture.id = `img-${item}`;
            getPictureFromServer(item,'contacts');

            const contactDetails = document.createElement('div');
            contactDetails.classList.add('contactDetails');

            const gameButton = document.createElement('button');
            gameButton.id = item;
            gameButton.textContent = 'Play Game'
            gameButton.classList.add('gameButton');

            const chatButton = document.createElement('button');
            chatButton.id = item;
            chatButton.textContent = 'Chat';
            chatButton.classList.add('chatButton');
            chatButton.addEventListener('click',()=>{sendRequest(askUsername(),'chat',item)});

            contactDetails.appendChild(gameButton);
            contactDetails.appendChild(chatButton);

            contactContainer.appendChild(profilePicture)
            contactContainer.appendChild(contactName);
            contactContainer.appendChild(contactDetails);

            container.append(contactContainer);
        })
    }
}
function sendRequest(username,activity,recipient){
    const request = new Request(username,activity,recipient);
    ipcRenderer.send('send-chat-request', request)
    
}


(async ()=>{
    const token = await askFirstToken();
    try{
        const username = await getUsernameFromServer(token);
        document.getElementById('profileName').textContent = username;
        storeUsername(username);
        await getPictureFromServer(username,'profile');
        ipcRenderer.on('active-users-update', (event ,activeClients) => {
            console.log('active clients are: ', activeClients);
            createContactList(username,activeClients);
        });
        ipcRenderer.on('listen-for-chat-requests', (event, request) => {
            document.getElementById('requestsMenuNotifier').classList.add('new');
            storeRequests(request);        
        })
           

        
    }   
    catch(err){
        console.log('error : ',err);
        signOut();
    }
    
})();
