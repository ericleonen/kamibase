import Link from "next/link";
import { FaRegHeart, FaArrowRight } from "react-icons/fa6";
import Image from "next/image";
import { getViewableKami } from "@/db/kami/read";

type ViewerDisplayProps = {
    kamiID: string
}

export default async function ViewerDisplay({ kamiID }: ViewerDisplayProps) {
    const kami = await getViewableKami(kamiID);

    return (
        <>
            <h1 className="text-3xl font-bold text-theme-black">{kami.title}</h1>
            <div className="flex items-center mt-2 ml-1">
                <Link
                    href={`/user/${kami.author.userID}`}
                    className="flex items-center text-theme-black hover:text-theme-blue hover:underline decoration-[1.5px]"
                >
                    <img 
                        src={kami.author.profileSrc}
                        alt={kami.author.name}
                        className="h-[2.25rem] w-[2.25rem] rounded-full object-cover"
                    />
                    <span className="font-medium ml-2 text-sm">{kami.author.name}</span>
                </Link>
                <div className="ml-auto flex items-center">
                    <button className="h-[2.25rem] w-[2.25rem] hover:bg-theme-light-gray transition-colors rounded-full">
                        <FaRegHeart className="text-lg text-theme-black w-full"/>
                    </button>
                    <button className="ml-3 justify-center flex items-center bg-theme-black hover:bg-theme-light-black transition-colors rounded-full py-2 px-3 text-theme-white font-medium text-sm">
                        Use as a base
                        <FaArrowRight className="ml-1 text-sm"/>
                    </button>
                </div>
            </div>
            <div className="relative w-full aspect-square border-2 border-theme-gray mt-6">
                <Image
                    src={kami.imageSrc}
                    alt={kami.title}
                    fill
                    className="object-contain"
                />
            </div>
        </>
    )
}