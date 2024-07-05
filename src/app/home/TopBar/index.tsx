import Image from "next/image"
import NavShadow from "./NavShadow"
import NavSection from "./NavSection"
import Logo from "@/app/components/Logo"

export default function TopBar() {
    return <>
        <section className="relative flex h-16 items-center bg-theme-light-white shadow-md px-4">
            <Logo />
            <SearchBar />
            <NavSection />
        </section>
        <NavShadow />
    </>
}

function SearchBar() {
    return (
        <div className="absolute flex items-center py-2 px-3 bg-theme-dark-white rounded-lg left-1/2 translate-x-[-50%]">
            <Image 
                src="icons/search.svg"
                alt="Search icon"
                height={19}
                width={19}
                className="h-[19px] w-[19px]"
            />
            <input 
                placeholder="Search for crease patterns"
                className="h-8 w-80 ml-3 bg-transparent font-medium text-theme-darker-gray placeholder:text-theme-dark-gray focus:outline-none"
            />
        </div>
    )
}