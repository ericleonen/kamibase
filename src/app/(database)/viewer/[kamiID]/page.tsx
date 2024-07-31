import { getViewableKami } from "@/db/kami/read";
import TopBar from "../../components/TopBar";
import { FaArrowRight, FaRegHeart } from "react-icons/fa6";import Link from "next/link";
;

type ViewerProps = {
    params: { kamiID: string }
}

export default async function Viewer({ params }: ViewerProps) {
    const kami = await getViewableKami(params.kamiID);

    return (
        <div className="h-screen items-center flex-col bg-theme-white">
            <TopBar />
            <div className="h-[calc(100%-5rem)] flex justify-center px-3 py-6 w-full overflow-y-scroll">
                <div className="w-full max-w-[500px] flex flex-col">
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
                    <div className="flex">
                        <img
                            src={kami.imageSrc}
                            alt={kami.title}
                            className="w-full h-auto border-2 border-theme-gray mt-6"
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}