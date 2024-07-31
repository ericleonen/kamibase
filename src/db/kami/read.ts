import { collection, doc, documentId, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "@/firebase";
import { Kami, ReadOnlyKami } from "./schemas";
import { User } from "../user/schemas";
import { getKamiImage } from "@/storage/kami/read";

export async function getPublicKamis(): Promise<ReadOnlyKami[]> {
    const kamisRef = collection(db, "kamis");
    const publicKamisQuery = query(kamisRef, where("public", "==", true));

    const publicKamisSnap = await getDocs(publicKamisQuery);
    const relevantUserIDs = new Set<string>();
    const publicKamisMap: { [kamiID: string]: Kami } = {};

    publicKamisSnap.forEach(publicKamiSnap => {
        const publicKami = publicKamiSnap.data() as Kami;
        publicKamisMap[publicKamiSnap.id] = publicKami;
        relevantUserIDs.add(publicKami.userID);
    });

    const usersRef = collection(db, "users");
    const relevantUsersQuery = query(usersRef, where(documentId(), "in", Array.from(relevantUserIDs)));
    const userIDToUserMap: { [userID: string]: User } = {};
    const relevantUsersSnap = await getDocs(relevantUsersQuery);

    relevantUsersSnap.forEach(relevantUserSnap => {
        const relevantUser = relevantUserSnap.data() as User;
        userIDToUserMap[relevantUser.userID] = relevantUser;
    });

    return Object.keys(publicKamisMap).map(kamiID => {
        const publicKami = publicKamisMap[kamiID];

        return {
            kamiID,
            title: publicKami.title,
            author: userIDToUserMap[publicKami.userID],
            imageSrc: publicKami.imageSrc,
            description: publicKami.description
        };
    });
}

/**
 * Accepts a kamiID and returns a Promise that resolves to a ViewableKami data.
 */
export async function getViewableKami(kamiID: string): Promise<ReadOnlyKami> {
    const kamiRef = doc(db, "kamis", kamiID);
    const kamiSnap = await getDoc(kamiRef);
    const { userID, title, description } = kamiSnap.data() as Kami;

    const userRef = doc(db, "users", userID);
    const userSnap = await getDoc(userRef);
    const user = userSnap.data() as User;

    const imageSrc = await getKamiImage(kamiID);

    return {
        kamiID,
        title,
        author: user,
        imageSrc,
        description
    };
}