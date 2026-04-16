import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { RoomManager } from './RoomManager.js';
import { Matchmaker } from './Matchmaker.js';

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  transports: ['websocket'],
});

const rooms = new RoomManager(io);
const matchmaker = new Matchmaker(io, rooms);

app.get('/health', (_req, res) => res.json({ ok: true, players: io.engine.clientsCount }));

io.on('connection', (socket) => {
  console.log(`[+] ${socket.id}`);

  socket.on('queue:join',  ({ name }: { name: string })              => matchmaker.join(socket, name));
  socket.on('queue:leave', ()                                         => matchmaker.leave(socket));
  socket.on('room:create', ({ name }: { name: string })              => rooms.create(socket, name));
  socket.on('room:join',   ({ code, name }: { code: string; name: string }) => rooms.join(socket, code, name));
  socket.on('room:ready',  ()                                         => rooms.setReady(socket));
  socket.on('room:start',  ()                                         => rooms.startGame(socket));
  socket.on('game:input',  (d: { dir: string })                       => rooms.relayInput(socket, d));
  socket.on('game:state',  (s: unknown)                               => rooms.relayState(socket, s));

  // WebRTC signaling — pure relay, server never inspects content
  socket.on('webrtc:offer',  ({ to, offer }:    { to: string; offer: unknown })     => io.to(to).emit('webrtc:offer',  { from: socket.id, offer }));
  socket.on('webrtc:answer', ({ to, answer }:   { to: string; answer: unknown })    => io.to(to).emit('webrtc:answer', { from: socket.id, answer }));
  socket.on('webrtc:ice',    ({ to, candidate }: { to: string; candidate: unknown }) => io.to(to).emit('webrtc:ice',   { from: socket.id, candidate }));

  socket.on('disconnect', () => {
    console.log(`[-] ${socket.id}`);
    matchmaker.leave(socket);
    rooms.leave(socket);
  });
});

const PORT = Number(process.env.PORT ?? 3001);
httpServer.listen(PORT, () => console.log(`tron-server on :${PORT}`));
