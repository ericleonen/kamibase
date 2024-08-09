import Logo from "@/app/components/Logo";
import SearchBar, { showMobileSearchBarAtom } from "./SearchBar";
import ProfileButton from "./UserSection/ProfileButton";
import { useAtomValue } from "jotai";
import NavButton from "./NavButton";
import CreateSection from "./UserSection/CreateSection";
import { AuthUser, authUserAtom } from "@/atoms/user";
import nookies from "nookies";
import { GetServerSidePropsContext } from "next";
import { adminAuth } from "@/firebase/admin";

type TopBarProps = {
    authUser: AuthUser | null
}

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
    
}

export default function TopBar({ authUser }: TopBarProps) {
    const showMobileSearchBar = useAtomValue(showMobileSearchBarAtom);

    return (
        <section 
            className="flex items-center h-20 w-full p-6 border-b-2 border-theme-light-gray"
            style={{
                position: showMobileSearchBar ? "relative" : undefined
            }}
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
                    authUser ? (
                        <>
                            <CreateSection />
                            <ProfileButton name={authUser.name} photoURL={authUser.photoURL} />
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