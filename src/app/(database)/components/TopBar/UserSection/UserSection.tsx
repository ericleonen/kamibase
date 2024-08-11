"use client"

import { User } from "@/db/user/schemas"
import { useAtomValue } from "jotai"
import { showMobileSearchBarAtom } from "../SearchBar"
import CreateSection from "./CreateSection"
import NavButton from "../NavButton"
import ProfileSection from "./ProfileSection"

type UserSectionProps = {
    user: User | null
}

export default function UserSection({ user }: UserSectionProps) {
    const showMobileSearchBar = useAtomValue(showMobileSearchBarAtom);

    return (
        <div
            className="flex transition-opacity"
            style={{
                opacity: showMobileSearchBar ? 0 : 1
            }}
        >
            {
                user ? (
                    <>
                        <CreateSection />
                        <ProfileSection user={user} />
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
    )
}