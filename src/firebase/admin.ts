import "server-only"
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase-admin/auth";

if (admin.apps.length === 0) {
    admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_TOKEN as string)),
        databaseURL: `https://kamibase-832ce.firebaseio.com`
    });
}

export const adminFirestore = getFirestore();
export const adminStorage = getStorage();
export const adminAuth = getAuth();