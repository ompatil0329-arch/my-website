import React from "react";
import { User, auth, onAuthStateChanged, db, handleFirestoreError, OperationType } from "./lib/firebase";
import { seedDatabaseIfNeeded } from "./lib/dbSeeder";
import { Meeting, SiteSettings, ParticipantSlot } from "./types";
import { 
  collection, doc, onSnapshot, query, orderBy, updateDoc, Firestore 
} from "firebase/firestore";
import Header from "./components/Header";
import MeetingCard from "./components/MeetingCard";
import JoinMeetingForm from "./components/JoinMeetingForm";
import MeetingRoom from "./components/MeetingRoom";
import AdminPanel from "./components/AdminPanel";
import { motion, AnimatePresence } from "motion/react";
import { Users, Video, Clock, Star, Play, CircleHelp, Shield, Mail, Laptop, Smartphone, Download, Sparkles } from "lucide-react";

export default function App() {
  const [user, setUser] = React.useState<User | null>(null);
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [showAdminView, setShowAdminView] = React.useState(false);
  
  // App views: "dashboard" | "join_form" | "meeting_room"
  const [currentView, setCurrentView] = React.useState<"dashboard" | "join_form" | "meeting_room">("dashboard");
  const [activeMeetingId, setActiveMeetingId] = React.useState<string | null>(null);

  // Firestore Data
  const [meetings, setMeetings] = React.useState<Meeting[]>([]);
  const [siteSettings, setSiteSettings] = React.useState<SiteSettings | null>(null);

  // User Verified Phone number stored in local storage
  const [userPhone, setUserPhone] = React.useState<string | null>(() => {
    return localStorage.getItem("newom_verified_phone");
  });

  // Track state loading
  const [loading, setLoading] = React.useState(true);

  // PWA & Cross-Device states
  const [deferredPrompt, setDeferredPrompt] = React.useState<any>(null);
  const [isInstallable, setIsInstallable] = React.useState(false);

  React.useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to install: ${outcome}`);
    setDeferredPrompt(null);
    setIsInstallable(false);
  };

  // Handle simulated login
  const handleSimulateLogin = (name: string, email: string) => {
    const mockUser = {
      uid: `sim_${Date.now()}`,
      email: email,
      displayName: name,
      photoURL: `https://api.dicebear.com/7.x/initials/svg?seed=${name}`,
    } as User;
    setUser(mockUser);
    localStorage.setItem("newom_simulated_user", JSON.stringify(mockUser));
  };

  // Monitor Auth Changes
  React.useEffect(() => {
    // Check if there is a simulated user in localStorage first
    const savedSimUser = localStorage.getItem("newom_simulated_user");
    if (savedSimUser) {
      const parsedUser = JSON.parse(savedSimUser) as User;
      setUser(parsedUser);
      setIsAdmin(parsedUser.email === "ompatil0329@gmail.com" || parsedUser.email === "omatil0329@gmail.com");
      setLoading(false);
    } else {
      const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        if (firebaseUser) {
          setUser(firebaseUser);
          setIsAdmin(firebaseUser.email === "ompatil0329@gmail.com" || firebaseUser.email === "omatil0329@gmail.com");
        } else {
          setUser(null);
          setIsAdmin(false);
        }
        setLoading(false);
      });
      return () => unsubscribe();
    }
  }, []);

  // Update isAdmin when user shifts
  React.useEffect(() => {
    if (user) {
      setIsAdmin(user.email === "ompatil0329@gmail.com" || user.email === "omatil0329@gmail.com");
    } else {
      setIsAdmin(false);
    }
  }, [user]);

  // Seed and Listen to Firestore
  React.useEffect(() => {
    const runSetup = async () => {
      // Seed default meetings/settings if Firestore collections are empty
      await seedDatabaseIfNeeded(db);

      // Listen to meetings query ordered by date ascending
      const meetingsQuery = query(collection(db, "meetings"));
      const unsubscribeMeetings = onSnapshot(meetingsQuery, (snapshot) => {
        const list: Meeting[] = [];
        snapshot.forEach((d) => {
          list.push(d.data() as Meeting);
        });
        
        // Sort by time ascending
        list.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
        setMeetings(list);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, "meetings");
      });

      // Listen to site settings
      const settingsDocRef = doc(db, "site_settings", "global");
      const unsubscribeSettings = onSnapshot(settingsDocRef, (snapshot) => {
        if (snapshot.exists()) {
          setSiteSettings(snapshot.data() as SiteSettings);
        }
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, "site_settings/global");
      });

      return () => {
        unsubscribeMeetings();
        unsubscribeSettings();
      };
    };

    runSetup();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("newom_simulated_user");
    setUser(null);
    setIsAdmin(false);
    setShowAdminView(false);
  };

  // Launch join meeting form
  const handleJoinMeetingTrigger = (meetingId: string) => {
    setActiveMeetingId(meetingId);
    setCurrentView("join_form");
  };

  // Launch direct meeting room entrance (if already verified & registered)
  const handleEnterMeetingRoom = (meetingId: string) => {
    setActiveMeetingId(meetingId);
    setCurrentView("meeting_room");
  };

  // Complete customer registration details
  const handleCompleteJoinAndRegisterSlot = async (
    verifiedPhone: string,
    slotData: { name: string; brandName: string; industry: string; designation: string; phoneNumber: string }
  ) => {
    if (!activeMeetingId) return;

    // Save phone to state and storage
    setUserPhone(verifiedPhone);
    localStorage.setItem("newom_verified_phone", verifiedPhone);

    const meetingDocRef = doc(db, "meetings", activeMeetingId);
    const targetMeeting = meetings.find(m => m.id === activeMeetingId);
    if (!targetMeeting) return;

    // Check which slot is empty next (1 to 20)
    let assignedSlotIndex = 1;
    const filledIndexes = Object.keys(targetMeeting.slots || {}).map(Number);
    for (let i = 1; i <= 20; i++) {
      if (!filledIndexes.includes(i)) {
        assignedSlotIndex = i;
        break;
      }
    }

    const updatedSlots = { ...targetMeeting.slots };
    updatedSlots[assignedSlotIndex] = {
      slotIndex: assignedSlotIndex,
      phoneNumber: verifiedPhone,
      name: slotData.name,
      brandName: slotData.brandName,
      industry: slotData.industry,
      designation: slotData.designation,
      isMuted: true,
      cameraOn: true,
      isJoined: false // Marked joined once they enter the Room
    };

    const slotsRemaining = Math.max(0, 20 - Object.keys(updatedSlots).length);

    try {
      await updateDoc(meetingDocRef, {
        slots: updatedSlots,
        slotsRemaining: slotsRemaining
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `meetings/${activeMeetingId}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <div className="w-12 h-12 rounded-full border-4 border-t-blue-500 border-blue-950 animate-spin mb-4"></div>
        <p className="text-sm font-semibold text-slate-400">Syncing with NEWOM Protocol...</p>
      </div>
    );
  }

  // Active meeting context
  const activeMeetingObj = meetings.find(m => m.id === activeMeetingId);

  // Check if current verified userPhone is registered inside the active meeting's slots
  const userRegisteredMeetingId = meetings.find(m => {
    if (!userPhone) return false;
    return (Object.values(m.slots || {}) as ParticipantSlot[]).some(slot => slot.phoneNumber === userPhone);
  })?.id || null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      
      {/* Header (Top Nav) */}
      {currentView !== "meeting_room" && (
        <Header
          user={user}
          isAdmin={isAdmin}
          onToggleAdminView={() => setShowAdminView(!showAdminView)}
          showAdminView={showAdminView}
          onSimulateLogin={handleSimulateLogin}
        />
      )}

      {/* Main Container */}
      <main className="flex-1">
        <AnimatePresence mode="wait">
          
          {/* View 1: MEETING ROOM */}
          {currentView === "meeting_room" && activeMeetingId && (
            <motion.div
              key="meeting_room"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <MeetingRoom
                meetingId={activeMeetingId}
                userPhone={userPhone || ""}
                isAdmin={isAdmin}
                onExit={() => {
                  setCurrentView("dashboard");
                  setActiveMeetingId(null);
                }}
              />
            </motion.div>
          )}

          {/* View 2: JOIN / REGISTRATION FORM */}
          {currentView === "join_form" && activeMeetingObj && (
            <motion.div
              key="join_form"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
            >
              <JoinMeetingForm
                meeting={activeMeetingObj}
                onBack={() => {
                  setCurrentView("dashboard");
                  setActiveMeetingId(null);
                }}
                onCompleteJoin={handleCompleteJoinAndRegisterSlot}
              />
            </motion.div>
          )}

          {/* View 3: DASHBOARD */}
          {currentView === "dashboard" && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-12 pb-16"
            >
              
              {/* Show Admin Panel overlay if checked */}
              {showAdminView ? (
                <AdminPanel
                  meetings={meetings}
                  siteSettings={siteSettings}
                  onRefreshSettings={() => {}}
                />
              ) : (
                <>
                  {/* HERO BANNER SECTION (The High Density Style) */}
                  <section className="bg-gradient-to-b from-[#1e3a8a] to-[#172e6b] text-white py-16 px-6 relative overflow-hidden shadow-inner border-b border-blue-900">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent pointer-events-none animate-pulse"></div>
                    <div className="max-w-7xl mx-auto text-center space-y-6 relative z-10">
                      
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5 }}
                        className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-950/40 border border-blue-400/30 text-xs font-bold text-blue-200"
                      >
                        <Star size={13} className="text-amber-400 fill-amber-400 animate-pulse" />
                        <span>Elite Hub: Capped at 20 Verified Leaders Per Session</span>
                      </motion.div>

                      <h1 className="text-4xl md:text-6xl font-black tracking-tighter leading-tight text-white drop-shadow-md">
                        Structured Micro-Spotlight <br />
                        <span className="text-blue-200 font-black">
                          Networking For High-Profile Operators
                        </span>
                      </h1>

                      <p className="max-w-2xl mx-auto text-sm md:text-base text-blue-100 font-medium leading-relaxed">
                        Each speaker gets exactly 2 minutes of exclusive spotlight. Microphone open-mic triggers automatically. Offline payment is verified, and booked slots are locked per user phone.
                      </p>

                      {/* Display quick summary of active registrations on this browser */}
                      {userPhone && (
                        <div className="inline-block p-2 px-5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-xs font-mono font-bold text-emerald-300 shadow-md">
                          🔑 Verified Whitelisted Number: {userPhone} (Dashboard Ready)
                        </div>
                      )}
                    </div>
                  </section>

                  {/* UPCOMING SESSIONS SCHEDULE SECTION */}
                  <section className="max-w-7xl mx-auto px-6 space-y-6 mt-12">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-4">
                      <div>
                        <span className="text-[#1e3a8a] text-xs font-bold uppercase tracking-widest font-mono">
                          Active Boardrooms
                        </span>
                        <h2 className="text-3xl font-black text-[#1e3a8a] tracking-tight mt-1">
                          Vetted Speaking Sessions
                        </h2>
                      </div>
                      <p className="text-xs text-slate-500 max-w-sm font-medium">
                        Sessions unlock for verified entry exactly 10 minutes prior to scheduled start times for mic check-in and warmups.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                      {meetings.map((meeting) => {
                        // Check if current phone is whitelisted/registered in this meeting slots
                        const phoneRegisteredInThisMeeting = (Object.values(meeting.slots || {}) as ParticipantSlot[]).some(
                          (slot) => slot.phoneNumber === userPhone
                        );

                        return (
                          <MeetingCard
                            key={meeting.id}
                            meeting={meeting}
                            onJoin={handleJoinMeetingTrigger}
                            onEnterRoom={handleEnterMeetingRoom}
                            userRegisteredPhoneNumber={userPhone}
                            hasJoinedThisMeeting={phoneRegisteredInThisMeeting}
                          />
                        );
                      })}

                      {meetings.length === 0 && (
                        <div className="col-span-full py-16 text-center border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50 text-slate-400 italic text-sm">
                          No active networking sessions scheduled. Log in as Admin to start!
                        </div>
                      )}
                    </div>
                  </section>

                  {/* ABOUT SECTION & PHOTO/VIDEO MEDIA UPLOADS SHOWCASE */}
                  <section className="max-w-7xl mx-auto px-6 pt-12 border-t border-slate-200">
                    <div className="bg-[#1e3a8a] text-white rounded-3xl p-8 md:p-12 shadow-xl grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
                      
                      {/* Left: About Text copy */}
                      <div className="lg:col-span-7 space-y-6">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-800 text-blue-200 border border-blue-700 text-xs font-bold uppercase tracking-wider">
                          <CircleHelp size={14} />
                          <span>The NEWOM Protocol</span>
                        </div>
                        
                        <h3 className="text-3xl font-black text-white tracking-tight leading-snug">
                          How Structured Micro-Slots Redefine Value
                        </h3>
                        
                        <div className="text-blue-100 text-sm leading-relaxed whitespace-pre-wrap space-y-4 font-medium">
                          {siteSettings?.aboutText || 
                            "Welcome to NEWOM, the modern elite online boardroom that completely replaces physical events. By eliminating the massive time sink, high travel expenses, and logistical friction of traditional offline seminars and local meetings, NEWOM allows you to pitch and connect with 20 curated, high-profile leaders in under an hour right from your desk.\n\n### How Online Networking Works:\n\n1. **Zero Travel, Max Impact:** Instead of spending days traveling to and from crowded offline seminars, join highly-targeted 45-minute sessions with zero downtime.\n2. **The 2-Minute Spotlight:** Every session is strictly limited to 20 vetted participants. Each speaker is automatically spotlighted for exactly 2 minutes with an open-mic priority. No dominant voices, no interruptions, and absolute focus.\n3. **Collaborative Discussion:** Once everyone has pitched, the mic restrictions lift for a dynamic 10-minute open discussion to establish key partnerships.\n\nAll verified participants undergo offline admin payment approval, keeping the caliber of attendees exceptionally high while you save hundreds of hours of physical meeting overhead."
                          }
                        </div>
                      </div>

                      {/* Right: Video & Photo Upload Placeholders / Live showcase */}
                      <div className="lg:col-span-5 space-y-6">
                        {/* 1. About Image Frame */}
                        {siteSettings?.aboutPhotoUrl ? (
                          <div className="rounded-2xl overflow-hidden border-2 border-blue-700 bg-blue-900/40 shadow-lg relative group">
                            <img 
                              src={siteSettings.aboutPhotoUrl} 
                              alt="Vetted Networking Showcase" 
                              className="w-full h-48 md:h-56 object-cover hover:scale-105 transition-transform duration-500"
                            />
                          </div>
                        ) : (
                          <div className="h-48 rounded-2xl bg-blue-800/40 border-2 border-dashed border-blue-400/30 flex flex-col items-center justify-center text-blue-300 text-xs italic">
                            <span>No Photo Asset Uploaded by Admin</span>
                          </div>
                        )}

                        {/* 2. About Video Frame */}
                        {siteSettings?.aboutVideoUrl ? (
                          <div className="rounded-2xl overflow-hidden border-2 border-blue-700 shadow-lg bg-slate-950 p-1 relative">
                            <video 
                              src={siteSettings.aboutVideoUrl} 
                              controls 
                              preload="metadata"
                              className="w-full rounded-xl object-contain h-48 md:h-56"
                            />
                          </div>
                        ) : (
                          <div className="h-48 rounded-2xl bg-blue-800/40 border-2 border-dashed border-blue-400/30 flex flex-col items-center justify-center text-blue-300 text-xs italic">
                            <span>No Video Asset Uploaded by Admin</span>
                          </div>
                        )}
                      </div>

                    </div>
                  </section>

                  {/* CROSS-DEVICE PWA SUITE */}
                  <section className="max-w-7xl mx-auto px-6 mt-12">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
                      {/* background ambient blur */}
                      <div className="absolute -top-12 -right-12 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
                      <div className="absolute -bottom-12 -left-12 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

                      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                        <div className="space-y-4 max-w-2xl">
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-950 text-blue-400 border border-blue-900 text-xs font-bold uppercase tracking-wider">
                            <Sparkles size={14} className="text-amber-400 animate-pulse" />
                            <span>100% Cross-Device Compliant</span>
                          </div>
                          
                          <h3 className="text-2xl md:text-3xl font-black text-white tracking-tight leading-snug">
                            Install NEWOM on Mobile & PC
                          </h3>
                          
                          <p className="text-slate-300 text-sm leading-relaxed font-medium">
                            Experience the hyper-disciplined micro-slot boardroom protocol as a high-performance native-like application. Avoid the distraction of standard browser tabs, and get direct real-time mic and camera integrations on both your smartphone and desktop computer.
                          </p>

                          {/* Dynamic Install Button if browser supports it */}
                          {isInstallable && (
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={handleInstallClick}
                              className="flex items-center gap-2 px-6 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-500/25 transition-all mt-4 border border-blue-400/20"
                            >
                              <Download size={16} />
                              <span>Install NEWOM App on This Device</span>
                            </motion.button>
                          )}
                        </div>

                        {/* Interactive Guideline Columns */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:w-[48%]">
                          {/* Desktop PC column */}
                          <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-5 space-y-3 shadow-inner">
                            <div className="flex items-center gap-2 text-white font-bold text-sm border-b border-slate-800 pb-2">
                              <Laptop size={16} className="text-blue-400" />
                              <span>Desktop PC (Mac / Windows)</span>
                            </div>
                            <ul className="space-y-2 text-xs text-slate-400 leading-relaxed font-medium list-disc list-inside">
                              <li>Instant launch in a borderless native boardroom window.</li>
                              <li>Supports hardware microphone and studio camera selector.</li>
                              <li>To install manually: Look for the <strong className="text-white">⊕ (Install App)</strong> icon in your browser's address bar.</li>
                            </ul>
                          </div>

                          {/* Mobile Smartphone column */}
                          <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-5 space-y-3 shadow-inner">
                            <div className="flex items-center gap-2 text-white font-bold text-sm border-b border-slate-800 pb-2">
                              <Smartphone size={16} className="text-indigo-400" />
                              <span>Mobile App (iOS / Android)</span>
                            </div>
                            <ul className="space-y-2 text-xs text-slate-400 leading-relaxed font-medium list-disc list-inside">
                              <li>Immersive full-screen status with camera auto-magnification.</li>
                              <li>Offline-caliber push timers & mic indicators.</li>
                              <li><strong className="text-white">iOS/Safari:</strong> Tap <span className="text-blue-400">Share</span> then select <strong className="text-white">Add to Home Screen</strong>.</li>
                              <li><strong className="text-white">Android/Chrome:</strong> Open menu <span className="text-slate-300">⋮</span> then tap <strong className="text-white">Install App</strong>.</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* BOTTOM FOOTER DESIGN */}
                  <footer className="bg-white border-t border-slate-200 px-6 py-6 mt-16 text-[11px] font-bold text-slate-400">
                    <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black tracking-tighter text-[#1e3a8a] uppercase">NEWOM Network</span>
                        <span className="text-slate-300">|</span>
                        <span className="text-slate-400 font-mono">Active Boardroom Framework</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span>© 2026 NEWOM. Built for the Elite 20-Slot Networking Format.</span>
                      </div>
                    </div>
                  </footer>
                </>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </main>
    </div>
  );
}
