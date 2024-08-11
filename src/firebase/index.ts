import { initializeApp } from "firebase/app";
import { getAuth, inMemoryPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAdc_rgNY6kl1nxlxFybtp_-YjQizeoLjw",
  authDomain: "kamibase-832ce.firebaseapp.com",
  projectId: "kamibase-832ce",
  storageBucket: "kamibase-832ce.appspot.com",
  messagingSenderId: "433681039878",
  appId: "1:433681039878:web:5f47cc9fe0cee1fa87f987"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

auth.setPersistence(inMemoryPersistence);

export default app;