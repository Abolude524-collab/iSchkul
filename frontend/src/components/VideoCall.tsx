import React, { useEffect, useRef, useState } from 'react';
import { Video, VideoOff, Mic, MicOff, PhoneOff, Users, Maximize2 } from 'lucide-react';
import { webrtcService } from '../services/webrtc';
import { Whiteboard } from './Whiteboard';
import { Socket } from 'socket.io-client';

interface VideoCallProps {
  roomId: string;
  userId: string;
  isGroup: boolean;
  isAdmin: boolean;
  socket: Socket;
  onEnd: () => void;
  isPersonalChat?: boolean;
}

interface ParticipantVideo {
  userId: string;
  stream: MediaStream;
}

export const VideoCall: React.FC<VideoCallProps> = ({ roomId, userId, isGroup, isAdmin, socket, onEnd, isPersonalChat = false }) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<ParticipantVideo[]>([]);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [participants, setParticipants] = useState<string[]>([userId]);

  useEffect(() => {
    initializeCall();

    // Setup WebRTC callbacks
    webrtcService.onRemoteStream = (participantId: string, stream: MediaStream) => {
      console.log('Remote stream received from:', participantId);
      setRemoteStreams(prev => {
        const existing = prev.find(p => p.userId === participantId);
        if (existing) {
          return prev.map(p => p.userId === participantId ? { userId: participantId, stream } : p);
        }
        return [...prev, { userId: participantId, stream }];
      });
      setParticipants(prev => prev.includes(participantId) ? prev : [...prev, participantId]);
    };

    webrtcService.onParticipantLeft = (participantId: string) => {
      console.log('Participant left:', participantId);
      setRemoteStreams(prev => prev.filter(p => p.userId !== participantId));
      setParticipants(prev => prev.filter(id => id !== participantId));
    };

    return () => {
      webrtcService.endCall();
    };
  }, []);

  const initializeCall = async () => {
    try {
      webrtcService.setSocket(socket, userId);
      const stream = await webrtcService.startCall(roomId, { audio: true, video: true }, isPersonalChat);
      setLocalStream(stream);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Failed to initialize call:', error);
      alert('Failed to access camera/microphone. Please check permissions.');
      onEnd();
    }
  };

  const toggleAudio = () => {
    webrtcService.toggleAudio(!audioEnabled);
    setAudioEnabled(!audioEnabled);
  };

  const toggleVideo = () => {
    webrtcService.toggleVideo(!videoEnabled);
    setVideoEnabled(!videoEnabled);
  };

  const handleEndCall = () => {
    webrtcService.endCall();
    onEnd();
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 p-2 md:p-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
          <Users className="text-white flex-shrink-0" size={20} />
          <div className="min-w-0 flex-1">
            <h2 className="text-white font-semibold text-sm md:text-base">{isGroup ? 'Group Call' : 'Video Call'}</h2>
            <p className="text-gray-400 text-xs md:text-sm">{participants.length} participant{participants.length > 1 ? 's' : ''}</p>
          </div>
        </div>

        <button
          onClick={() => setShowWhiteboard(!showWhiteboard)}
          className={`px-2 md:px-4 py-1 md:py-2 rounded-lg transition-colors text-xs md:text-sm flex-shrink-0 ml-2 ${showWhiteboard ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
        >
          📝 <span className="hidden sm:inline">Whiteboard</span>
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Video Grid */}
        <div className={`${showWhiteboard ? 'w-full md:w-1/2' : 'w-full'} transition-all duration-300 overflow-y-auto`}>
          <div className="h-full p-2 md:p-4 grid gap-2 md:gap-4" style={{
            gridTemplateColumns: remoteStreams.length === 0 ? '1fr' :
              remoteStreams.length === 1 ? 'repeat(2, 1fr)' :
                remoteStreams.length <= 4 ? 'repeat(auto-fit, minmax(200px, 1fr))' :
                  'repeat(auto-fit, minmax(150px, 1fr))'
          }}>
            {/* Local Video */}
            <div className="relative bg-gray-800 rounded-lg overflow-hidden min-h-[150px] md:min-h-[200px]">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-1 left-1 md:bottom-2 md:left-2 bg-black bg-opacity-50 px-1.5 md:px-2 py-0.5 md:py-1 rounded text-white text-xs md:text-sm">
                You {isAdmin && '(Admin)'}
              </div>
              {!videoEnabled && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-700">
                  <VideoOff className="text-gray-400" size={32} />
                </div>
              )}
            </div>

            {/* Remote Videos */}
            {remoteStreams.map((participant, index) => (
              <RemoteVideo
                key={participant.userId}
                stream={participant.stream}
                userId={participant.userId}
                index={index}
              />
            ))}

            {/* Empty Slots */}
            {isGroup && remoteStreams.length === 0 && (
              <div className="col-span-full flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <Users size={48} className="mx-auto mb-2 opacity-50" />
                  <p className="text-xs md:text-sm">Waiting for others to join...</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Whiteboard Panel */}
        {showWhiteboard && (
          <div className="flex w-full md:w-1/2 border-l border-gray-700 flex-col">
            <Whiteboard
              roomId={roomId}
              userId={userId}
              isAdmin={isAdmin || isPersonalChat}
              socket={socket}
              participants={participants}
              isPersonalChat={isPersonalChat}
            />
          </div>
        )}
      </div>

      {/* Control Bar */}
      <div className="bg-gray-800 p-2 md:p-4 flex items-center justify-center gap-2 md:gap-4 flex-shrink-0">
        <button
          onClick={toggleAudio}
          className={`p-2 md:p-4 rounded-full transition-colors ${audioEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-700'
            }`}
          title={audioEnabled ? 'Mute' : 'Unmute'}
        >
          {audioEnabled ? <Mic className="text-white" size={18} /> : <MicOff className="text-white" size={18} />}
        </button>

        <button
          onClick={toggleVideo}
          className={`p-2 md:p-4 rounded-full transition-colors ${videoEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-700'
            }`}
          title={videoEnabled ? 'Stop Video' : 'Start Video'}
        >
          {videoEnabled ? <Video className="text-white" size={18} /> : <VideoOff className="text-white" size={18} />}
        </button>

        <button
          onClick={handleEndCall}
          className="p-2 md:p-4 rounded-full bg-red-600 hover:bg-red-700 transition-colors"
          title="End Call"
        >
          <PhoneOff className="text-white" size={18} />
        </button>
      </div>
    </div>
  );
};

interface RemoteVideoProps {
  stream: MediaStream;
  userId: string;
  index: number;
}

const RemoteVideo: React.FC<RemoteVideoProps> = ({ stream, userId, index }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoActive, setVideoActive] = useState(true);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }

    // Check if video track is active
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      setVideoActive(videoTrack.enabled);
      videoTrack.onended = () => setVideoActive(false);
    }
  }, [stream]);

  return (
    <div className="relative bg-gray-800 rounded-lg overflow-hidden min-h-[150px] md:min-h-[200px]">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full h-full object-cover"
      />
      <div className="absolute bottom-1 left-1 md:bottom-2 md:left-2 bg-black bg-opacity-50 px-1.5 md:px-2 py-0.5 md:py-1 rounded text-white text-xs md:text-sm">
        Participant {index + 1}
      </div>
      {!videoActive && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-700">
          <VideoOff className="text-gray-400" size={32} />
        </div>
      )}
    </div>
  );
};
