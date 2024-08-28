require('dotenv').config();
const { log } = require('console');
const {ipcRenderer} = require('electron');
const fs = require('fs');


function switchToRegister(){
    ipcRenderer.send('login-to-register')
}
function goToContacts(){
    ipcRenderer.send('login-to-contacts')

}
 
function getLastUser(){
   fs.readFile('public/last_user.txt','utf-8',(err,data)=>{
    if(err){
        console.log(err);
    }
    else{
        document.getElementById('logUsername').value = data;
    }
   }) 
}

async function userOnline(username){
    const request = await fetch('http://localhost:3000/userOnline',{
        method:"POST",
        headers:{
            'Content-Type':'application/json'
        },
        body:JSON.stringify({username})
    })
    const data = await request.json();
    if(data.success){
        console.log('user online');
    }
    console.log('failed turning user online');
}

async function generateTempToken(username){
    const request = await fetch('http://localhost:3000/generateToken',{
        method:"POST",
        headers:{
            'Content-Type':'application/json'
        },
        body:JSON.stringify({username})
    });
    const data = await request.json();
    //save token as a txt
    if(data.success){
        ipcRenderer.send('setUserToken', data.success);
    }
    else if(data.error){
        console.error('Error authenticating Refresh token');
    }
    
}

function saveLastUser(username){
    fs.writeFile('public/last_user.txt',username,'utf-8',(err)=>{
        console.log('file created successfuly');
    });
}

async function login(){
    const username = document.getElementById('logUsername').value;
    const password = document.getElementById('logPassword').value;
    const user = {username,password}
    const response = await findUser(user);
    if(!response){
        //LOG IN = ENTER THE CONTACTS LIST AND GENERATE JWT TOKEN FROM SERVER 
        saveLastUser(username)
        await generateTempToken(username);
        await userOnline(username);
        goToContacts();
        
    }
    else{
        alert('User not found')
    }

}

async function findUser(user){
    const request = await fetch('http://localhost:3000/findUser',{
        method:'POST',
        headers:{
            'Content-Type':'application/json'
        },
        body:JSON.stringify({user})
    })
    const response = await request.json();
    console.log(response);
    // if user not found it returns false
    if(response.response === 'OK'){
        return false;
    }
    return true;
}

getLastUser();
document.getElementById('loginButton').addEventListener('click',login);
















document.getElementById('logSwitchReg').addEventListener('click',switchToRegister);

