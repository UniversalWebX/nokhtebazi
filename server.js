const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const DATA_FILE = path.join(__dirname, 'users.json');
let isLockedDown = false;

// Initialize JSON database
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({}));
}

app.use(express.static('public'));

io.on('connection', (socket) => {
    socket.on('login', (username) => {
        if (isLockedDown && username !== 'OWNER') {
            return socket.emit('errorMsg', 'The website is currently locked by OWNER.');
        }

        let users = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        if (!users[username]) {
            // Assign a unique random color
            users[username] = { score: 0, color: `hsl(${Math.random() * 360}, 75%, 50%)` };
            fs.writeFileSync(DATA_FILE, JSON.stringify(users, null, 2));
        }

        socket.username = username;
        socket.color = users[username].color;
        socket.emit('loginAuthorized', { 
            username, 
            color: socket.color, 
            isOwner: username === 'OWNER' 
        });
    });

    socket.on('joinRoom', (code) => {
        socket.join(code);
        socket.room = code;
    });

    socket.on('makeMove', (data) => {
        if (!socket.room) return;
        io.to(socket.room).emit('moveMade', { ...data, color: socket.color });
    });

    socket.on('ownerAction', (data) => {
        if (socket.username !== 'OWNER') return;
        if (data.action === 'lockdown') {
            isLockedDown = true;
            io.emit('kick', 'SITE LOCKED BY OWNER.');
        } else if (data.action === 'unlock') {
            isLockedDown = false;
        } else if (data.action === 'setScore') {
            let users = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
            if (users[data.target]) {
                users[data.target].score = parseInt(data.value);
                fs.writeFileSync(DATA_FILE, JSON.stringify(users, null, 2));
            }
        }
    });
});

server.listen(process.env.PORT || 3000, () => console.log('Server Active'));
