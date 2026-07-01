import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  getDoc, 
  Firestore 
} from "firebase/firestore";
import { Meeting, SiteSettings } from "../types";
import { handleFirestoreError, OperationType } from "./firebase";

export async function seedDatabaseIfNeeded(db: Firestore) {
  try {
    // 1. Seed Site Settings if not present
    const settingsDocRef = doc(db, "site_settings", "global");
    let settingsSnap;
    try {
      settingsSnap = await getDoc(settingsDocRef);
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, "site_settings/global");
      return;
    }
    
    if (settingsSnap && !settingsSnap.exists()) {
      const defaultSettings: SiteSettings = {
        aboutText: "Welcome to NEWOM, the modern elite online boardroom that completely replaces physical events. By eliminating the massive time sink, high travel expenses, and logistical friction of traditional offline seminars and local meetings, NEWOM allows you to pitch and connect with 20 curated, high-profile leaders in under an hour right from your desk.\n\n### How Online Networking Works:\n\n1. **Zero Travel, Max Impact:** Instead of spending days traveling to and from crowded offline seminars, join highly-targeted 45-minute sessions with zero downtime.\n2. **The 2-Minute Spotlight:** Every session is strictly limited to 20 vetted participants. Each speaker is automatically spotlighted for exactly 2 minutes with an open-mic priority. No dominant voices, no interruptions, and absolute focus.\n3. **Collaborative Discussion:** Once everyone has pitched, the mic restrictions lift for a dynamic 10-minute open discussion to establish key partnerships.\n\nAll verified participants undergo offline admin payment approval, keeping the caliber of attendees exceptionally high while you save hundreds of hours of physical meeting overhead.",
        aboutPhotoUrl: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?q=80&w=2070&auto=format&fit=crop",
        aboutVideoUrl: "https://www.w3schools.com/html/mov_bbb.mp4" // A clean, lightweight public sample video that loads instantly
      };
      try {
        await setDoc(settingsDocRef, defaultSettings);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, "site_settings/global");
      }
    } else if (settingsSnap && settingsSnap.exists()) {
      const data = settingsSnap.data() as SiteSettings;
      if (!data.aboutText || !data.aboutText.includes("Zero Travel, Max Impact")) {
        // Upgrade legacy copy
        try {
          await setDoc(settingsDocRef, {
            ...data,
            aboutText: "Welcome to NEWOM, the modern elite online boardroom that completely replaces physical events. By eliminating the massive time sink, high travel expenses, and logistical friction of traditional offline seminars and local meetings, NEWOM allows you to pitch and connect with 20 curated, high-profile leaders in under an hour right from your desk.\n\n### How Online Networking Works:\n\n1. **Zero Travel, Max Impact:** Instead of spending days traveling to and from crowded offline seminars, join highly-targeted 45-minute sessions with zero downtime.\n2. **The 2-Minute Spotlight:** Every session is strictly limited to 20 vetted participants. Each speaker is automatically spotlighted for exactly 2 minutes with an open-mic priority. No dominant voices, no interruptions, and absolute focus.\n3. **Collaborative Discussion:** Once everyone has pitched, the mic restrictions lift for a dynamic 10-minute open discussion to establish key partnerships.\n\nAll verified participants undergo offline admin payment approval, keeping the caliber of attendees exceptionally high while you save hundreds of hours of physical meeting overhead."
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, "site_settings/global");
        }
      }
    }

    // 2. Seed Meetings if not present
    const meetingsColRef = collection(db, "meetings");
    let meetingsSnap;
    try {
      meetingsSnap = await getDocs(meetingsColRef);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, "meetings");
      return;
    }

    if (meetingsSnap && meetingsSnap.empty) {
      const now = new Date();
      
      // Meeting 1: In 12 minutes (ready for warmup/join right now!)
      const m1Time = new Date(now.getTime() + 12 * 60 * 1000);
      const m1String = m1Time.toISOString().substring(0, 16); // YYYY-MM-DDTHH:mm

      // Meeting 2: In 3 hours
      const m2Time = new Date(now.getTime() + 3 * 60 * 60 * 1000);
      const m2String = m2Time.toISOString().substring(0, 16);

      // Meeting 3: Tomorrow morning
      const m3Time = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      m3Time.setHours(10, 0, 0, 0);
      const m3String = m3Time.toISOString().substring(0, 16);

      // Meeting 4: Tomorrow afternoon
      const m4Time = new Date(now.getTime() + 30 * 60 * 60 * 1000);
      m4Time.setHours(16, 0, 0, 0);
      const m4String = m4Time.toISOString().substring(0, 16);

      const defaultMeetings: Meeting[] = [
        {
          id: "meeting_1",
          title: "SaaS Founders & AI Pioneers Speed Mixer",
          description: "Connect with builders scaling software products. Share your current stack, tech stack, and asks.",
          time: m1String,
          durationPerSpeaker: 120, // 2 minutes
          openDiscussionDuration: 600, // 10 minutes
          status: "scheduled",
          slotsRemaining: 19,
          currentSpeakerSlot: 0,
          speakerTurnStartedAt: null,
          openDiscussionStartedAt: null,
          registeredNumbers: ["+11234567890", "+919876543210", "+919999999999"], // Admin-seeded pre-approved phone numbers
          slots: {
            1: {
              slotIndex: 1,
              phoneNumber: "+11234567890",
              name: "Sarah Jenkins",
              brandName: "FlowState AI",
              industry: "Artificial Intelligence",
              designation: "CEO & Founder",
              isMuted: true,
              cameraOn: true,
              isJoined: false
            }
          }
        },
        {
          id: "meeting_2",
          title: "Angel & VC Investment Pitch Session",
          description: "Pitch your venture to verified active capital allocators. Strictly capped at 20 startup pitches.",
          time: m2String,
          durationPerSpeaker: 120,
          openDiscussionDuration: 600,
          status: "scheduled",
          slotsRemaining: 20,
          currentSpeakerSlot: 0,
          speakerTurnStartedAt: null,
          openDiscussionStartedAt: null,
          registeredNumbers: ["+15550199222"],
          slots: {}
        },
        {
          id: "meeting_3",
          title: "E-Commerce Brands & Growth Marketers Summit",
          description: "A hyper-focused round-table sharing customer acquisition strategies and retention hacks.",
          time: m3String,
          durationPerSpeaker: 120,
          openDiscussionDuration: 600,
          status: "scheduled",
          slotsRemaining: 20,
          currentSpeakerSlot: 0,
          speakerTurnStartedAt: null,
          openDiscussionStartedAt: null,
          registeredNumbers: [],
          slots: {}
        },
        {
          id: "meeting_4",
          title: "Elite Web3 Builders & Protocol Operators Sync",
          description: "Structured pitches on cross-chain infrastructure, decentralized governance, and tokenomics.",
          time: m4String,
          durationPerSpeaker: 120,
          openDiscussionDuration: 600,
          status: "scheduled",
          slotsRemaining: 20,
          currentSpeakerSlot: 0,
          speakerTurnStartedAt: null,
          openDiscussionStartedAt: null,
          registeredNumbers: [],
          slots: {}
        }
      ];

      for (const m of defaultMeetings) {
        try {
          await setDoc(doc(db, "meetings", m.id), m);
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `meetings/${m.id}`);
        }
      }
    }
  } catch (error) {
    console.error("Error seeding database:", error);
    throw error;
  }
}
