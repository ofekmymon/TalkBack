const {ipcRenderer} = require('electron');
const fs = require('fs');

function switchToLogin(){
    console.log('sivuv');
    ipcRenderer.send('register-to-login');
}

async function checkForUsername(username){
    const request = await fetch('http://localhost:3000/findUsername', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: username })
    });
    const response = await request.json();
    if(response.response == 'OK'){
        return false;
    }
    return true;
}

async function generateRefreshToken(username){
    const request = await fetch('http://localhost:3000/getRefreshToken',{
        method:'POST',
        headers:{
            'Content-Type':'application/json'
        },
        body:JSON.stringify({username})
    })
    const {refreshToken} = await request.json();
    console.log(refreshToken);
    return refreshToken;
}

async function registerUser() {
    let flag = true;
    let errorMsg = '';
    const username = document.getElementById('registerUsername').value;
    if (username.length < 2 || username.length > 12) {
        flag = false;
        errorMsg += ' Username must be between 3-12 characters\n';
    }

    try {
    // Check for existing username
    const checkUsername = await checkForUsername(username);
    console.log(checkUsername);
    
        // if user exists it returns true
        if (checkUsername) {
            flag = false;
            errorMsg += ' Username already exists\n';
        }

        const password = document.getElementById('registerPassword').value;
        if (password.length < 3 || password.length > 12) {
            flag = false;
            errorMsg += ' Password must be between 4-12 characters\n';
        }

        if (flag) {
            const refreshToken = await generateRefreshToken(username);
            const encryptedPassword = Buffer.from(password).toString('base64');
            const user = {username,'password':encryptedPassword,refreshToken};

            const registerRequest = await fetch('http://localhost:3000/registerUser',{
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user })
            })
            const registerResponse = await registerRequest.json();
            
            if(registerResponse.response == 'successful'){
                console.log('ok');
                fs.writeFile('public/last_user.txt',username,'utf-8',(err)=>{
                    console.log('file created successfuly');
                });
                switchToLogin();
            }

        } else {
            ipcRenderer.send('register-error', errorMsg);

        }
    } catch (error) {
        console.error('Error processing request:', error);
        // Handle error here
    }
}

document.getElementById('registerButton').addEventListener('click',registerUser);
window.addEventListener('keydown',(e) => {
    if(e.key === 'Enter'){
        registerUser();
    }
});
document.getElementById('regSwitchLog').addEventListener('click',switchToLogin);