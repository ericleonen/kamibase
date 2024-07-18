import { userAtom } from "@/atoms/auth"
import { useLogOut } from "@/auth/logOut";
import { useAtomValue } from "jotai"

export default function ProfileButton() {
    const userName = useAtomValue(userAtom).name;
    const { logOut } = useLogOut();

    return (
        <button 
            onClick={logOut}
            className="flex items-center justify-center relative h-12 w-12 rounded-full border-2 border-theme-light-gray ml-3 bg-theme-blue"
        >
            <span className="font-bold text-theme-white">{userName.charAt(0).toUpperCase()}</span>
        </button>
    )
}