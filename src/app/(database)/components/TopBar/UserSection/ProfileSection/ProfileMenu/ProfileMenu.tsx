import { FaSignOutAlt } from "react-icons/fa"
import Option from "./Option"
import { useLogout } from "@/auth/session"
import Spinner from "@/app/components/Spinner"

type ProfileMenuProps = {
    show: boolean
}

export default function ProfileMenu({ show }: ProfileMenuProps) {
    const logout = useLogout();

    return show && (
        <div className="absolute flex flex-col rounded-lg w-64 p-2 bg-theme-light-white border-2 border-theme-light-gray right-2 top-[calc(100%+0.5rem)] z-30">
            <Option 
                onClick={logout.attempt}
                Icon={logout.inProgress ? Spinner : FaSignOutAlt}
            >
                Sign out
            </Option>
        </div>
    )
}