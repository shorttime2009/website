const express = require('express');
const http = require('http');
const path = require('path');
const multer = require('multer');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Multer setup for uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/uploads'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
});
const upload = multer({ storage });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Upload endpoint
app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded');
  res.json({ url: '/uploads/' + req.file.filename });
});

const usersOnline = new Set();
const socketsUsers = {};
const messages = []; // History stored here (simple memory)

io.on('connection', (socket) => {
  socket.on('login', (username) => {
    socketsUsers[socket.id] = username;
    usersOnline.add(username);
    io.emit('usersOnline', Array.from(usersOnline));

    // Send message history to this user
    socket.emit('history', messages);
  });

  socket.on('disconnect', () => {
    const username = socketsUsers[socket.id];
    if (username) {
      usersOnline.delete(username);
      delete socketsUsers[socket.id];
      io.emit('usersOnline', Array.from(usersOnline));
    }
  });

  socket.on('message', (msg) => {
    msg.id = Date.now();
    msg.seenBy = [];
    messages.push(msg);
    io.emit('message', msg);
  });

  socket.on('messageSeen', ({ messageId, username }) => {
    const msg = messages.find(m => m.id === messageId);
    if (msg && !msg.seenBy.includes(username)) {
      msg.seenBy.push(username);
      io.emit('messageSeenUpdate', { messageId, seenBy: msg.seenBy });
    }
  });

  // WebRTC signaling for calls/screenshare
  socket.on('callUser', (data) => {
    io.to(data.to).emit('incomingCall', { from: socketsUsers[socket.id], signal: data.signal });
  });

  socket.on('answerCall', (data) => {
    io.to(data.to).emit('callAnswered', data.signal);
  });

  socket.on('rejectCall', (to) => {
    io.to(to).emit('callRejected');
  });

  socket.on('disconnectCall', (to) => {
    io.to(to).emit('callDisconnected');
  });

  // Send socket.id back to client for WebRTC routing
  socket.emit('yourID', socket.id);
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
