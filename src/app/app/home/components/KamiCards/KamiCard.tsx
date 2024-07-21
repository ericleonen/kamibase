import { PublicKami } from "@/db/kami/read";
import { useKamiImage } from "@/storage/kamis/read";

type KamiCardProps = {
    kamiData: PublicKami
};

export default function KamiCard({ kamiData }: KamiCardProps) {
    const kamiImage = useKamiImage(kamiData.kamiID);

    // TODO: Add feature that when a KamiCard is hovered, reveals title, author, and a button to view

    return (
        <div className="relative flex flex-col items-center w-[20rem] mx-auto m-3 border-2 rounded-lg border-theme-gray overflow-hidden">
            <img 
                src={kamiImage.src}
                alt={kamiData.title}
                className="w-auto h-auto"
            />
            <div className="absolute h-full w-full opacity-0 hover:opacity-100 bg-theme-blue/40 backdrop-blur-sm transition-opacity flex flex-col items-center justify-center">
                <p className="font-bold text-2xl text-theme-black">{kamiData.title}</p>
                <p className="text-sm text-theme-darker-gray mt-1">by {kamiData.userName}</p>
            </div>
        </div>
    )
}