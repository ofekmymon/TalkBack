require('dotenv').config();
const jwt =  require('jsonwebtoken');
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const socketio = require('socket.io')
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL);


app.use(bodyParser.urlencoded({extended:false}));
app.use(bodyParser.json());

app.use(express.static('api'));

// const io = socketio(server);
const port = '3000';

app.listen(port,async ()=>{
    console.log(`listening on port ${port} :D`);
    await allUsersOffline()
})



//// INACTIVE USER FINDER /////


const activeClients = {};
let newlyOffline = [];

app.post('/heartbeat',(req,res) => {
    const clientName = req.body.username;
    activeClients[clientName] = Date.now();
    res.send({'statusCode':'OK',newlyOffline});
});


setInterval(async()=>{
    const now = Date.now();
    newlyOffline = [];
    newlyOffline.length = 0;
    for (const username in activeClients) {
        if (now - activeClients[username] > 60000) {
            //get the name of the offline user
            newlyOffline.push(Object.keys(activeClients).find(key => activeClients[key] === value));
            console.log(newlyOffline);
            delete activeClients[username];
            await makeUserOffline(username); 
            console.log(`Client ${username} has been inactive and removed from the list.`);
        }
    };
    console.log(activeClients);
},30000) //every 30 seconds


//////////////////////////////

//request to check if username exists
app.post("/findUsername", async (req,res)=>{ 
    const name  = req.body.name;
    const result = await sql `SELECT * FROM "users" WHERE username = ${name}`
    if (result.length > 0){res.send({'response':'NOT OK'})} 
    else{res.send({'response':'OK'})}
})


async function getAllActiveCUsers(){
    const active = await sql`SELECT * FROM users WHERE onlinestatus = ${true}`;
    return active;
}

//request for getting username from decrypting token
app.post('/getUsername', async (req,res)=>{
    const token = req.body.token;
    const result = await verifyTempToken(token);
    if(result.success){
        const username = result.success;
        res.send({username});

    }
    else{
        res.send(result);
    }
    
})

//request to put user in db
app.post("/registerUser", async (req,res) => {
    const {username,password,refreshToken} = req.body.user

    try{
        await sql `INSERT INTO users(username,password,"refreshToken") VALUES(${username},${password},${refreshToken})`;
        res.send({'response':'successful'});
        console.log('registered successfuly');
    }
    catch(err){
        console.error('ERROR ADDING USER: '+err)
        res.send({'response':'faliure'});
    }
})

app.post('/findUser', async (req,res)=>{
    const {user} = req.body;
    user.password = Buffer.from(user.password).toString('base64');
    const result = await sql `SELECT * FROM users WHERE username = ${user.username} AND password = ${user.password}`
    if(result.length > 0 ){
        res.status(200).send({'response':'OK'})
    }
    else{
        res.status(401).send({'response':'NOT OK'})
    }
})
app.post('/getRefreshToken',(req,res)=>{
    const username = req.body.username;
    const refreshToken = jwt.sign({ username }, process.env.REFRESH_TOKEN_SECRET);
    res.send({refreshToken});
})

async function userOffline(username){
    await sql`UPDATE users SET onlinestatus = ${false} WHERE username = ${username}`;
}

//function to verify refresh token
async function verifyRefreshToken(token,username){
    try{
        const user = jwt.verify(token , process.env.REFRESH_TOKEN_SECRET);
        return {'success':'user can get new token'}
    }
    catch(err){
        console.error('error verifying refreshToken: '+ err)
        await userOffline(username);
        return {'faliure':'cannot verify refresh user now offline'}
    }
}

async function makeUserOnline(username){
    console.log(username + ` Turned Online`);
    await sql `UPDATE users SET onlinestatus = ${true} WHERE username = ${username}`;
}
async function makeUserOffline(username){
    console.log(username + ` Turned Offline`);
    await sql `UPDATE users SET onlinestatus = ${false} WHERE username = ${username}`;
}

async function allUsersOffline(){
    await sql` UPDATE users SET onlinestatus = ${false}`
}

//function to verify temp token
async function verifyTempToken(token){
    try{
        const user = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        return {'success':user.username};
    }
    catch(err){
        console.log('ERROR : temp token has expired');
        return {'faliure':'error'};
    }
}

//function that pulls for the user's refresh token from db
async function getUserRefreshToken(username){
    const result = await sql `SELECT "refreshToken" FROM users WHERE username = ${username}`
    const token = result[0];
    return token.refreshToken;
}

//request to change user's online status to online
app.post('/userOnline',async (req,res)=>{
    const {username} = req.body;
    try{
        makeUserOnline(username); 
        res.send({'success':'user online'})
    }
    catch{
        res.send({'faliure':'user not online'})
    }
    
})

//request to change user's online status to offline
app.post('/userOffline',async (req,res)=>{
    const {username} = req.body;
    try{
        makeUserOffline(username); 
        console.log('user offline');
        res.send({'success':'user offline'})
    }
    catch{
        res.send({'faliure':'user not offline'})
    }
})

function generateTempToken(username){
    const token = jwt.sign( {username} , process.env.ACCESS_TOKEN_SECRET ,{expiresIn:'5m'});
    return token;
}   

//request to get a new temp token
app.post('/generateToken',async (req,res)=>{
    const username = req.body.username;
    const refreshToken = await getUserRefreshToken(username);
    const authentication = await verifyRefreshToken(refreshToken,username);
    //see what i get
    if(authentication.error){
        res.send({'error' : 'error authenticating token'});
    }   
    else if (authentication.success){
        const token = generateTempToken(username);
        res.send({'success' : token});
    }
    
})

//function to get all members and their online status
async function getAllContacts(username){
    try{
        const contactList = await sql `SELECT username,onlinestatus FROM users WHERE username != ${username}`
        return contactList;
    }
    catch(err){
        console.error(`error getting all users `+err)
        return {'error':'error verifying token logging out user'}
    }
}

//request to verify token before doing activities
app.post('/verifyToken',async (req,res)=>{
    const {token} = req.body;
    const auth = await verifyTempToken(token);
    res.send({auth});
})

//request to get all member names and their activity status
app.post('/getAllUsers' , async (req,res) => {
    const username = req.body;
    console.log('getting all users for:');
    const list = await getAllContacts(username);
    res.send({list})
})














module.exports = app;