import React from "react";
import { Meeting } from "../types";
import { Calendar, Users, ArrowRight, CheckCircle2, Lock } from "lucide-react";
import { motion } from "motion/react";

interface MeetingCardProps {
  key?: string;
  meeting: Meeting;
  onJoin: (meetingId: string) => void;
  onEnterRoom: (meetingId: string) => void;
  userRegisteredPhoneNumber: string | null; // Does this device/user have a slot registered?
  hasJoinedThisMeeting: boolean; // Is their slot fully filled out?
}

export default function MeetingCard({
  meeting,
  onJoin,
  onEnterRoom,
  userRegisteredPhoneNumber,
  hasJoinedThisMeeting
}: MeetingCardProps) {
  const [timeLeftStr, setTimeLeftStr] = React.useState("");
  const [isWarmupOrLive, setIsWarmupOrLive] = React.useState(false);

  React.useEffect(() => {
    const calculateTime = () => {
      const now = new Date();
      const meetingTime = new Date(meeting.time);
      const diffMs = meetingTime.getTime() - now.getTime();
      
      const tenMinutesMs = 10 * 60 * 1000;
      
      // Warmup state is when there's less than 10 minutes left AND the meeting is scheduled,
      // or if the status is explicitly warmup or live.
      const isWarmup = diffMs <= tenMinutesMs && diffMs > -meeting.durationPerSpeaker * 20 * 1000;
      setIsWarmupOrLive(isWarmup || meeting.status === "warmup" || meeting.status === "live");

      if (meeting.status === "completed") {
        setTimeLeftStr("Completed");
        return;
      }

      if (diffMs < 0) {
        const elapsedMs = Math.abs(diffMs);
        const totalDurationMs = (meeting.durationPerSpeaker * 20 + meeting.openDiscussionDuration) * 1000;
        if (elapsedMs > totalDurationMs) {
          setTimeLeftStr("Ended");
        } else {
          setTimeLeftStr("In Progress / Live");
        }
      } else {
        const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
        const hours = Math.floor((diffMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
        const minutes = Math.floor((diffMs % (60 * 60 * 1000)) / (60 * 1000));
        
        if (days > 0) {
          setTimeLeftStr(`In ${days}d ${hours}h`);
        } else if (hours > 0) {
          setTimeLeftStr(`In ${hours}h ${minutes}m`);
        } else {
          setTimeLeftStr(`In ${minutes}m`);
        }
      }
    };

    calculateTime();
    const interval = setInterval(calculateTime, 10000);
    return () => clearInterval(interval);
  }, [meeting]);

  const meetingDate = new Date(meeting.time);
  const formattedTime = meetingDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const formattedDate = meetingDate.toLocaleDateString([], { month: 'short', day: 'numeric' });

  // Calculate slots filled (max 20)
  const filledSlotsCount = Object.keys(meeting.slots || {}).length;
  const slotsRemaining = 20 - filledSlotsCount;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="bg-white border-2 border-blue-100 rounded-2xl p-5 flex flex-col justify-between shadow-sm hover:border-blue-500 transition-colors relative overflow-hidden"
    >
      {/* Corner Status Label */}
      {meeting.status === "live" ? (
        <div className="absolute top-0 right-0 bg-red-600 text-white text-[10px] px-3 py-1 rounded-bl-xl font-bold animate-pulse uppercase">
          LIVE NOW
        </div>
      ) : isWarmupOrLive ? (
        <div className="absolute top-0 right-0 bg-amber-500 text-slate-900 text-[10px] px-3 py-1 rounded-bl-xl font-bold uppercase">
          STARTING
        </div>
      ) : meeting.status === "completed" ? (
        <div className="absolute top-0 right-0 bg-slate-500 text-white text-[10px] px-3 py-1 rounded-bl-xl font-bold uppercase">
          CONCLUDED
        </div>
      ) : (
        <div className="absolute top-0 right-0 bg-blue-600 text-white text-[10px] px-3 py-1 rounded-bl-xl font-bold uppercase">
          {timeLeftStr}
        </div>
      )}

      <div>
        {/* Date/Time Tag */}
        <p className="text-slate-500 text-[11px] font-bold uppercase tracking-wider mb-2 font-mono">
          {formattedDate} • {formattedTime}
        </p>

        {/* Title */}
        <h3 className="text-[#1e3a8a] font-bold text-lg mb-1 leading-snug">
          {meeting.title}
        </h3>

        {/* Description */}
        <p className="text-slate-500 text-xs mt-1 mb-4 line-clamp-2 leading-relaxed">
          {meeting.description}
        </p>

        {/* Dynamic Overlap Avatars representing occupied slots */}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex -space-x-1.5">
            {filledSlotsCount > 0 ? (
              Array.from({ length: Math.min(3, filledSlotsCount) }).map((_, i) => (
                <div 
                  key={i}
                  className={`w-6 h-6 rounded-full border border-white flex items-center justify-center text-[10px] font-bold text-white shadow-sm ${
                    i === 0 ? "bg-blue-300" : i === 1 ? "bg-blue-400" : "bg-blue-500"
                  }`}
                >
                  {i === 0 ? "👤" : i === 1 ? "💼" : "⭐"}
                </div>
              ))
            ) : (
              <div className="w-6 h-6 rounded-full bg-slate-100 border border-white flex items-center justify-center text-[10px]">
                💤
              </div>
            )}
            {filledSlotsCount > 3 && (
              <div className="w-6 h-6 rounded-full bg-slate-200 border border-white flex items-center justify-center text-[8px] font-black text-slate-600 shadow-sm">
                +{filledSlotsCount - 3}
              </div>
            )}
          </div>
          <span className="text-xs font-semibold text-slate-600">
            {filledSlotsCount} / 20 Slots Filled
          </span>
        </div>
      </div>

      {/* Footer / Action Buttons */}
      <div className="mt-4 pt-4 border-t border-slate-50">
        {hasJoinedThisMeeting ? (
          /* User is fully registered & checked in */
          isWarmupOrLive ? (
            <button
              onClick={() => onEnterRoom(meeting.id)}
              className="w-full py-3 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-xs rounded-xl tracking-wider uppercase transition-all shadow-md active:scale-95"
            >
              Enter Room
            </button>
          ) : (
            <div className="w-full py-3 border-2 border-emerald-500 text-emerald-600 rounded-xl font-bold text-center text-xs uppercase bg-emerald-50/50">
              Registered & Secure
            </div>
          )
        ) : slotsRemaining === 0 ? (
          /* Fully Booked */
          <button 
            disabled
            className="w-full py-3 bg-slate-200 text-slate-500 rounded-xl font-bold cursor-not-allowed uppercase text-xs"
          >
            Waitlist Only
          </button>
        ) : (
          /* Slot available, needs registration */
          <button
            onClick={() => onJoin(meeting.id)}
            className="w-full py-3 border-2 border-[#1e3a8a] text-[#1e3a8a] hover:bg-blue-50 rounded-xl font-bold uppercase text-xs tracking-wider transition-all active:scale-95"
          >
            {userRegisteredPhoneNumber ? "Complete Check-In" : "Secure Slot"}
          </button>
        )}
      </div>
    </motion.div>
  );
}
