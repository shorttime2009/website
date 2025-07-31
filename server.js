const express = require('express');
const http = require('http');
const path = require('path');
const multer = require('multer');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// Multer config pour uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, './public/uploads'),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, unique + '-' + file.originalname);
  }
});
const upload = multer({ storage });

app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ url: '/uploads/' + req.file.filename });
});

// Users & sockets
const usersOnline = new Set();
const socketsUsers = {};
const userSocketMap = {};

// Messages stockés pour historique
const messages = [];

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('login', (username) => {
    if (!username) return;
    socketsUsers[socket.id] = username;
    userSocketMap[username] = socket.id;
    usersOnline.add(username);
    io.emit('usersOnline', Array.from(usersOnline));
    io.emit('userSocketMap', userSocketMap);
    socket.emit('history', messages);
  });

  socket.on('message', (msg) => {
    messages.push(msg);
    io.emit('message', msg);
  });

  // Appel signal
  socket.on('callUser', ({ to, signal }) => {
    if (!to) return;
    io.to(to).emit('incomingCall', { from: socketsUsers[socket.id], signal });
  });

  socket.on('answerCall', ({ to, signal }) => {
    if (!to) return;
    io.to(to).emit('callAnswered', signal);
  });

  socket.on('rejectCall', (to) => {
    if (!to) return;
    io.to(to).emit('callRejected');
  });

  socket.on('disconnectCall', (to) => {
    if (!to) return;
    io.to(to).emit('callDisconnected');
  });

  socket.on('disconnect', () => {
    const username = socketsUsers[socket.id];
    if (username) {
      usersOnline.delete(username);
      delete socketsUsers[socket.id];
      delete userSocketMap[username];
      io.emit('usersOnline', Array.from(usersOnline));
      io.emit('userSocketMap', userSocketMap);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
