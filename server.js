const express = require('express');
const http = require('http');
const multer = require('multer');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const USERS = ['Galaad', 'Skull'];
let onlineUsers = {};

const storage = multer.diskStorage({
  destination: './uploads/',
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.post('/login', (req, res) => {
  const { username } = req.body;
  if (USERS.includes(username)) return res.json({ success: true });
  res.status(401).json({ success: false });
});

app.post('/upload', upload.single('image'), (req, res) => {
  res.json({ imageUrl: '/uploads/' + req.file.filename });
});

io.on('connection', socket => {
  socket.on('join', username => {
    socket.username = username;
    onlineUsers[username] = true;
    io.emit('onlineStatus', onlineUsers);
    socket.broadcast.emit('system', `${username} est connecté.`);
  });

  socket.on('message', msg => {
    io.emit('message', { user: socket.username, text: msg });
  });

  socket.on('reaction', data => {
    io.emit('reaction', data);
  });

  socket.on('image', imgUrl => {
    io.emit('image', { user: socket.username, imageUrl: imgUrl });
  });

  socket.on('seen', data => {
    io.emit('seen', { user: socket.username, text: data });
  });

  socket.on('signal', data => {
    socket.broadcast.emit('signal', data);
  });

  socket.on('disconnect', () => {
    if (socket.username) {
      delete onlineUsers[socket.username];
      io.emit('onlineStatus', onlineUsers);
      socket.broadcast.emit('system', `${socket.username} s'est déconnecté.`);
    }
  });
});

server.listen(3000, () => console.log('Serveur sur http://localhost:3000'));
