import { PublicKami } from "@/db/kami/read";
import { useKamiImage } from "@/storage/kami/read";
import Link from "next/link";

type KamiCardProps = {
    kamiData: PublicKami
};

export default function KamiCard({ kamiData }: KamiCardProps) {
    const kamiImage = useKamiImage(kamiData.kamiID);

    return (
        <Link 
            href={`/viewer/${kamiData.kamiID}`}
            className="relative flex flex-col items-center w-[20rem] mx-auto m-3 border-2 rounded-lg border-theme-gray hover:border-theme-blue overflow-hidden transition-colors"
        >
            <img 
                src={kamiImage.src}
                alt={kamiData.title}
                className="w-auto h-auto"
            />
            <div className="absolute h-full w-full opacity-0 hover:opacity-100 bg-theme-blue/10 backdrop-blur-sm transition-opacity flex flex-col items-center justify-center">
                <p className="font-bold text-2xl text-theme-blue">{kamiData.title}</p>
                <p className="text-sm text-theme-black mt-1">by {kamiData.userName}</p>
            </div>
        </Link>
    )
}