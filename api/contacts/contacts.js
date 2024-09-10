const {ipcRenderer} = require('electron');
const { response } = require('../../server/server');

function signOut(){
    goToLogin();
}

function goToLogin(){
    ipcRenderer.send('switch-to-login');
}

async function askToken(){
    return new Promise((resolve,reject)=>{
        ipcRenderer.send('tokenRequest');
        ipcRenderer.once('getToken', (event, token) => {
            console.log('token iss ',token);
            resolve(token);
        });
        //timeout if promise takes too long
        setTimeout(() => {
            reject(new Error('Timeout: Token request took too long'));
        }, 5000);
    });
}
async function askUsername(){
    return new Promise((resolve,reject)=>{
        ipcRenderer.send('getCurrentUsername');
        ipcRenderer.once('getUsername', (event, username) => {
            resolve(username);
        });

        setTimeout(() => {
            reject(new Error('Timeout: Token request took too long'));
        }, 5000);
    })
}
//stores token in main.js
function storeToken (token){
    ipcRenderer.send('setUserToken',token);
}
//stores username in main.js
function storeUsername (username){
    ipcRenderer.send('setCurrentUsername',username);
}

async function createNewToken(){
    const username = await askUsername();
    
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
        const username = await askUsername();
        await createNewToken(username);
        return 'NOT OK';
    }
    else{
        return 'OK'
    }
} 

function catchDisconnected(list){
    if(list.length > 0){
        let names = '';
        list.forEach((name) =>{
            names += ` ${name}\n`
        })
        console.log(names);
        alert(`${names} have disconnected`);
    }   
}

function deleteAllChildren(container){
    while(container.firstChild){
        container.removeChild(container.firstChild);
    }
}

async function sendHeartbeat(){
    const username = await askUsername();
    const request = await fetch('http://localhost:3000/heartbeat',{
        method:'POST',
        headers:{
            'Content-Type':'application/json'
        },
        body:JSON.stringify({username})
    });
    const response = await request.json();

    const token = await askToken();
    if(!response.statusCode === 'OK'){
        console.error('Failed to send heartbeat');
    }
    if(response.newlyOffline.length > 0){
        catchDisconnected(response.newlyOffline);
    }
    await verifyToken(token,username);
    await createContactList(username);
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

function sortList(list){
    //online first then ab
    // NEED TO DO: ADD THE OPTION OF SORTING PURELY BY AB
    list.sort((a, b) => {
        if (a.onlinestatus === b.onlinestatus) {
            return a.username.localeCompare(b.username);
        }
        return a.onlinestatus ? -1 : 1;
    });
    return list;
}
async function getPictureFromServer(username){
    const response = await fetch(`http://localhost:3000/getProfilePicture?username=${username}`);
    const data = await response.json();
    if(data.image){
        const imgElement = document.getElementById('profileIcon');
        imgElement.src = `data:${data.contentType};base64,${data.image}`
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
            const username = await askUsername();
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


async function createContactList(username){
    const request = await fetch('http://localhost:3000/getAllUsers',{
        method:'POST',
        headers:{
            'Content-Type':'application/json'
        },
        body:JSON.stringify({username})
    })
    const data = await request.json();
    if(await data.error){
        console.log(data.error);
        signOut();
    }
    else{
        //list of all users names and their status
        document.getElementById('profileName').textContent = username;
        const container = document.getElementById('contacts');
        deleteAllChildren(container);
        const list = sortList(data.list);
        await list.map(item => {

            //THIS IS THE FORMAT
            //     <div class="contactContainer">
            //         <div class="contactName">Name</div>
            //         <div class="contactDetails">
            //             <button class="gameButton">PlayGame</button>
            //             <div class="contactStatus online">online</div>  
            //             <button class="chatButton">Chat</button>
            //         </div>
            //     </div>

            //get online status from the false/true in db
            
            const status = convertBoolToStatus(item.onlinestatus);

            const contactContainer = document.createElement('div');
            contactContainer.id = item.username;
            contactContainer.classList.add('contactContainer');

            const contactName = document.createElement('div');
            contactName.textContent = item.username;
            contactName.classList.add('contactName')

            const contactDetails = document.createElement('div');
            contactDetails.classList.add('contactDetails');

            const gameButton = document.createElement('button');
            gameButton.id = item.username;
            gameButton.textContent = 'Play Game'
            gameButton.classList.add('gameButton');

            const contactStatus = document.createElement('div');
            contactStatus.textContent = status;
            contactStatus.classList.add(status);
            contactStatus.classList.add('contactStatus');

            const chatButton = document.createElement('button');
            chatButton.id = item.username;
            chatButton.textContent = 'Chat'
            chatButton.classList.add('chatButton');

            contactDetails.appendChild(gameButton);
            contactDetails.appendChild(contactStatus);
            contactDetails.appendChild(chatButton);

            contactContainer.appendChild(contactName);
            contactContainer.appendChild(contactDetails);

            container.append(contactContainer);
        })
    }
}


(async ()=>{
    const token = await askToken();
    
    try{
        const auth = await verifyToken(token);
        if(auth != 'OK'){
            // if token expired need to redeclare it
            
        }
        const username = await getUsernameFromServer(token);
        storeUsername(username);
        await getPictureFromServer(username);
        await createContactList(username);
        setInterval(()=>{sendHeartbeat(username)}, 30000);
    }   
    catch(err){
        console.log('error : ',err);
        signOut();
    }
    
})();
