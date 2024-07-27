import Logo from "@/app/components/Logo";
import SearchBar, { showMobileSearchBarAtom } from "./SearchBar/";
import ProfileButton from "./ProfileButton";
import CreateButton from "./CreateButton";
import { useAtomValue } from "jotai";
import { userAtom } from "@/atoms/auth";
import Link from "next/link";

export default function TopBar() {
    const isUserLoggedIn = useAtomValue(userAtom).loadStatus === "succeeded";

    const showMobileSearchBar = useAtomValue(showMobileSearchBarAtom);

    return (
        <section className="flex items-center h-20 w-full relative p-6 border-b-2 border-theme-dark-white">
            <div 
                className="mr-auto transition-opacity"
                style={{
                    opacity: showMobileSearchBar ? 0 : 1
                }}
            >
                <Logo size="lg" />
            </div>
            <SearchBar />
            <div 
                className="flex transition-opacity"
                style={{
                    opacity: showMobileSearchBar ? 0 : 1
                }}
            >
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
                                className="hidden sm:block text-sm rounded-full hover:bg-theme-light-gray text-theme-black font-medium p-3"
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