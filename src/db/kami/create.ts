// import { auth, db } from "@/firebase";
// import { addDoc, collection } from "firebase/firestore";
// import { useState } from "react"
// import { Kami } from "./schemas";

// export function useCreateKami(): { 
//     isCreatingKami: boolean, 
//     createKami: (baseKamiString?: string) => void,
//     error?: Error
// } {
//     const [isCreatingKami, setIsCreatingKami] = useState(false);
//     const [error, setError] = useState<Error>();

//     const createKami = async (title?: string, baseKamiString?: string) => {
//         try {
//             setIsCreatingKami(true);

//             const kamisRef = collection(db, "kamis");
//             const newKamiRef = await addDoc(kamisRef, {
//                 title: title || "Untitled kami",
                
//             } as Kami);
//         }
//     }

//     return { isCreatingKami, createKami, error };
// }