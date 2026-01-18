import { Socket } from 'socket.io-client';

interface CallConfig {
  audio: boolean;
  video: boolean;
}

interface Participant {
  userId: string;
  stream?: MediaStream;
  peerConnection?: RTCPeerConnection;
}

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ]
};

export class WebRTCService {
  private localStream: MediaStream | null = null;
  private participants: Map<string, Participant> = new Map();
  private socket: Socket | null = null;
  private roomId: string | null = null;
  private userId: string | null = null;
  private isPersonalChat: boolean = false;

  constructor() {}

  setSocket(socket: Socket, userId: string) {
    this.socket = socket;
    this.userId = userId;
    this.setupSocketListeners();
  }

  private setupSocketListeners() {
    if (!this.socket) return;

    this.socket.on('call-user-joined', async (data: { userId: string; roomId: string }) => {
      console.log('User joined call:', data.userId);
      await this.createPeerConnection(data.userId, true);
    });

    this.socket.on('call-offer', async (data: { from: string; offer: RTCSessionDescriptionInit }) => {
      console.log('Received offer from:', data.from);
      await this.handleOffer(data.from, data.offer);
    });

    this.socket.on('call-answer', async (data: { from: string; answer: RTCSessionDescriptionInit }) => {
      console.log('Received answer from:', data.from);
      await this.handleAnswer(data.from, data.answer);
    });

    this.socket.on('call-ice-candidate', async (data: { from: string; candidate: RTCIceCandidateInit }) => {
      console.log('Received ICE candidate from:', data.from);
      await this.handleIceCandidate(data.from, data.candidate);
    });

    this.socket.on('call-user-left', (data: { userId: string }) => {
      console.log('User left call:', data.userId);
      this.removeParticipant(data.userId);
    });
  }

  async startCall(roomId: string, config: CallConfig = { audio: true, video: true }, isPersonalChat: boolean = false) {
    try {
      this.roomId = roomId;
      this.isPersonalChat = isPersonalChat;
      
      // Get local media stream
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: config.audio,
        video: config.video ? { width: 1280, height: 720 } : false
      });

      // Join call room
      this.socket?.emit('join-call', { roomId, userId: this.userId, isPersonalChat });

      return this.localStream;
    } catch (error) {
      console.error('Error starting call:', error);
      throw error;
    }
  }

  async createPeerConnection(userId: string, isInitiator: boolean) {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    
    // Add local tracks to peer connection
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        pc.addTrack(track, this.localStream!);
      });
    }

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket?.emit('call-ice-candidate', {
          to: userId,
          candidate: event.candidate.toJSON(),
          roomId: this.roomId
        });
      }
    };

    // Handle remote stream
    pc.ontrack = (event) => {
      console.log('Received remote track from:', userId);
      const participant = this.participants.get(userId);
      if (participant) {
        participant.stream = event.streams[0];
        this.onRemoteStream?.(userId, event.streams[0]);
      }
    };

    // Store participant
    this.participants.set(userId, { userId, peerConnection: pc });

    // Create offer if initiator
    if (isInitiator) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      this.socket?.emit('call-offer', {
        to: userId,
        offer: offer,
        roomId: this.roomId
      });
    }

    return pc;
  }

  async handleOffer(from: string, offer: RTCSessionDescriptionInit) {
    let pc = this.participants.get(from)?.peerConnection;
    
    if (!pc) {
      pc = await this.createPeerConnection(from, false);
    }

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    this.socket?.emit('call-answer', {
      to: from,
      answer: answer,
      roomId: this.roomId
    });
  }

  async handleAnswer(from: string, answer: RTCSessionDescriptionInit) {
    const pc = this.participants.get(from)?.peerConnection;
    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    }
  }

  async handleIceCandidate(from: string, candidate: RTCIceCandidateInit) {
    const pc = this.participants.get(from)?.peerConnection;
    if (pc) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }

  removeParticipant(userId: string) {
    const participant = this.participants.get(userId);
    if (participant) {
      participant.peerConnection?.close();
      participant.stream?.getTracks().forEach(track => track.stop());
      this.participants.delete(userId);
      this.onParticipantLeft?.(userId);
    }
  }

  toggleAudio(enabled: boolean) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = enabled;
      });
    }
  }

  toggleVideo(enabled: boolean) {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(track => {
        track.enabled = enabled;
      });
    }
  }

  endCall() {
    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    // Close all peer connections
    this.participants.forEach((participant) => {
      participant.peerConnection?.close();
      participant.stream?.getTracks().forEach(track => track.stop());
    });

    this.participants.clear();

    // Leave room
    if (this.roomId) {
      this.socket?.emit('leave-call', { roomId: this.roomId, userId: this.userId });
      this.roomId = null;
    }
  }

  getLocalStream() {
    return this.localStream;
  }

  getParticipants() {
    return Array.from(this.participants.values());
  }

  // Callbacks
  onRemoteStream?: (userId: string, stream: MediaStream) => void;
  onParticipantLeft?: (userId: string) => void;
}

export const webrtcService = new WebRTCService();
