import React from "react";
import { Meeting, ParticipantSlot } from "../types";
import { doc, updateDoc, onSnapshot, getFirestore } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { 
  Video, VideoOff, Mic, MicOff, Users, Play, SkipForward, Power, 
  MessageSquare, Volume2, ShieldAlert, Award, Grid, Clock, ChevronRight, CornerDownRight
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface MeetingRoomProps {
  meetingId: string;
  userPhone: string; // The customer's registered phone
  isAdmin: boolean;
  onExit: () => void;
}

export default function MeetingRoom({
  meetingId,
  userPhone,
  isAdmin,
  onExit
}: MeetingRoomProps) {
  const [meeting, setMeeting] = React.useState<Meeting | null>(null);
  const [localCamOn, setLocalCamOn] = React.useState(true);
  const [localMicOn, setLocalMicOn] = React.useState(true);
  const [stream, setStream] = React.useState<MediaStream | null>(null);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const [nowTime, setNowTime] = React.useState(Date.now());
  const [chatMessage, setChatMessage] = React.useState("");
  const [chatLogs, setChatLogs] = React.useState<Array<{ sender: string; text: string; time: string }>>([
    { sender: "System", text: "Welcome to the structured pitch room. Microphones are managed automatically.", time: "Just now" }
  ]);

  // Sync current time for countdown calculations
  React.useEffect(() => {
    const timer = setInterval(() => {
      setNowTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Listen to Meeting document in Firestore
  React.useEffect(() => {
    const docRef = doc(db, "meetings", meetingId);
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as Meeting;
        setMeeting(data);

        // Mark the local user as "isJoined" in Firestore if they are not yet marked joined
        const userSlot = Object.values(data.slots || {}).find(s => s.phoneNumber === userPhone);
        if (userSlot && !userSlot.isJoined) {
          const updatedSlots = { ...data.slots };
          updatedSlots[userSlot.slotIndex] = {
            ...userSlot,
            isJoined: true
          };
          updateDoc(docRef, { slots: updatedSlots }).catch((err) => {
            handleFirestoreError(err, OperationType.UPDATE, `meetings/${meetingId}`);
          });
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `meetings/${meetingId}`);
    });

    return () => unsubscribe();
  }, [meetingId, userPhone]);

  // Request real camera stream if localCamOn is true
  React.useEffect(() => {
    if (localCamOn) {
      navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        .then((mediaStream) => {
          setStream(mediaStream);
          if (videoRef.current) {
            videoRef.current.srcObject = mediaStream;
          }
        })
        .catch((err) => {
          console.warn("Camera hardware access denied or not available. Using simulated high-fidelity avatar stream.", err);
          setStream(null);
        });
    } else {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [localCamOn]);

  if (!meeting) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 rounded-full border-4 border-t-blue-500 border-blue-950 animate-spin mx-auto"></div>
          <p className="text-sm font-semibold tracking-wide text-slate-400">Loading Premium Structured Space...</p>
        </div>
      </div>
    );
  }

  // Find local user's slot index
  const slotsList = Object.values(meeting.slots || {}) as ParticipantSlot[];
  const mySlot = slotsList.find(s => s.phoneNumber === userPhone);
  const mySlotIndex = mySlot?.slotIndex || -1;

  // Active status checks
  const isWarmup = meeting.status === "warmup" || meeting.status === "scheduled";
  const isLive = meeting.status === "live";
  const isOpenDiscussion = isLive && meeting.currentSpeakerSlot === 21;
  const isEnded = meeting.status === "completed" || meeting.currentSpeakerSlot === 22;

  // Who is the current speaker?
  const currentSpeakerSlotIndex = meeting.currentSpeakerSlot;
  const activeSpeaker = meeting.slots?.[currentSpeakerSlotIndex] || null;
  const isMeSpeaking = mySlotIndex === currentSpeakerSlotIndex && isLive && !isOpenDiscussion;

  // Timers calculation
  let speakerTimeLeft = 0;
  if (isLive && !isOpenDiscussion && meeting.speakerTurnStartedAt) {
    const elapsed = Math.floor((nowTime - meeting.speakerTurnStartedAt) / 1000);
    speakerTimeLeft = Math.max(0, meeting.durationPerSpeaker - elapsed);
  }

  let discussionTimeLeft = 0;
  if (isOpenDiscussion && meeting.openDiscussionStartedAt) {
    const elapsed = Math.floor((nowTime - meeting.openDiscussionStartedAt) / 1000);
    discussionTimeLeft = Math.max(0, meeting.openDiscussionDuration - elapsed);
  }

  // Auto-advance logic (handled by administrator or automatically by active speaker to keep state fluid)
  React.useEffect(() => {
    if (!isLive || isOpenDiscussion || isEnded) return;

    // If timer runs out
    if (speakerTimeLeft === 0 && meeting.speakerTurnStartedAt) {
      if (isAdmin || isMeSpeaking) {
        advanceToNextSpeaker();
      }
    }
  }, [speakerTimeLeft, isLive, isOpenDiscussion, isEnded]);

  // Handle open discussion timer exhaustion
  React.useEffect(() => {
    if (!isOpenDiscussion || isEnded) return;

    if (discussionTimeLeft === 0 && meeting.openDiscussionStartedAt) {
      if (isAdmin) {
        completeMeeting();
      }
    }
  }, [discussionTimeLeft, isOpenDiscussion, isEnded]);

  const advanceToNextSpeaker = async () => {
    const docRef = doc(db, "meetings", meetingId);
    
    // Find all occupied slots
    const filledSlots = slotsList.map(s => s.slotIndex).sort((a, b) => a - b);
    
    if (filledSlots.length === 0) {
      // No participants? Go straight to open discussion
      await updateDoc(docRef, {
        currentSpeakerSlot: 21,
        openDiscussionStartedAt: Date.now()
      });
      return;
    }

    const currentIdxInFilled = filledSlots.indexOf(meeting.currentSpeakerSlot);
    const nextIdxInFilled = currentIdxInFilled + 1;

    if (nextIdxInFilled < filledSlots.length) {
      // Next speaker turn
      const nextSlotNum = filledSlots[nextIdxInFilled];
      await updateDoc(docRef, {
        currentSpeakerSlot: nextSlotNum,
        speakerTurnStartedAt: Date.now()
      });
      
      addSystemLog(`Spotlight shifted to ${meeting.slots[nextSlotNum].name}. They have 2 minutes!`);
    } else {
      // Completed all speaker slots! Enter 10 minutes open discussion
      await updateDoc(docRef, {
        currentSpeakerSlot: 21,
        openDiscussionStartedAt: Date.now()
      });
      addSystemLog(`All pitch slots completed. Microphone open-mic discussion for 10 minutes starts now!`);
    }
  };

  const startMeetingManually = async () => {
    const docRef = doc(db, "meetings", meetingId);
    const filledSlots = slotsList.map(s => s.slotIndex).sort((a, b) => a - b);
    
    if (filledSlots.length === 0) {
      // No participants
      await updateDoc(docRef, {
        status: "live",
        currentSpeakerSlot: 21,
        openDiscussionStartedAt: Date.now()
      });
    } else {
      await updateDoc(docRef, {
        status: "live",
        currentSpeakerSlot: filledSlots[0],
        speakerTurnStartedAt: Date.now()
      });
    }
    addSystemLog("Meeting officially started by Admin!");
  };

  const completeMeeting = async () => {
    const docRef = doc(db, "meetings", meetingId);
    await updateDoc(docRef, {
      status: "completed",
      currentSpeakerSlot: 22
    });
    addSystemLog("Meeting successfully concluded.");
  };

  const addSystemLog = (text: string) => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setChatLogs(prev => [...prev, { sender: "System", text, time: timeStr }]);
  };

  const sendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const sender = mySlot ? mySlot.name : (isAdmin ? "Admin (OM)" : "Guest");
    
    setChatLogs(prev => [...prev, { sender, text: chatMessage.trim(), time: timeStr }]);
    setChatMessage("");
  };

  // Helper formatting mm:ss
  const formatSeconds = (totalSecs: number) => {
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans">
      
      {/* Top Meeting Banner */}
      <div className="bg-slate-900 border-b border-blue-950/80 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={onExit}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all font-bold text-xs"
          >
            ← Leave
          </button>
          <div>
            <span className="px-2 py-0.5 bg-blue-950 text-cyan-400 border border-blue-800 rounded text-[9px] font-bold tracking-widest uppercase">
              {meeting.status.toUpperCase()}
            </span>
            <h2 className="text-sm font-bold text-slate-100 mt-0.5">{meeting.title}</h2>
          </div>
        </div>

        {/* Dynamic global clocks */}
        <div className="flex items-center gap-4">
          {isLive && !isOpenDiscussion && (
            <div className="px-3.5 py-1.5 rounded-xl bg-blue-950/50 border border-blue-800/60 flex items-center gap-2">
              <Clock size={15} className="text-cyan-400 animate-pulse" />
              <div className="text-right">
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Spotlight Left</p>
                <p className="font-mono text-sm font-bold text-white">{formatSeconds(speakerTimeLeft)}</p>
              </div>
            </div>
          )}

          {isOpenDiscussion && (
            <div className="px-3.5 py-1.5 rounded-xl bg-emerald-950/40 border border-emerald-800 flex items-center gap-2 animate-pulse">
              <Volume2 size={16} className="text-emerald-400" />
              <div className="text-right">
                <p className="text-[10px] text-emerald-400 uppercase tracking-widest font-bold">Open Discussion</p>
                <p className="font-mono text-sm font-bold text-white">{formatSeconds(discussionTimeLeft)}</p>
              </div>
            </div>
          )}

          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 font-mono">
            <Users size={14} className="text-blue-500" />
            <span>{slotsList.filter(s => s.isJoined).length} Online</span>
          </div>
        </div>
      </div>

      {/* Main Grid View */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 overflow-hidden h-[calc(100vh-120px)]">
        
        {/* Visual Stage (Spotlight / Warmup area) */}
        <div className="lg:col-span-3 p-4 flex flex-col justify-between overflow-y-auto bg-slate-950/60 custom-scrollbar">
          
          {/* Spotlight Speaker Stage */}
          <div className="flex-1 flex flex-col items-center justify-center relative rounded-3xl border border-blue-950/50 bg-gradient-to-b from-slate-900 to-slate-950 p-6 overflow-hidden min-h-[350px]">
            
            {/* Background Grid Accent */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:32px_32px] opacity-25"></div>

            {isWarmup && (
              <div className="text-center max-w-lg z-10 space-y-6">
                <div className="w-16 h-16 rounded-3xl bg-blue-600/10 border border-blue-500/30 flex items-center justify-center mx-auto text-blue-400 shadow-xl shadow-blue-500/5">
                  <Users size={32} className="animate-pulse" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white tracking-tight">Structured Warmup Room</h3>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    Welcome to the meeting. All micro-slots are allocated based on offline payments. Please test your camera and microphone below before we begin the timed micro-pitch round.
                  </p>
                </div>

                <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-900/80 border border-slate-800 max-w-sm mx-auto">
                  <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest">Awaiting Kickoff</span>
                  <div className="text-xl font-black font-mono tracking-widest text-slate-100 mt-1">
                    {slotsList.length} / 20 Registered
                  </div>
                  {isAdmin && (
                    <button
                      onClick={startMeetingManually}
                      className="mt-4 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white text-xs font-bold tracking-wider rounded-xl shadow-lg shadow-blue-500/10 flex items-center gap-1.5"
                    >
                      <Play size={14} />
                      <span>Start Timed Rounds Now</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {isLive && !isOpenDiscussion && activeSpeaker && (
              <div className="w-full h-full flex flex-col items-center justify-between z-10">
                {/* Spotlight Header Info */}
                <div className="w-full flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 bg-blue-600 text-white font-mono font-black text-xs rounded-lg">
                      SLOT {activeSpeaker.slotIndex}
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-white">{activeSpeaker.name}</h4>
                      <p className="text-[10px] text-slate-400 font-medium">
                        {activeSpeaker.designation} at <span className="text-cyan-400 font-bold">{activeSpeaker.brandName}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-emerald-400 bg-emerald-950/50 px-2 py-1 rounded-md text-[10px] font-bold border border-emerald-800">
                      <Volume2 size={12} />
                      <span>MIC OPEN</span>
                    </span>
                  </div>
                </div>

                {/* Big Main Stage Video Feed (Active Speaker) */}
                <div className="flex-1 w-full max-w-2xl rounded-2xl border-2 border-cyan-500/80 shadow-2xl shadow-cyan-500/10 overflow-hidden bg-slate-900 relative flex items-center justify-center group">
                  {/* If the spotlight speaker is ME and local camera is on, show real web-cam stream! */}
                  {isMeSpeaking && localCamOn && stream ? (
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover scale-x-[-1]"
                    />
                  ) : activeSpeaker.isJoined ? (
                    /* Other participant joined or local user without camera - beautiful high fidelity feed simulation */
                    <div className="text-center space-y-4">
                      <div className="relative">
                        <div className="w-24 h-24 rounded-full bg-slate-800 flex items-center justify-center text-3xl font-bold border-2 border-cyan-500/40 text-cyan-300 mx-auto shadow-inner shadow-cyan-500/10">
                          {activeSpeaker.name.charAt(0)}
                        </div>
                        {/* Audio Wave pulse simulations */}
                        <span className="absolute -inset-2 rounded-full border border-cyan-500/20 animate-ping"></span>
                        <span className="absolute -inset-4 rounded-full border border-cyan-500/10 animate-pulse"></span>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-100">{activeSpeaker.name}</p>
                        <p className="text-xs text-slate-400 font-mono">Spotlight Stream Active</p>
                      </div>
                    </div>
                  ) : (
                    /* Registered but not entered room yet */
                    <div className="text-center p-6 max-w-sm space-y-3">
                      <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500 mx-auto">
                        <Volume2 size={20} className="animate-pulse" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-300">Awaiting Entry</h4>
                        <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                          Participant has slot reserved but has not walked in yet.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Spotlight watermark tag */}
                  <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-md bg-slate-950/80 backdrop-blur text-[10px] font-bold text-cyan-400 font-mono tracking-widest border border-slate-800 uppercase">
                    SPOTLIGHT FOCUS
                  </div>
                </div>

                {/* Sub title info details */}
                <div className="mt-4 flex flex-wrap gap-4 justify-center items-center text-xs text-slate-400">
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-900 rounded-lg border border-slate-800">
                    <span className="text-[10px] font-bold text-slate-500">INDUSTRY:</span>
                    <span className="text-slate-200 font-semibold">{activeSpeaker.industry}</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-900 rounded-lg border border-slate-800">
                    <span className="text-[10px] font-bold text-slate-500">PHONE:</span>
                    <span className="font-mono text-slate-300">{activeSpeaker.phoneNumber}</span>
                  </div>
                </div>
              </div>
            )}

            {isOpenDiscussion && (
              <div className="text-center max-w-lg z-10 space-y-6">
                <div className="w-16 h-16 rounded-3xl bg-emerald-600/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400 shadow-xl shadow-emerald-500/5 animate-pulse">
                  <Volume2 size={32} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white tracking-tight">Open Collaborative Discussion</h3>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    Outstanding pitches everyone! All 20 micro-slots have spoken. For the next 10 minutes, all microphones are unmuted and the floor is completely open to address questions, exchange contact info, and collaborate.
                  </p>
                </div>

                <div className="flex items-center justify-center gap-2 px-4 py-2 rounded-2xl bg-emerald-950/30 border border-emerald-900/60 text-emerald-400 text-xs font-bold max-w-xs mx-auto">
                  <Volume2 size={14} className="animate-bounce" />
                  <span>ALL MICROPHONES ARE UNMUTED</span>
                </div>
              </div>
            )}

            {isEnded && (
              <div className="text-center max-w-lg z-10 space-y-4 p-8">
                <div className="w-16 h-16 rounded-3xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto text-slate-400 shadow-xl">
                  <Power size={32} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Meeting Concluded</h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    This structured networking round has successfully completed. Thank you for your discipline and participation!
                  </p>
                </div>
                <button
                  onClick={onExit}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition-all"
                >
                  Return to Dashboard
                </button>
              </div>
            )}
          </div>

          {/* Grid list of all 20 slot participants */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Grid size={13} className="text-blue-500" />
                <span>Micro-Slot Room Layout (Capped at 20)</span>
              </h3>
              <span className="text-[10px] text-slate-500 font-mono font-bold">
                {slotsList.length} Slots Occupied
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
              {Array.from({ length: 20 }).map((_, idx) => {
                const slotNum = idx + 1;
                const slot = meeting.slots?.[slotNum] || null;
                const isCurrentSpeaker = currentSpeakerSlotIndex === slotNum && isLive && !isOpenDiscussion;

                return (
                  <div
                    key={slotNum}
                    className={`rounded-xl p-3 border transition-all flex flex-col justify-between min-h-[90px] relative overflow-hidden ${
                      isCurrentSpeaker 
                        ? 'bg-blue-950/30 border-blue-500 shadow-lg shadow-blue-500/5' 
                        : slot 
                          ? 'bg-slate-900/80 border-slate-800/80' 
                          : 'bg-slate-950/40 border-slate-900 border-dashed text-slate-600'
                    }`}
                  >
                    {/* Corner Slot Label */}
                    <div className="flex items-center justify-between">
                      <span className={`text-[9px] font-mono font-black px-1.5 py-0.5 rounded ${
                        isCurrentSpeaker 
                          ? 'bg-blue-600 text-white' 
                          : slot 
                            ? 'bg-slate-800 text-slate-300' 
                            : 'bg-slate-900/50 text-slate-600'
                      }`}>
                        SLOT {slotNum}
                      </span>

                      {/* Microphone Indicator */}
                      {slot && (
                        <span>
                          {isCurrentSpeaker || isOpenDiscussion ? (
                            <Mic size={11} className="text-emerald-400 animate-pulse" />
                          ) : (
                            <MicOff size={11} className="text-slate-500" />
                          )}
                        </span>
                      )}
                    </div>

                    {slot ? (
                      <div className="mt-2 text-left">
                        <p className="text-xs font-bold text-white truncate">{slot.name}</p>
                        <p className="text-[9px] text-slate-400 truncate mt-0.5 font-medium">{slot.brandName}</p>
                        <p className="text-[8px] text-cyan-500 font-mono truncate uppercase font-semibold">{slot.designation}</p>
                      </div>
                    ) : (
                      <div className="mt-auto text-left text-[9px] italic text-slate-600">
                        Empty Slot
                      </div>
                    )}

                    {/* Active highlight bar */}
                    {isCurrentSpeaker && (
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-cyan-400"></div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sidebar Chat & Control Log */}
        <div className="border-t lg:border-t-0 lg:border-l border-blue-950/80 bg-slate-900/40 p-4 flex flex-col justify-between h-full">
          
          {/* Admin controller box (strictly only shown to ompatil0329@gmail.com / Admin) */}
          {isAdmin && (
            <div className="mb-4 p-3 bg-amber-950/20 border border-amber-900/60 rounded-2xl">
              <h4 className="text-[11px] font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5 mb-2.5">
                <ShieldAlert size={13} />
                <span>Admin Room Master Controls</span>
              </h4>

              <div className="grid grid-cols-2 gap-2">
                {isWarmup && (
                  <button
                    onClick={startMeetingManually}
                    className="col-span-2 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] tracking-wider rounded-xl transition-all"
                  >
                    🚀 Kickoff Pitch Round
                  </button>
                )}

                {isLive && !isOpenDiscussion && (
                  <button
                    onClick={advanceToNextSpeaker}
                    className="col-span-2 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[10px] tracking-wider rounded-xl transition-all flex items-center justify-center gap-1"
                  >
                    <SkipForward size={12} />
                    <span>Skip to Next Slot</span>
                  </button>
                )}

                {isLive && (
                  <button
                    onClick={completeMeeting}
                    className="col-span-2 py-1.5 bg-red-950 hover:bg-red-900 border border-red-800 text-red-400 font-bold text-[10px] tracking-wider rounded-xl transition-all mt-1"
                  >
                    🛑 End Meeting Now
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Chat log header */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-blue-950/30">
              <MessageSquare size={14} className="text-cyan-500" />
              <h3 className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Live Space Log</h3>
            </div>

            {/* Chat list */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs custom-scrollbar">
              {chatLogs.map((log, index) => (
                <div key={index} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className={`font-bold ${log.sender === "System" ? "text-cyan-400" : "text-slate-300"}`}>
                      {log.sender}
                    </span>
                    <span className="text-[9px] text-slate-500 font-mono">{log.time}</span>
                  </div>
                  <p className={`p-2 rounded-lg leading-relaxed ${
                    log.sender === "System" 
                      ? "bg-blue-950/20 text-cyan-200/90 border border-blue-950" 
                      : "bg-slate-900/60 text-slate-300"
                  }`}>
                    {log.text}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Send Input */}
          <form onSubmit={sendChatMessage} className="mt-3 flex gap-2 pt-2 border-t border-blue-950/30">
            <input
              type="text"
              placeholder="Send a message to space..."
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              className="flex-1 px-3 py-1.5 bg-slate-950 border border-blue-950 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-white font-bold text-xs transition-colors"
            >
              Send
            </button>
          </form>

          {/* Device Controls (Camera/Mic for client) */}
          {mySlot && (
            <div className="mt-4 pt-3 border-t border-blue-950/50 flex items-center justify-between gap-2 bg-slate-950 p-2.5 rounded-2xl">
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                <span>Slot {mySlotIndex}</span>
              </div>

              <div className="flex items-center gap-2">
                {/* Camera Control */}
                <button
                  onClick={() => setLocalCamOn(!localCamOn)}
                  className={`p-2 rounded-xl transition-all ${
                    localCamOn 
                      ? "bg-slate-800 text-white hover:bg-slate-700" 
                      : "bg-red-500/15 border border-red-500/30 text-red-500 hover:bg-red-500/25"
                  }`}
                  title={localCamOn ? "Turn Camera Off" : "Turn Camera On"}
                >
                  {localCamOn ? <Video size={14} /> : <VideoOff size={14} />}
                </button>

                {/* Microphone indicator / mock toggle */}
                <button
                  disabled={!isMeSpeaking && !isOpenDiscussion}
                  onClick={() => setLocalMicOn(!localMicOn)}
                  className={`p-2 rounded-xl transition-all ${
                    !(isMeSpeaking || isOpenDiscussion)
                      ? "bg-slate-900 text-slate-600 cursor-not-allowed"
                      : localMicOn 
                        ? "bg-slate-800 text-white hover:bg-slate-700" 
                        : "bg-red-500/15 border border-red-500/30 text-red-500 hover:bg-red-500/25"
                  }`}
                  title={!(isMeSpeaking || isOpenDiscussion) ? "Microphone locked by structured sequence" : (localMicOn ? "Mute" : "Unmute")}
                >
                  {localMicOn && (isMeSpeaking || isOpenDiscussion) ? <Mic size={14} /> : <MicOff size={14} />}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
