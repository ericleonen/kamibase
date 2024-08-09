import { collection, doc, documentId, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "@/firebase";
import { EditableKami, Kami, ReadOnlyKami } from "./schemas";
import { ReadOnlyUser } from "../user/schemas";
import { getKamiImage } from "@/storage/kami/read";
import { cache } from "react";

export async function getPublicKamis(): Promise<ReadOnlyKami[]> {
    const kamisRef = collection(db, "kamis");
    const publicKamisQuery = query(kamisRef, where("public", "==", true));

    const publicKamisSnap = await getDocs(publicKamisQuery);
    const relevantUserIDs = new Set<string>();
    const publicKamisMap: { [kamiID: string]: Kami } = {};

    let isEmpty = true;

    publicKamisSnap.forEach(publicKamiSnap => {
        const publicKami = publicKamiSnap.data() as Kami;
        publicKamisMap[publicKamiSnap.id] = publicKami;
        relevantUserIDs.add(publicKami.authorUid);

        isEmpty = false;
    });

    if (isEmpty) {
        return [];
    }

    const usersRef = collection(db, "users");
    const relevantUsersQuery = query(usersRef, where(documentId(), "in", Array.from(relevantUserIDs)));
    const userIDToUserMap: { [uid: string]: ReadOnlyUser } = {};
    const relevantUsersSnap = await getDocs(relevantUsersQuery);

    relevantUsersSnap.forEach(relevantUserSnap => {
        const relevantUser = relevantUserSnap.data() as ReadOnlyUser;
        userIDToUserMap[relevantUser.uid] = relevantUser;
    });

    return Object.keys(publicKamisMap).map(kamiID => {
        const publicKami = publicKamisMap[kamiID];

        return {
            kamiID,
            title: publicKami.title,
            author: userIDToUserMap[publicKami.authorUid],
            imageURL: publicKami.imageURL,
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
    const { authorUid, title, description, imageURL } = kamiSnap.data() as Kami;

    const userRef = doc(db, "users", authorUid);
    const userSnap = await getDoc(userRef);
    const user = userSnap.data() as ReadOnlyUser;

    return {
        kamiID,
        title,
        author: user,
        imageURL,
        description
    };
}

// export async function getEditableKami(kamiID: string): Promise<EditableKami> {
//     const kamiRef = doc(db, "kamis", kamiID);
//     const kamiSnap = await getDoc(kamiRef);
//     const kami = kamiSnap.data() as Kami;

//     return {
//         title: kami.title,
//         kamiString: kami.kamiString,
//         public: kami.public,
//         description: kami.description
//     };
// }

// export const getEditableKami = cache(async (kamiId: string) => {
//     const user = getAuthenticatedUser()
// })