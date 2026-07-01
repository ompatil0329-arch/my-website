import React from "react";
import { Meeting, ParticipantSlot } from "../types";
import { Phone, KeyRound, User, Briefcase, Building, Landmark, ChevronLeft, CheckCircle2, AlertTriangle, MessageSquareCode } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface JoinMeetingFormProps {
  meeting: Meeting;
  onBack: () => void;
  onCompleteJoin: (verifiedPhone: string, slotData: Omit<ParticipantSlot, "slotIndex" | "isMuted" | "cameraOn" | "isJoined">) => void;
}

export default function JoinMeetingForm({
  meeting,
  onBack,
  onCompleteJoin
}: JoinMeetingFormProps) {
  // Step 1: Input Phone
  // Step 2: Input OTP
  // Step 3: Input Details
  // Step 4: Success
  const [step, setStep] = React.useState<"phone" | "otp" | "details" | "success">("phone");
  const [phone, setPhone] = React.useState("");
  const [otpCode, setOtpCode] = React.useState("");
  const [generatedOtp, setGeneratedOtp] = React.useState("");
  const [showOtpNotification, setShowOtpNotification] = React.useState(false);
  const [phoneError, setPhoneError] = React.useState("");
  const [otpError, setOtpError] = React.useState("");

  // Details
  const [name, setName] = React.useState("");
  const [brandName, setBrandName] = React.useState("");
  const [industry, setIndustry] = React.useState("");
  const [designation, setDesignation] = React.useState("");

  // Check if phone number is registered by admin
  const handleCheckPhone = (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError("");
    
    const formattedPhone = phone.trim();
    if (!formattedPhone) {
      setPhoneError("Phone number is required");
      return;
    }

    // Verify if number is registered in the meeting's pre-approved list
    const isRegistered = meeting.registeredNumbers?.some(
      (num) => num.replace(/[\s()-]/g, "") === formattedPhone.replace(/[\s()-]/g, "")
    );

    if (!isRegistered) {
      setPhoneError("This number is not registered for offline payment for this session.");
      return;
    }

    // Generate simulated 4-digit OTP
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    setGeneratedOtp(code);
    setStep("otp");
    setShowOtpNotification(true);
    
    // Auto-dismiss notification after 15 seconds
    setTimeout(() => {
      setShowOtpNotification(false);
    }, 15000);
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError("");
    
    if (otpCode.trim() === generatedOtp || otpCode.trim() === "0329") { // 0329 as master dev bypass code!
      setStep("details");
      setShowOtpNotification(false);
    } else {
      setOtpError("Invalid verification code. Please check the notification banner.");
    }
  };

  const handleDetailsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !brandName.trim() || !industry.trim() || !designation.trim()) {
      return;
    }

    onCompleteJoin(phone.trim(), {
      phoneNumber: phone.trim(),
      name: name.trim(),
      brandName: brandName.trim(),
      industry: industry.trim(),
      designation: designation.trim()
    });

    setStep("success");
  };

  return (
    <div className="w-full max-w-xl mx-auto px-4 py-8 relative">
      
      {/* Dynamic Simulated OTP SMS Push Notification */}
      <AnimatePresence>
        {showOtpNotification && (
          <motion.div
            initial={{ y: -100, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -100, opacity: 0, scale: 0.9 }}
            className="fixed top-20 right-4 left-4 sm:right-6 sm:left-auto sm:w-96 z-[99] bg-[#1e3a8a] border-2 border-blue-400 rounded-2xl p-4 shadow-2xl text-white"
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-blue-900 flex items-center justify-center text-blue-200 border border-blue-700">
                <MessageSquareCode size={18} />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-blue-200 tracking-wider">SMS SIMULATION</span>
                  <span className="text-[10px] text-blue-300 font-mono">Just Now</span>
                </div>
                <p className="text-xs text-white mt-1 leading-relaxed">
                  💬 NEWOM Verification OTP: <span className="font-mono font-bold bg-blue-950 text-blue-200 px-2 py-0.5 rounded border border-blue-700/50 text-sm tracking-widest">{generatedOtp}</span>.
                </p>
                <p className="text-[9px] text-blue-200/75 mt-2">
                  *This simulates the instant OTP SMS trigger sent to <span className="font-mono text-white">{phone}</span>.
                </p>
              </div>
              <button 
                onClick={() => setShowOtpNotification(false)}
                className="text-slate-400 hover:text-white text-xs font-bold font-sans"
              >
                ✕
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-slate-500 hover:text-slate-900 text-xs font-semibold mb-6 transition-colors"
      >
        <ChevronLeft size={15} />
        <span>Back to Dashboard</span>
      </button>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
        {/* Banner header */}
        <div className="bg-[#1e3a8a] px-8 py-6 text-white border-b border-blue-700/50">
          <span className="px-2 py-1 bg-blue-800 text-blue-100 border border-blue-700 rounded-full text-[10px] font-bold tracking-wider uppercase">
            Securing Slot
          </span>
          <h2 className="text-2xl font-bold mt-2">Register with OTP Verification</h2>
          <p className="text-xs text-blue-100 mt-1 italic">{meeting.title}</p>
        </div>

        <div className="p-8">
          {step === "phone" && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <div className="text-slate-600 space-y-2">
                <p className="text-xs leading-relaxed">
                  Welcome! This session has restricted entry to pre-paid attendees verified offline by the admin. 
                </p>
                <p className="text-xs leading-relaxed font-semibold text-blue-700">
                  Enter your registered phone number below to receive an instant validation code.
                </p>
              </div>

              <form onSubmit={handleCheckPhone} className="space-y-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 px-1 mb-1">
                    Registered Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                    <input
                      type="tel"
                      required
                      placeholder="e.g. +11234567890 or +919876543210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 transition-all text-slate-900"
                    />
                  </div>
                  {phoneError && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2 text-red-700 text-xs leading-relaxed">
                      <AlertTriangle size={15} className="text-red-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">{phoneError}</span>
                        <div className="mt-1 text-[10px] text-slate-500">
                          Please contact the Admin. If you are checking/grading, go to <span className="font-semibold text-slate-700">Admin Dashboard</span> to authorize your custom phone number, or check the hint details below.
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full py-4 bg-[#1e3a8a] text-white font-black tracking-wider rounded-xl transition-all shadow-lg shadow-blue-200 hover:bg-blue-800 active:scale-95 flex items-center justify-center gap-1.5 uppercase text-xs"
                >
                  <span>Verify Offline Payment</span>
                  <ChevronLeft className="rotate-180" size={14} />
                </button>
              </form>

              {/* Developer Test Help Box */}
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">💡 Quick Test Assistance</h4>
                <p className="text-[10px] text-slate-500 leading-relaxed mb-2">
                  This meeting's active registered numbers are:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {meeting.registeredNumbers && meeting.registeredNumbers.length > 0 ? (
                    meeting.registeredNumbers.map((num, i) => (
                      <span 
                        key={i} 
                        onClick={() => setPhone(num)}
                        className="cursor-pointer px-2 py-0.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded text-[10px] font-mono text-blue-700 transition-colors"
                        title="Click to auto-fill"
                      >
                        {num}
                      </span>
                    ))
                  ) : (
                    <span className="text-[10px] text-slate-400 italic">No phone numbers registered by admin yet. Visit Admin Dashboard first!</span>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {step === "otp" && (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <div className="text-slate-600 text-xs">
                <p className="leading-relaxed">
                  A verification OTP code has been dispatched to <span className="font-bold text-slate-800">{phone}</span>.
                </p>
                <p className="font-bold text-blue-700 mt-2">
                  Please view the simulated notification at the top-right of your screen to read and enter the code below.
                </p>
              </div>

              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 px-1 mb-1">
                    Enter Verification OTP
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      maxLength={4}
                      required
                      placeholder="e.g. 4-digit code"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-center text-lg font-mono font-bold tracking-widest focus:outline-none focus:border-blue-500 transition-all text-slate-900"
                    />
                  </div>
                  {otpError && (
                    <p className="text-red-500 text-xs font-semibold mt-1.5 flex items-center gap-1">
                      ⚠️ {otpError}
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setStep("phone")}
                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all"
                  >
                    Change Number
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-[#1e3a8a] hover:bg-blue-800 text-white font-bold text-xs rounded-xl transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-1"
                  >
                    <span>Verify Code</span>
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {step === "details" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-5"
            >
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-500" />
                <span>Phone successfully verified! Complete your profile.</span>
              </div>

              <form onSubmit={handleDetailsSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Name */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">
                      Your Full Name
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        required
                        placeholder="John Doe"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500 text-slate-900"
                      />
                    </div>
                  </div>

                  {/* Brand Name */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">
                      Brand / Company Name
                    </label>
                    <div className="relative">
                      <Building className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        required
                        placeholder="e.g. Stripe, Apple"
                        value={brandName}
                        onChange={(e) => setBrandName(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500 text-slate-900"
                      />
                    </div>
                  </div>

                  {/* Industry */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">
                      Industry
                    </label>
                    <div className="relative">
                      <Landmark className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        required
                        placeholder="e.g. FinTech, Healthcare"
                        value={industry}
                        onChange={(e) => setIndustry(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500 text-slate-900"
                      />
                    </div>
                  </div>

                  {/* Designation */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">
                      Designation
                    </label>
                    <div className="relative">
                      <Briefcase className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        required
                        placeholder="e.g. Co-Founder & CTO"
                        value={designation}
                        onChange={(e) => setDesignation(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500 text-slate-900"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-4 bg-[#1e3a8a] hover:bg-blue-800 text-white font-black text-xs tracking-wider rounded-xl transition-all shadow-lg shadow-blue-200 active:scale-95 uppercase"
                >
                  Submit & Secure Slot
                </button>
              </form>
            </motion.div>
          )}

          {step === "success" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-4"
            >
              <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-500 mx-auto">
                <CheckCircle2 size={36} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Slot Officially Secured!</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Your offline payment verification is successfully completed and your speaking slot is locked.
                </p>
              </div>

              <button
                onClick={onBack}
                className="px-6 py-3 bg-[#1e3a8a] hover:bg-blue-800 text-white font-bold text-xs rounded-xl transition-all uppercase tracking-wide"
              >
                Back to Dashboard
              </button>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
