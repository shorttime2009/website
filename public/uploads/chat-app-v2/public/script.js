const socket = io();
let myName = "";
let peerConnection;
const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

function login() {
  const username = document.getElementById('username').value;
  fetch('/login', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ username })
  }).then(res => {
    if (!res.ok) return alert("Mauvais identifiant");
    myName = username;
    socket.emit('join', username);
    document.getElementById('login').classList.add('hidden');
    document.getElementById('chat').classList.remove('hidden');
  });
}

function sendMessage() {
  const input = document.getElementById('input');
  socket.emit('message', input.value);
  input.value = '';
}

document.getElementById('imgInput').addEventListener('change', e => {
  const file = e.target.files[0];
  const form = new FormData();
  form.append('image', file);
  fetch('/upload', { method: 'POST', body: form })
    .then(res => res.json())
    .then(data => socket.emit('image', data.imageUrl));
});

socket.on('message', data => {
  const div = document.createElement('div');
  div.textContent = data.user + ": " + data.text;
  div.onclick = () => reactTo(data.text);
  div.dataset.message = data.text;
  document.getElementById('messages').appendChild(div);
  scrollToBottom();
  // Marquer comme vu
  socket.emit('seen', data.text);
});

socket.on('reaction', data => {
  const div = document.createElement('div');
  div.textContent = `${data.from} a réagi à "${data.to}" avec ${data.emoji}`;
  document.getElementById('messages').appendChild(div);
  scrollToBottom();
});

socket.on('image', data => {
  const div = document.createElement('div');
  div.innerHTML = data.user + ': <img src="' + data.imageUrl + '" width="200"/>';
  document.getElementById('messages').appendChild(div);
  scrollToBottom();
});

socket.on('system', msg => {
  const div = document.createElement('div');
  div.textContent = "[Système] " + msg;
  document.getElementById('messages').appendChild(div);
  scrollToBottom();
});

socket.on('onlineStatus', users => {
  const statusDiv = document.getElementById('status');
  let html = '';
  ['Galaad', 'Skull'].forEach(name => {
    const online = users[name] ? '🟢' : '🔴';
    html += `<span>${online} ${name}</span><br>`;
  });
  statusDiv.innerHTML = html;
});

socket.on('seen', data => {
  const div = document.createElement('div');
  div.textContent = `${data.user} a vu : "${data.text}" 👀`;
  document.getElementById('messages').appendChild(div);
  scrollToBottom();
});

function reactTo(text) {
  const emoji = prompt("Emoji ?");
  if (emoji) socket.emit('reaction', { from: myName, to: text, emoji });
}

document.getElementById('emojis').addEventListener('click', e => {
  if (e.target.textContent) document.getElementById('input').value += e.target.textContent;
});

function startCall() {
  peerConnection = new RTCPeerConnection(config);
  const local = document.getElementById('localVideo');
  const remote = document.getElementById('remoteVideo');

  navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
    local.srcObject = stream;
    stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));
  });

  peerConnection.ontrack = e => remote.srcObject = e.streams[0];
  peerConnection.onicecandidate = e => {
    if (e.candidate) socket.emit('signal', { candidate: e.candidate });
  };

  peerConnection.createOffer().then(offer => {
    peerConnection.setLocalDescription(offer);
    socket.emit('signal', { sdp: offer });
  });
}

socket.on('signal', async data => {
  if (!peerConnection) {
    startCall();
  }
  if (data.sdp) {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
    if (data.sdp.type === 'offer') {
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      socket.emit('signal', { sdp: answer });
    }
  }
  if (data.candidate) {
    await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
  }
});

function scrollToBottom() {
  const messages = document.getElementById('messages');
  messages.scrollTop = messages.scrollHeight;
}
