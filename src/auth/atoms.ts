import { LoadStatus, Resource } from "@/db/types";
import { User } from "@/db/user/schemas";
import { atom, useAtom } from "jotai";

export const userAtom = atom<User & Resource>({
    name: "",
    email: "",
    userID: "",
    kamis: [],
    loadStatus: "idle",
    saveStatus: "saved"
});

export function useUserLoadStatus(): {
    userLoadStatus: LoadStatus,
    setUserLoadStatus: (loadStatus: LoadStatus) => void
} {
    const [user, setUser] = useAtom(userAtom);

    const setUserLoadStatus = (loadStatus: LoadStatus) => {
        setUser(prevUser => ({...prevUser, loadStatus}));
    };

    return {
        userLoadStatus: user.loadStatus,
        setUserLoadStatus
    };
}