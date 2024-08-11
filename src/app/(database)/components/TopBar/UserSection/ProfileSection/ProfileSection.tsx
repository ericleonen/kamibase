import { User } from "@/db/user/schemas"
import ProfileButton from "./ProfileButton"
import { useMenu } from "@/app/components/Menu"
import ProfileMenu from "./ProfileMenu"

type ProfileSectionProps = {
    user: User
}

export default function ProfileSection({ user }: ProfileSectionProps) {
    const profileMenu = useMenu();
    
    return (
        <div className="relative h-full ml-3">
            <ProfileButton 
                user={user}
                onClick={profileMenu.open}
            />
            <ProfileMenu show={profileMenu.show} />
        </div>
    )
}