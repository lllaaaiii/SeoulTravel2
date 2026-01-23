import { initializeApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDqlS3XFeP25OFeTPp9fAmr_KyuyqqRBzc",
  authDomain: "wintertravel-d1743.firebaseapp.com",
  projectId: "wintertravel-d1743",
  storageBucket: "wintertravel-d1743.firebasestorage.app",
  messagingSenderId: "719562101140",
  appId: "1:719562101140:web:badcd5a089cfe6d69d7f81",
  measurementId: "G-RS2SS6H2MN"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Initialize Analytics, handling potential environments where it's not supported
let analytics;
try {
  analytics = getAnalytics(app);
} catch (e) {
  console.log("Firebase Analytics initialized");
}
export { analytics };

// Enable offline persistence
try {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('Persistence failed: Multiple tabs open');
    } else if (err.code === 'unimplemented') {
      console.warn('Persistence not supported by browser');
    }
  });
} catch (e) {
  // Ignore errors in non-browser environments or if already initialized
  console.log("Firebase initialized");
}