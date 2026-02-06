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
let rooms = {};

if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify({}));

app.use(express.static('public'));

io.on('connection', (socket) => {
    socket.on('login', (username) => {
        if (isLockedDown && username !== 'OWNER') return socket.emit('errorMsg', 'SERVER LOCKED');
        let users = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        if (!users[username]) {
            users[username] = { score: 0, color: `hsl(${Math.random() * 360}, 80%, 60%)` };
            fs.writeFileSync(DATA_FILE, JSON.stringify(users, null, 2));
        }
        socket.username = username;
        socket.color = users[username].color;
        socket.emit('loginAuthorized', { username, color: socket.color, isOwner: username === 'OWNER' });
    });

    socket.on('joinRoom', (code) => {
        socket.join(code);
        socket.room = code;
        if (!rooms[code]) rooms[code] = { players: [], turnIndex: 0 };
        if (!rooms[code].players.find(p => p.id === socket.id)) {
            rooms[code].players.push({ id: socket.id, name: socket.username, color: socket.color });
        }
        updateRoomStatus(code);
    });

    socket.on('makeMove', (data) => {
        const room = rooms[socket.room];
        if (!room || room.players[room.turnIndex].id !== socket.id) return;
        io.to(socket.room).emit('moveMade', { ...data, color: socket.color, userName: socket.username });
    });

    socket.on('boxClosed', () => updateRoomStatus(socket.room)); 
    socket.on('nextTurn', () => {
        if (rooms[socket.room]) {
            rooms[socket.room].turnIndex = (rooms[socket.room].turnIndex + 1) % rooms[socket.room].players.length;
            updateRoomStatus(socket.room);
        }
    });

    socket.on('ownerAction', (data) => {
        if (socket.username !== 'OWNER') return;
        if (data.action === 'lockdown') { isLockedDown = true; io.emit('kick', 'LOCKDOWN'); }
        else if (data.action === 'unlock') isLockedDown = false;
    });

    function updateRoomStatus(code) {
        if (!rooms[code]) return;
        io.to(code).emit('updateTurn', {
            currentPlayer: rooms[code].players[rooms[code].turnIndex].name,
            players: rooms[code].players
        });
    }

    socket.on('disconnect', () => {
        if (socket.room && rooms[socket.room]) {
            rooms[socket.room].players = rooms[socket.room].players.filter(p => p.id !== socket.id);
            if (rooms[socket.room].players.length === 0) delete rooms[socket.room];
        }
    });
});

server.listen(process.env.PORT || 3000);    
