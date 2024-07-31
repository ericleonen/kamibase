"use client"

import Logo from "@/app/components/Logo";
import SearchBar, { showMobileSearchBarAtom } from "./SearchBar/";
import ProfileButton from "./ProfileButton";
import CreateButton from "./CreateButton";
import { useAtomValue } from "jotai";
import { userAtom } from "@/atoms/auth";
import NavButton from "./NavButton";

export default function TopBar() {
    const isUserLoggedIn = useAtomValue(userAtom).loadStatus === "succeeded";

    const showMobileSearchBar = useAtomValue(showMobileSearchBarAtom);

    return (
        <section 
            className="flex items-center h-20 w-full relative p-6 border-b-2 border-theme-light-gray"
        >
            <div 
                className="mr-auto transition-opacity flex items-center"
                style={{
                    opacity: showMobileSearchBar ? 0 : 1
                }}
            >
                <Logo size="lg" />
            </div>
            <SearchBar />
            <div 
                className="transition-opacity flex"
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
                            <NavButton
                                href="/login"
                                label="Log in"
                            />
                            <NavButton
                                href="/sign-up"
                                label="Sign up"
                                dark
                                forMobile
                            />
                        </>
                    )
                }
            </div>
        </section>
    )
}