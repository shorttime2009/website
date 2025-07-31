const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

const allowedUsers = ['Galaad', 'Skull'];
const userSocketMap = {};
let messages = [];

app.use(express.static('public'));

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Login event
  socket.on('login', (username, cb) => {
    if (!allowedUsers.includes(username)) {
      cb({ success: false, message: 'Invalid username' });
      return;
    }
    userSocketMap[username] = socket.id;
    socket.username = username;
    cb({ success: true, message: 'Logged in' });

    // Send chat history
    socket.emit('history', messages);

    // Notify others
    io.emit('users', Object.keys(userSocketMap));
  });

  // Disconnect
  socket.on('disconnect', () => {
    if (socket.username) {
      delete userSocketMap[socket.username];
      io.emit('users', Object.keys(userSocketMap));
    }
  });

  // Chat message
  socket.on('message', (msg) => {
    messages.push(msg);
    io.emit('message', msg);
  });

  // Call signaling
  socket.on('callUser', ({ to, signal }) => {
    const toSocket = userSocketMap[to];
    if (toSocket) {
      io.to(toSocket).emit('incomingCall', { from: socket.username, signal });
    }
  });

  socket.on('answerCall', ({ to, signal }) => {
    const toSocket = userSocketMap[to];
    if (toSocket) {
      io.to(toSocket).emit('callAnswered', signal);
    }
  });

  socket.on('rejectCall', ({ to }) => {
    const toSocket = userSocketMap[to];
    if (toSocket) {
      io.to(toSocket).emit('callRejected');
    }
  });

  socket.on('disconnectCall', ({ to }) => {
    const toSocket = userSocketMap[to];
    if (toSocket) {
      io.to(toSocket).emit('callDisconnected');
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
