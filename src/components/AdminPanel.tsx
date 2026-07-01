import React from "react";
import { Meeting, SiteSettings } from "../types";
import { 
  collection, doc, setDoc, updateDoc, deleteDoc, getDocs, arrayUnion, arrayRemove, Firestore 
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { 
  PlusCircle, Trash2, Calendar, Phone, Upload, Check, Settings, Save, LayoutGrid, FileVideo, FileImage, FileText
} from "lucide-react";
import { motion } from "motion/react";

interface AdminPanelProps {
  meetings: Meeting[];
  siteSettings: SiteSettings | null;
  onRefreshSettings: () => void;
}

export default function AdminPanel({
  meetings,
  siteSettings,
  onRefreshSettings
}: AdminPanelProps) {
  // 1. Schedule Meeting States
  const [newTitle, setNewTitle] = React.useState("");
  const [newDesc, setNewDesc] = React.useState("");
  const [newTime, setNewTime] = React.useState("");
  const [durationPerSpeaker, setDurationPerSpeaker] = React.useState(120);
  const [openDiscussionDuration, setOpenDiscussionDuration] = React.useState(600);

  // 2. Offline Payment states
  const [selectedMeetingId, setSelectedMeetingId] = React.useState("");
  const [phoneToRegister, setPhoneToRegister] = React.useState("");

  // 3. Site Settings states
  const [aboutText, setAboutText] = React.useState("");
  const [aboutPhotoUrl, setAboutPhotoUrl] = React.useState("");
  const [aboutVideoUrl, setAboutVideoUrl] = React.useState("");

  const [notification, setNotification] = React.useState("");

  // Initialize Site Settings fields when available
  React.useEffect(() => {
    if (siteSettings) {
      setAboutText(siteSettings.aboutText || "");
      setAboutPhotoUrl(siteSettings.aboutPhotoUrl || "");
      setAboutVideoUrl(siteSettings.aboutVideoUrl || "");
    }
  }, [siteSettings]);

  // Set default selected meeting
  React.useEffect(() => {
    if (meetings.length > 0 && !selectedMeetingId) {
      setSelectedMeetingId(meetings[0].id);
    }
  }, [meetings, selectedMeetingId]);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(""), 4000);
  };

  // Schedule a new meeting
  const handleScheduleMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newTime) return;

    const newMeetingId = `meeting_${Date.now()}`;
    const newMeeting: Meeting = {
      id: newMeetingId,
      title: newTitle.trim(),
      description: newDesc.trim() || "Structured live networking sequence session.",
      time: newTime,
      durationPerSpeaker: Number(durationPerSpeaker) || 120,
      openDiscussionDuration: Number(openDiscussionDuration) || 600,
      status: "scheduled",
      slotsRemaining: 20,
      currentSpeakerSlot: 0,
      speakerTurnStartedAt: null,
      openDiscussionStartedAt: null,
      registeredNumbers: [],
      slots: {}
    };

    try {
      await setDoc(doc(db, "meetings", newMeetingId), newMeeting);
      showToast("🎉 New meeting scheduled successfully!");
      setNewTitle("");
      setNewDesc("");
      setNewTime("");
    } catch (err) {
      console.error("Error scheduling meeting:", err);
      showToast("❌ Error scheduling meeting.");
      handleFirestoreError(err, OperationType.CREATE, `meetings/${newMeetingId}`);
    }
  };

  // Delete a meeting
  const handleDeleteMeeting = async (meetingId: string) => {
    if (window.confirm("Are you sure you want to delete this meeting slot? All registered participants will be removed.")) {
      try {
        await deleteDoc(doc(db, "meetings", meetingId));
        showToast("🗑️ Meeting removed successfully!");
      } catch (err) {
        console.error("Error deleting meeting:", err);
        handleFirestoreError(err, OperationType.DELETE, `meetings/${meetingId}`);
      }
    }
  };

  // Register a Phone Number Offline (offline payment verification)
  const handleRegisterPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    const formattedPhone = phoneToRegister.trim();
    if (!selectedMeetingId || !formattedPhone) return;

    try {
      const meetingRef = doc(db, "meetings", selectedMeetingId);
      await updateDoc(meetingRef, {
        registeredNumbers: arrayUnion(formattedPhone)
      });

      showToast(`✅ Phone ${formattedPhone} registered for session!`);
      setPhoneToRegister("");
    } catch (err) {
      console.error("Error registering phone:", err);
      showToast("❌ Error registering phone.");
      handleFirestoreError(err, OperationType.UPDATE, `meetings/${selectedMeetingId}`);
    }
  };

  // Unregister phone number
  const handleUnregisterPhone = async (meetingId: string, phone: string) => {
    try {
      const meetingRef = doc(db, "meetings", meetingId);
      await updateDoc(meetingRef, {
        registeredNumbers: arrayRemove(phone)
      });
      showToast(`Removed registration for ${phone}`);
    } catch (err) {
      console.error("Error removing phone:", err);
      handleFirestoreError(err, OperationType.UPDATE, `meetings/${meetingId}`);
    }
  };

  // Save Media & Site Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const settingsRef = doc(db, "site_settings", "global");
      await setDoc(settingsRef, {
        aboutText: aboutText.trim(),
        aboutPhotoUrl: aboutPhotoUrl.trim(),
        aboutVideoUrl: aboutVideoUrl.trim()
      });
      
      onRefreshSettings();
      showToast("💾 Site settings and media successfully updated!");
    } catch (err) {
      console.error("Error saving site settings:", err);
      showToast("❌ Error updating site settings.");
      handleFirestoreError(err, OperationType.WRITE, "site_settings/global");
    }
  };

  const activeMeetingForManage = meetings.find(m => m.id === selectedMeetingId);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-8 space-y-10">
      
      {/* Toast Alert */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-[100] px-4 py-3 bg-slate-900 border border-blue-500 rounded-xl shadow-2xl text-white text-xs font-semibold flex items-center gap-2 animate-bounce">
          <Check size={14} className="text-emerald-400 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Header Summary */}
      <div className="bg-slate-900 text-white rounded-3xl p-8 border border-blue-950 shadow-xl relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-950/20 to-slate-950/40 pointer-events-none"></div>
        <div className="relative z-10">
          <span className="px-2.5 py-1 bg-amber-500 text-slate-950 rounded-full text-[10px] font-black uppercase tracking-wider">
            ADMIN CENTRAL
          </span>
          <h2 className="text-2xl font-black mt-2 tracking-tight">Vetted Operations & Scheduling Hub</h2>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl">
            Authorize offline payments, manage structural video slot timers, edit marketing text copy, and customize photo/video assets of the About NEWOM section.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Column 1: Offline Payments / Register Phone */}
        <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-md flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-50">
              <Phone className="text-blue-600" size={18} />
              <h3 className="font-bold text-slate-900">Authorize Offline Payments</h3>
            </div>
            
            <p className="text-xs text-slate-500 leading-relaxed mb-4">
              When a customer completes a payment offline, enter their phone number and assign it to their desired meeting. This whitelist allows them to verify their slot instantly.
            </p>

            <form onSubmit={handleRegisterPhone} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-700 mb-1 uppercase">Choose Session</label>
                <select
                  value={selectedMeetingId}
                  onChange={(e) => setSelectedMeetingId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {meetings.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title} ({new Date(m.time).toLocaleDateString([], { month: 'short', day: 'numeric' })})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-700 mb-1 uppercase">Customer Phone Number</label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. +919999999999 or +11234567890"
                  value={phoneToRegister}
                  onChange={(e) => setPhoneToRegister(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow transition-colors"
              >
                Whitelist Number
              </button>
            </form>
          </div>

          {/* Registered list review */}
          <div className="mt-6 pt-5 border-t border-slate-100 flex-1">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Registered list for selected session</h4>
            <div className="space-y-1.5 max-h-[160px] overflow-y-auto custom-scrollbar">
              {activeMeetingForManage?.registeredNumbers && activeMeetingForManage.registeredNumbers.length > 0 ? (
                activeMeetingForManage.registeredNumbers.map((p, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg text-xs font-mono">
                    <span className="text-slate-700 font-semibold">{p}</span>
                    <button
                      onClick={() => handleUnregisterPhone(selectedMeetingId, p)}
                      className="text-[10px] text-red-500 hover:text-red-700 font-bold"
                    >
                      Remove
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-[10px] text-slate-400 italic">No numbers registered yet.</p>
              )}
            </div>
          </div>
        </div>

        {/* Column 2: Schedule New Meetings */}
        <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-md">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-50">
            <Calendar className="text-blue-600" size={18} />
            <h3 className="font-bold text-slate-900">Schedule Structured Session</h3>
          </div>

          <form onSubmit={handleScheduleMeeting} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-700 mb-1 uppercase">Meeting Title</label>
              <input
                type="text"
                required
                placeholder="e.g. Web3 Elite Founders Mixer"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-700 mb-1 uppercase">Meeting Subtitle/Description</label>
              <textarea
                placeholder="Short outline of slot target..."
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 h-16 resize-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-700 mb-1 uppercase">Scheduled Date & Time</label>
              <input
                type="datetime-local"
                required
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[9px] font-bold text-slate-700 mb-1 uppercase">Speaker spotlight (s)</label>
                <input
                  type="number"
                  required
                  value={durationPerSpeaker}
                  onChange={(e) => setDurationPerSpeaker(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-slate-700 mb-1 uppercase">Open talk time (s)</label>
                <input
                  type="number"
                  required
                  value={openDiscussionDuration}
                  onChange={(e) => setOpenDiscussionDuration(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-gradient-to-r from-blue-700 to-blue-600 hover:from-blue-600 hover:to-blue-500 text-white font-bold text-xs rounded-xl shadow transition-colors"
            >
              Publish Scheduled Session
            </button>
          </form>
        </div>

        {/* Column 3: Edit Site Copy / Photos / Videos */}
        <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-md">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-50">
            <Settings className="text-blue-600" size={18} />
            <h3 className="font-bold text-slate-900">Customize About Section Copy</h3>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-700 mb-1 uppercase flex items-center gap-1">
                <FileText size={12} className="text-slate-400" />
                <span>About Text Narrative</span>
              </label>
              <textarea
                value={aboutText}
                onChange={(e) => setAboutText(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 h-24 resize-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-700 mb-1 uppercase flex items-center gap-1">
                <FileImage size={12} className="text-slate-400" />
                <span>About Section Photo URL</span>
              </label>
              <input
                type="text"
                placeholder="https://images.unsplash.com..."
                value={aboutPhotoUrl}
                onChange={(e) => setAboutPhotoUrl(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-700 mb-1 uppercase flex items-center gap-1">
                <FileVideo size={12} className="text-slate-400" />
                <span>About Section Video URL</span>
              </label>
              <input
                type="text"
                placeholder="Direct video file URL (.mp4)"
                value={aboutVideoUrl}
                onChange={(e) => setAboutVideoUrl(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-gradient-to-r from-blue-700 to-blue-600 hover:from-blue-600 hover:to-blue-500 text-white font-bold text-xs rounded-xl shadow transition-colors flex items-center justify-center gap-1.5"
            >
              <Save size={14} />
              <span>Save Text & Media Copy</span>
            </button>
          </form>
        </div>
      </div>

      {/* Delete / Reset Sessions List */}
      <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-md">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-50">
          <LayoutGrid className="text-blue-600" size={18} />
          <h3 className="font-bold text-slate-900">Manage Published Sessions</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-500">
            <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Session Title</th>
                <th className="px-4 py-3">Scheduled Time</th>
                <th className="px-4 py-3">Pitches Duration</th>
                <th className="px-4 py-3">Whitelisted Numbers</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {meetings.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-bold text-slate-800">{m.title}</td>
                  <td className="px-4 py-3 font-mono">{m.time}</td>
                  <td className="px-4 py-3 font-medium text-slate-600">{m.durationPerSpeaker}s spotlight / {m.openDiscussionDuration}s open</td>
                  <td className="px-4 py-3 font-mono font-semibold text-blue-600">{m.registeredNumbers?.length || 0} whitelisted</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDeleteMeeting(m.id)}
                      className="text-red-500 hover:text-red-700 font-bold flex items-center gap-1"
                    >
                      <Trash2 size={13} />
                      <span>Delete</span>
                    </button>
                  </td>
                </tr>
              ))}
              {meetings.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-6 text-slate-400 italic">No meetings scheduled.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
