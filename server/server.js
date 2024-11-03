const http = require('http');
require('dotenv').config();
const jwt =  require('jsonwebtoken');
const express = require('express');
const app = express();
const multer = require('multer');
const bodyParser = require('body-parser');
const socketio = require('socket.io'); //ill use this for chat app
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL);


app.use(bodyParser.urlencoded({extended:false}));
app.use(bodyParser.raw({ type: 'application/octet-stream', limit: '10mb' })); //allows the server to handle binary raw data
app.use(bodyParser.json());

app.use(express.static('api'));
const server = http.createServer(app);
const io = socketio(server);
const upload = multer();


//Handle Socket.io events
const activeClients = {};
io.on('connection', (socket)=>{
    socket.on('log-user', (username)=>{ 
        console.log('User registered:', username, ' ', socket.id);
        activeClients[username] = socket.id;
        console.log(activeClients);
        io.emit('active-users-update', Object.keys(activeClients));
        console.log('sent ', activeClients);
    });
    
    socket.on('disconnect',()=>{
        try{
            const username = Object.keys(activeClients).find(key => activeClients[key] === socket.id);
            delete activeClients[username];
            console.log('User disconnected: ', username);  
            io.emit('active-users-update', Object.keys(activeClients));
        }
        catch(error){
            return console.error('Error disconnecting user: ',error)
        }
    });
        
    socket.on('active-users', () => {
        console.log('active users : ', Object.keys(activeClients));
        socket.emit('active-users-response', Object.keys(activeClients));
    });

    socket.on('send-request',(request) => {
        console.log(request);
        const recipientSocketId = activeClients[request.recipient];
        if(recipientSocketId){
            io.to(recipientSocketId).emit('listen-for-requests', request);
        }
        else{
            console.log(`User ${recipientUsername} is offline`);
        }
    })
    socket.on('request-accepted',data =>{
        const recipientUsername = data.recipient;
        const senderUsername = data.sender;
        console.log(recipientUsername,' accepted ',senderUsername,` ${data.activity} request`);
        let roomName
        if(data.activity === 'chat'){
            roomName = `${senderUsername}-${recipientUsername}`;
        }
        else{
            roomName = `${senderUsername}-${recipientUsername}-game`
        }
        const recipientSocketId = activeClients[recipientUsername];
        const senderSocketId = activeClients[senderUsername];
        if(recipientSocketId && senderSocketId){
            io.to(senderSocketId).emit('join-room',{roomName, otherUser:recipientUsername, you:senderUsername, activity:data.activity});
            io.to(recipientSocketId).emit('join-room', {roomName, otherUser:senderUsername, you:recipientUsername, activity:data.activity});

            console.log(`Room Created: ${roomName}`);
        }
        else{
            try{
                io.to(senderSocketId).emit('join-failed', recipientUsername);
                io.to(recipientSocketId).emit('join-failed', senderUsername);
            }
            catch{
                console.log('ERROR: 404 user not found');
            }
        }
    });

    socket.on('request-to-join-room', room => {
        console.log('join da room');
        
        socket.join(room);
        const clientsInRoom = Array.from(io.sockets.adapter.rooms.get(room) || []);
        console.log(`Clients in room ${room}: ${clientsInRoom}`);
    });

    socket.on('sent-message-to-server',messageDetails => { 
        console.log(messageDetails);
        io.to(messageDetails.messageRoom).emit('get-message', messageDetails);
        // io.emit('get-message', messageDetails);
    })
    socket.on('user-left-chat', details => {
        console.log(`${details.userLeft} has left the chat`);
        socket.leave(details.room);
        io.to(details.room).emit('user-left-chat', details);
    });
    socket.on('leave-chat-room', (room) => {
        socket.leave(room);
    })
    socket.on('send-turn-to-server', data => {
        io.to(data.room).emit('change-turns', {cellId:data.cellId, color:data.color});
    })
    socket.on('rematch-request', data => {
        console.log('rematch accept reached server');
        console.log(data);
        
        io.to(data.room).emit('rematch-requested', data.sender);
    })
    socket.on('user-left-game', data => {
        socket.leave(data.room);
        console.log(data.userLeft , ` Has left the game`);
        io.to(data.room).emit('user-left-game-room', {userLeft: data.userLeft, room: data.room});
    });
    socket.on('leave-game-room', room => {
        socket.leave(room)
    })
    socket.on('user-quit', data => {
        socket.leave(data.room);
        io.to(data.room).emit('user-quit-game-room', data.userLeft);
    })
});


//request to check if username exists
app.post("/findUsername", async (req,res)=>{ 
    const name  = req.body.name;
    const result = await sql `SELECT * FROM "users" WHERE username = ${name}`
    if (result.length > 0){res.send({'response':'NOT OK'})} 
    else{res.send({'response':'OK'})}
})


//request for getting username from decrypting token
app.post('/getUsernameFromServer', async (req,res)=>{
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

function userOffline(username){
    const socket = activeClients[username];
    socket.disconnect();
}

//function to verify refresh token
function verifyRefreshToken(token,username){
    try{
        const user = jwt.verify(token , process.env.REFRESH_TOKEN_SECRET);
        return {'success':'user can get new token'}
    }
    catch(err){
        console.error('error verifying refreshToken: '+ err)
        userOffline(username);
        return {'faliure':'cannot verify refresh user now offline'}
    }
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
    console.log('server fetching token: ',token);
    return token.refreshToken;
}

app.post('/userOffline',async (req,res)=>{
    const {username} = req.body;
    try{
        userOffline(username);
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
    const authentication = verifyRefreshToken(refreshToken,username);
    //see what i get
    if(authentication.error){
        res.send({'error' : 'error authenticating token'});
    }   
    else if (authentication.success){
        const token = generateTempToken(username);
        res.send({'success' : token});
    }
    
})

app.post('/uploadPicture', upload.single('image'), async (req,res)=>{
    try{
        const imageBuffer = req.file.buffer;
        const username = req.body.username;
        await sql`UPDATE users SET picture = ${imageBuffer} WHERE username = ${username}`;
        res.status(200).send({'message':'success'})
    }
    catch(err){
        console.error('Error saving image to db ', err);
        res.status(400).send({'message':'faliure'})
    }
    
})
app.get('/getProfilePicture',async (req,res)=>{
    try{
        const username = req.query.username;
        const result = await sql`SELECT picture FROM users WHERE username =${username}`;
        if(result[0].picture !== null){
            const imageBuffer = result[0].picture;
            const base64Image = Buffer.from(imageBuffer).toString('base64');
            res.status(200).send({
                'image':base64Image,
                contentType: 'image/jpeg'
            });
        }
        else{
            res.status(404).send({message:'No image found for the user',src:'/defaultProfilePic.png'})
        }
    }
    catch(err){
        console.error('Error fetching image: ', err)
        res.status(500).send({message: 'Failed to retrieve image',src:'/defaultProfilePic.png'})
    }
    

})

//request to verify token before doing activities
app.post('/verifyToken',async (req,res)=>{
    const {token} = req.body;
    const auth = await verifyTempToken(token);
    res.send({auth});
})

//request to get all member names and their activity status
app.post('/getAllUsers' , async (req,res) => {
    const username = req.body.username;
    const list = await getAllContacts(username);
    res.send({list})
})










const port = '3000';

server.listen(port,async ()=>{
    console.log(`listening on port ${port} :D`);

})



module.exports = app;