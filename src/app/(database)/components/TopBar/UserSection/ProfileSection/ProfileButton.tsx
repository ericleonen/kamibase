import { User } from "@/db/user/schemas";
import Image from "next/image"

type ProfileButtonProps = {
    user: User,
    onClick: () => void
}

export default function ProfileButton({ user, onClick }: ProfileButtonProps) {
    return (
        <button 
            onClick={onClick}
            className="h-[2.75rem] w-[2.75rem] rounded-full overflow-hidden"
        >
            {
                user.photoURL ? (
                    <Image 
                        src={user.photoURL}
                        alt={user.name}
                        fill
                        className="object-cover z-10"
                    />
                ) : (
                    <div className="h-full w-full flex items-center justify-center bg-theme-blue text-theme-white font-bold">
                        { user.name.charAt(0).toUpperCase() }
                    </div>
                )
            }
        </button>
    )
}