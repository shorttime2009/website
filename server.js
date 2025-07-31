const express = require('express');
const http = require('http');
const path = require('path');
const multer = require('multer');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Stockage des images uploadées dans /public/uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/uploads'),
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + file.originalname;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Simple upload d’image
app.post('/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded.');
  res.json({ imageUrl: '/uploads/' + req.file.filename });
});

const usersOnline = new Set();
const socketsUsers = {}; // socket.id -> username
const messages = []; // Historique simple (optionnel)

io.on('connection', (socket) => {
  // Quand un user se connecte avec un username
  socket.on('login', (username) => {
    socketsUsers[socket.id] = username;
    usersOnline.add(username);
    io.emit('usersOnline', Array.from(usersOnline));
  });

  // Quand un user déconnecte
  socket.on('disconnect', () => {
    const username = socketsUsers[socket.id];
    if (username) {
      usersOnline.delete(username);
      delete socketsUsers[socket.id];
      io.emit('usersOnline', Array.from(usersOnline));
    }
  });

  // Nouveau message
  socket.on('message', (msg) => {
    msg.id = Date.now(); // simple id
    msg.seenBy = []; // liste de users qui ont vu le msg
    messages.push(msg);
    io.emit('message', msg);
  });

  // Message vu
  socket.on('messageSeen', ({ messageId, username }) => {
    const msg = messages.find(m => m.id === messageId);
    if (msg && !msg.seenBy.includes(username)) {
      msg.seenBy.push(username);
      io.emit('messageSeenUpdate', { messageId, seenBy: msg.seenBy });
    }
  });

  // Réaction emoji
  socket.on('reaction', ({ messageId, emoji, username }) => {
    const msg = messages.find(m => m.id === messageId);
    if (!msg) return;
    if (!msg.reactions) msg.reactions = {};
    if (!msg.reactions[emoji]) msg.reactions[emoji] = [];
    if (!msg.reactions[emoji].includes(username)) {
      msg.reactions[emoji].push(username);
      io.emit('reactionUpdate', { messageId, reactions: msg.reactions });
    }
  });
});

server.listen(PORT, () => {
  console.log(`Serveur sur http://localhost:${PORT}`);
});
