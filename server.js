const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const DATA_FILE = path.join(__dirname, 'users.json');

// Helper to manage JSON DB
const readDB = () => JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
const writeDB = (data) => fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

if (!fs.existsSync(DATA_FILE)) writeDB({ OWNER: { score: 0, color: '#000000' } });

let isLockedDown = false;

app.use(express.static('public'));

io.on('connection', (socket) => {
    socket.on('login', (username) => {
        if (isLockedDown && username !== 'OWNER') return socket.emit('errorMsg', 'Site Locked.');

        let users = readDB();
        if (!users[username]) {
            // Assign random bright color
            const randomColor = `hsl(${Math.random() * 360}, 70%, 50%)`;
            users[username] = { score: 0, color: randomColor };
            writeDB(users);
        }

        socket.username = username;
        socket.color = users[username].color;
        socket.emit('loginAuthorized', { 
            username, 
            color: socket.color,
            isOwner: username === 'OWNER' 
        });
    });

    socket.on('joinRoom', (code) => socket.join(code));

    socket.on('makeMove', (data) => {
        // data: { room, r, c, type }
        io.to(data.room).emit('moveMade', { ...data, color: socket.color, user: socket.username });
    });

    socket.on('ownerAction', (data) => {
        if (socket.username !== 'OWNER') return;
        if (data.action === 'lockdown') {
            isLockedDown = true;
            io.emit('kick', 'The OWNER locked the site.');
        } else if (data.action === 'unlock') {
            isLockedDown = false;
        } else if (data.action === 'setScore') {
            let users = readDB();
            if (users[data.target]) {
                users[data.target].score = parseInt(data.value);
                writeDB(users);
                io.emit('updateUI'); 
            }
        }
    });
});

server.listen(process.env.PORT || 3000);
