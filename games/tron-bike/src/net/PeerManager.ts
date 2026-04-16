import type { SocketClient } from './SocketClient';

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

type DataHandler = (data: unknown) => void;

export class PeerManager {
  private peers: Map<string, RTCPeerConnection> = new Map();
  private channels: Map<string, RTCDataChannel> = new Map();
  private handlers: DataHandler[] = [];
  private socket: SocketClient;

  constructor(socket: SocketClient) {
    this.socket = socket;
    socket.on(e => {
      if (e.type === 'webrtc_offer')  this.handleOffer(e.from, e.offer);
      if (e.type === 'webrtc_answer') this.handleAnswer(e.from, e.answer);
      if (e.type === 'webrtc_ice')    this.handleIce(e.from, e.candidate);
    });
  }

  // Called by host to initiate P2P with each peer
  async offer(peerId: string) {
    const pc = this.createPeer(peerId);
    const dc = pc.createDataChannel('game', { ordered: false, maxRetransmits: 0 });
    this.wireChannel(peerId, dc);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    this.socket.sendOffer(peerId, offer);
  }

  private async handleOffer(from: string, offer: RTCSessionDescriptionInit) {
    const pc = this.createPeer(from);
    pc.ondatachannel = ({ channel }) => this.wireChannel(from, channel);
    await pc.setRemoteDescription(offer);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    this.socket.sendAnswer(from, answer);
  }

  private async handleAnswer(from: string, answer: RTCSessionDescriptionInit) {
    const pc = this.peers.get(from);
    if (pc) await pc.setRemoteDescription(answer);
  }

  private async handleIce(from: string, candidate: RTCIceCandidateInit) {
    const pc = this.peers.get(from);
    if (pc) await pc.addIceCandidate(candidate).catch(() => {});
  }

  private createPeer(id: string): RTCPeerConnection {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) this.socket.sendIce(id, candidate);
    };
    this.peers.set(id, pc);
    return pc;
  }

  private wireChannel(id: string, dc: RTCDataChannel) {
    this.channels.set(id, dc);
    dc.onmessage = ({ data }) => {
      try {
        const parsed = JSON.parse(data);
        for (const h of this.handlers) h(parsed);
      } catch {}
    };
  }

  onData(fn: DataHandler) { this.handlers.push(fn); }

  send(data: unknown) {
    const str = JSON.stringify(data);
    for (const dc of this.channels.values()) {
      if (dc.readyState === 'open') dc.send(str);
    }
  }

  sendTo(peerId: string, data: unknown) {
    const dc = this.channels.get(peerId);
    if (dc?.readyState === 'open') dc.send(JSON.stringify(data));
  }

  isConnected(peerId: string): boolean {
    return this.channels.get(peerId)?.readyState === 'open';
  }

  anyConnected(): boolean {
    for (const dc of this.channels.values()) {
      if (dc.readyState === 'open') return true;
    }
    return false;
  }

  destroy() {
    for (const pc of this.peers.values()) pc.close();
    this.peers.clear();
    this.channels.clear();
    this.handlers = [];
  }
}
