const http = require('http');
const WebSocket = require('websocket').server;

const server = http.createServer((req, res) => {
    // Handle HTTP requests if needed
});

server.listen(8765, () => {
    console.log('Server is listening on port 8765');
});

const wsServer = new WebSocket({
    httpServer: server
});

const rooms = new Map(); // Map to store rooms and their members

wsServer.on('request', (request) => {
    const connection = request.accept(null, request.origin);

    connection.on('message', (message) => {
        if (message.type === 'utf8') {
            const data = JSON.parse(message.utf8Data);

            if (data.type === 'room_request') {
                const { roomName, username } = data;
                joinRoom(roomName, username, connection);
            } else if (data.type === 'message') {
                broadcastMessage(data.room, data.username, data.message);
            }
        }
    });

    connection.on('close', (reasonCode, description) => {
        leaveRoom(connection);
    });
});

function joinRoom(roomName, username, connection) {
    if (!rooms.has(roomName)) {
        rooms.set(roomName, []);
    }

    const roomMembers = rooms.get(roomName);

    if (roomMembers.length < 3) {
        roomMembers.push({ username, connection });

        // Notify the user that they've joined the room
        const welcomeMessage = {
            type: 'message',
            room: roomName,
            username: 'Server',
            message: `${username} has joined the room.`,
        };
        connection.send(JSON.stringify(welcomeMessage));
    } else {
        // Notify the user that the room is full
        const roomFullMessage = {
            type: 'message',
            room: roomName,
            username: 'Server',
            message: 'The room is full. You cannot join at the moment.',
        };
        connection.send(JSON.stringify(roomFullMessage));
    }
}

function broadcastMessage(roomName, username, message) {
    if (rooms.has(roomName)) {
        const roomMembers = rooms.get(roomName);

        for (const member of roomMembers) {
            if (member.connection !== connection) {
                const messageData = {
                    type: 'message',
                    room: roomName,
                    username,
                    message,
                };
                member.connection.send(JSON.stringify(messageData));
            }
        }
    }
}

function leaveRoom(connection) {
    for (const [roomName, roomMembers] of rooms.entries()) {
        const index = roomMembers.findIndex((member) => member.connection === connection);

        if (index !== -1) {
            const { username } = roomMembers[index];
            roomMembers.splice(index, 1);

            // Notify other users in the room that the user has left
            const leaveMessage = {
                type: 'message',
                room: roomName,
                username: 'Server',
                message: `${username} has left the room.`,
            };

            for (const member of roomMembers) {
                member.connection.send(JSON.stringify(leaveMessage));
            }

            if (roomMembers.length === 0) {
                rooms.delete(roomName);
            }
        }
    }
}
