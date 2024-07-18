import Logo from "@/app/components/Logo";
import SearchBar from "./SearchBar";
import ProfileButton from "./ProfileButton";
import CreateButton from "./CreateButton";

export default function TopBar() {
    return (
        <section className="flex justify-between items-center h-20 w-full relative px-3">
            <Logo size="lg" />
            <div className="absolute left-1/2 top-1/2 translate-x-[-50%] translate-y-[-50%]">
                <SearchBar />
            </div>
            <div className="flex">
                <CreateButton />
                <ProfileButton />
            </div>
        </section>
    )
}