"use client"

import { User } from "@/db/user/schemas"
import { useAtomValue } from "jotai"
import { showMobileSearchBarAtom } from "../SearchBar"
import CreateSection from "./CreateSection"
import ProfileButton from "./ProfileButton"
import NavButton from "../NavButton"
import { userAtom } from "@/atoms/user"

type UserSectionProps = {
    user: User | null
}

export default function UserSection({ user }: UserSectionProps) {
    const showMobileSearchBar = useAtomValue(showMobileSearchBarAtom);
    user = user || useAtomValue(userAtom);

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
                        <ProfileButton user={user} />
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