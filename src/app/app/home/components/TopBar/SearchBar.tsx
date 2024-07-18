import { BiSearch } from "react-icons/bi";

export default function SearchBar() {
    return (
        <div className="flex items-center p-3 bg-theme-light-gray rounded-lg text-theme-darker-gray">
            <BiSearch className="text-lg"/>
            <input 
                type="text"
                placeholder="Search for CPs"
                className="bg-transparent ml-2 focus:outline-none placeholder:text-theme-dark-gray text-sm"
            />
        </div>
    )
}