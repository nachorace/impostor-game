const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let players = []; // { id, name }
let host = null;
let roomPassword = null;

// Función para cargar jugadores desde players.json
function getFootballPlayers() {
    const filePath = path.join(__dirname, 'players.json');
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error('Error al leer players.json:', err);
        return [];
    }
}

io.on('connection', (socket) => {
    console.log('Nuevo jugador conectado:', socket.id);

    socket.on('joinRoom', ({ password, name }) => {
        if (!host) {
            host = socket.id;
            roomPassword = password;
            players.push({ id: socket.id, name: name });
            socket.emit('setHost');
            io.emit('playersUpdate', players);
            console.log(`Sala creada con contraseña: ${password}`);
            return;
        }

        if (password !== roomPassword) {
            socket.emit('wrongPassword');
            return;
        }

        players.push({ id: socket.id, name: name });
        io.emit('playersUpdate', players);
    });

    socket.on('startGame', () => {
        if (socket.id !== host) return;

        if (players.length < 3) {
            io.to(host).emit('gameError', 'Necesitas al menos 3 jugadores.');
            return;
        }

        const footballPlayers = getFootballPlayers();
        if (footballPlayers.length === 0) {
            io.to(host).emit('gameError', 'No hay jugadores de fútbol en la base de datos.');
            return;
        }

        const chosenPlayer = footballPlayers[Math.floor(Math.random() * footballPlayers.length)];
        const impostorIndex = Math.floor(Math.random() * players.length);

        players.forEach((p, index) => {
            if (index === impostorIndex) {
                io.to(p.id).emit('roleAssignment', { role: 'IMPOSTOR' });
            } else {
                io.to(p.id).emit('roleAssignment', { role: chosenPlayer });
            }
        });
    });

    socket.on('restartGame', () => {
        if (socket.id === host) {
            io.emit('resetGame');
        }
    });

    socket.on('disconnect', () => {
        players = players.filter(p => p.id !== socket.id);
        io.emit('playersUpdate', players);

        if (socket.id === host && players.length > 0) {
            host = players[0].id;
            io.to(host).emit('setHost');
        } else if (players.length === 0) {
            host = null;
            roomPassword = null;
        }
    });
});

app.use(express.static('public'));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});
