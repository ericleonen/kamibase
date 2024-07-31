import { ReadOnlyKami } from "@/db/kami/schemas";
import Link from "next/link";

type KamiCardProps = {
    viewableKami: ReadOnlyKami
};

export default function KamiCard({ viewableKami }: KamiCardProps) {
    return (
        <div className="w-full sm:w-1/2 md:w-1/4 p-3">
            <Link
                href={`/viewer/${viewableKami.kamiID}`}
                className="relative flex flex-col items-center border-2 border-theme-gray hover:border-theme-blue overflow-hidden transition-colors"
            >
                <img 
                    src={viewableKami.imageSrc}
                    alt={viewableKami.title}
                    className="w-auto h-auto"
                />
                <div className="absolute h-full w-full opacity-0 hover:opacity-100 bg-theme-blue/10 backdrop-blur-sm transition-opacity flex flex-col items-center justify-center">
                    <p className="font-bold text-2xl text-theme-blue">{viewableKami.title}</p>
                    <p className="text-sm text-theme-black mt-1">by {viewableKami.author.name}</p>
                </div>
            </Link>
        </div>
    )
}