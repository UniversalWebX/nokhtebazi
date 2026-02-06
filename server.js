const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const DATA_FILE = './users.json';

// Initialize JSON file if it doesn't exist
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ OWNER: { score: 0, wins: 0 } }));
}

let isLockedDown = false;

app.use(express.static('public'));

io.on('connection', (socket) => {
    socket.on('login', (username) => {
        if (isLockedDown && username !== 'OWNER') {
            return socket.emit('errorMsg', 'Server is locked by OWNER.');
        }

        let users = JSON.parse(fs.readFileSync(DATA_FILE));
        if (!users[username]) {
            users[username] = { score: 0, wins: 0 };
            fs.writeFileSync(DATA_FILE, JSON.stringify(users));
        }

        socket.username = username;
        socket.emit('loginAuthorized', { 
            username, 
            isOwner: username === 'OWNER',
            allUsers: users 
        });
    });

    socket.on('joinRoom', (code) => {
        socket.join(code);
        socket.to(code).emit('chat', `${socket.username} joined the party.`);
    });

    // --- OWNER ONLY COMMANDS ---
    socket.on('ownerAction', (data) => {
        if (socket.username !== 'OWNER') return;

        if (data.action === 'lockdown') {
            isLockedDown = true;
            io.emit('kick', 'The OWNER has locked the website.');
        } 
        if (data.action === 'unlock') {
            isLockedDown = false;
        }
        if (data.action === 'setScore') {
            let users = JSON.parse(fs.readFileSync(DATA_FILE));
            if (users[data.target]) {
                users[data.target].score = parseInt(data.value);
                fs.writeFileSync(DATA_FILE, JSON.stringify(users));
                io.emit('updateLeaderboard', users);
            }
        }
    });

    // Game Logic: Line Clicked
    socket.on('makeMove', (moveData) => {
        // moveData = { room, lineId, player }
        io.to(moveData.room).emit('moveMade', moveData);
    });
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
