const {ipcRenderer} = require('electron');
const {io} = require('socket.io-client');
const socket = io('http://localhost:3000');
function signOut(){
    goToLogin();
}

function goToLogin(){
    ipcRenderer.send('switch-to-login');
}


//store on local storage
function storeToken (token){
    localStorage.setItem('token',token);
}
function storeUsername (username){
    localStorage.setItem('username', username);
}
//sends request to get from local storage
function askUsername(){
    const username = localStorage.getItem('username');
    console.log('local storage says username is: ',username);
    return username;
}
function askToken(){
    const token = localStorage.getItem('token');
    console.log('local storage says token is: ',token);
    return token;
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
//stores username in main.js
async function createNewToken(){
    const username = askUsername();
    console.log('username in create new token is: ',username);
    
    const request = await fetch('http://localhost:3000/generateToken',{
        method:'POST',
        headers:{
            'Content-Type':'application/json'
        },
        body:JSON.stringify({username})
    });
    const response = await request.json();
    if(response.error){
        //sign user out and kick to login screen
        alert('error verifying session');
        signOut(username);
    }
    else if(response.success){
        storeToken(response.success);
        console.log('new token created successfuly');
    }
}
//function to verify token if token expired makes new one if cant kicks user
async function verifyToken(token){
    const request = await fetch('http://localhost:3000/verifyToken',{
        method:'POST',
        headers:{
            'Content-Type':'application/json'
        },
        body:JSON.stringify({token})
    });
    const response = await request.json();
    if(response.auth.faliure){
        //if verification failed, a new token is needed if create fails user signs out
        console.log('token verification failed');
        await createNewToken();
        return 'NOT OK';
    }
    else{
        return 'OK'
    }
} 


function deleteAllChildren(container){
    while(container.firstChild){
        container.removeChild(container.firstChild);
    }
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
    socket.emit('active-users');
    socket.once('active-users-response', (activeClients) => {
        const filteredUsers = searchbar(activeClients);
        console.log('filtered users ',filteredUsers);
        createContactList(askUsername(), filteredUsers);
    });
});

function sortList(list){
    list.sort((a, b) => {
        if (a.onlinestatus === b.onlinestatus) {
            return a.localeCompare(b.username);
        }
        return a.onlinestatus ? -1 : 1;
    });
    return list;
}

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

        allClients = sortList(allClients);
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
            chatButton.addEventListener('click',()=>{sendChatRequest(item)})

            contactDetails.appendChild(gameButton);
            contactDetails.appendChild(chatButton);

            contactContainer.appendChild(profilePicture)
            contactContainer.appendChild(contactName);
            contactContainer.appendChild(contactDetails);

            container.append(contactContainer);
        })
    }
}
function sendChatRequest(username){
    socket.emit('send-chat-request',username);
}


(async ()=>{
    const token = await askFirstToken();
    try{
        const username = await getUsernameFromServer(token);
        document.getElementById('profileName').textContent = username;
        socket.on('connect', ()=>{
            console.log('Connected to server with socket ID: ', socket.id);
            //send username to server to add it to active list
            socket.emit('log-user', username);
        })
        storeUsername(username);
        await getPictureFromServer(username,'profile');
        socket.on('active-users-update',(activeClients)=>{
            console.log('active clients are: ', activeClients);
            createContactList(username,activeClients);
        });
        socket.on('listen-for-chat-requests',(user)=>{
            console.log('User ',user,' has requested to chat with you');
        })
    }   
    catch(err){
        console.log('error : ',err);
        signOut();
    }
    
})();
