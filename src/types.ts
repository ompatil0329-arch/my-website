export interface ParticipantSlot {
  slotIndex: number; // 1 to 20
  phoneNumber: string;
  name: string;
  brandName: string;
  industry: string;
  designation: string;
  isMuted: boolean;
  cameraOn: boolean;
  isJoined: boolean;
}

export interface Meeting {
  id: string;
  title: string;
  description: string;
  time: string; // ISO 8601 string or format "YYYY-MM-DDTHH:mm"
  durationPerSpeaker: number; // in seconds (default 120)
  openDiscussionDuration: number; // in seconds (default 600)
  status: "scheduled" | "warmup" | "live" | "completed";
  slotsRemaining: number; // max 20
  currentSpeakerSlot: number; // 0 for warmup, 1-20 for active speaker slot, 21 for open discussion, 22 for ended
  speakerTurnStartedAt: number | null; // Milliseconds timestamp
  openDiscussionStartedAt: number | null; // Milliseconds timestamp
  registeredNumbers: string[]; // List of phone numbers the admin registered offline
  slots: Record<number, ParticipantSlot>; // Keyed by slotIndex (1-20)
}

export interface SiteSettings {
  aboutText: string;
  aboutPhotoUrl: string;
  aboutVideoUrl: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  phoneNumber?: string;
  isAdmin: boolean;
}
