import Logo from "@/app/components/Logo";
import SearchBar from "./SearchBar";
import ProfileButton from "./ProfileButton";
import CreateButton from "./CreateButton";
import { useAtomValue } from "jotai";
import { userAtom } from "@/atoms/auth";
import Link from "next/link";

export default function TopBar() {
    const isUserLoggedIn = useAtomValue(userAtom).loadStatus === "succeeded";

    return (
        <section className="flex justify-between items-center h-20 w-full relative px-6">
            <Logo size="lg" />
            <div className="absolute left-1/2 top-1/2 translate-x-[-50%] translate-y-[-50%]">
                <SearchBar />
            </div>
            <div className="flex">
                {
                    isUserLoggedIn ? (
                        <>
                            <CreateButton />
                            <ProfileButton />
                        </>
                    ) : (
                        <>
                            <Link 
                                href="/login"
                                className="text-sm rounded-full hover:bg-theme-light-gray text-theme-black font-medium p-3"
                            >
                                Log in
                            </Link>
                            <Link 
                                href="/sign-up"
                                className="text-sm rounded-full bg-theme-black hover:bg-theme-light-black text-theme-white font-medium p-3 ml-3"
                            >
                                Sign up
                            </Link>
                        </>
                    )
                }
            </div>
        </section>
    )
}