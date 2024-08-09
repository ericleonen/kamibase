import { getAuthenticatedUser } from "@/auth/read";
import NavSection from "./NavSection";
import SearchBar from "./SearchBar";
import UserSection from "./UserSection";

export default async function TopBar() {
    const user = await getAuthenticatedUser();
    
    return (
        <section 
            className="relative flex items-center h-20 w-full p-6 border-b-2 border-theme-light-gray"
        >
            <NavSection />
            <SearchBar />
            <UserSection user={user} />
        </section>
    )
}