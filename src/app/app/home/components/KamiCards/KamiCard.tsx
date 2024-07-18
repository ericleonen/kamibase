import { PublicKami } from "@/db/kami/read";
import { useKamiImage } from "@/storage/kamis/read";

type KamiCardProps = {
    kamiData: PublicKami
};

export default function KamiCard({ kamiData }: KamiCardProps) {
    const kamiImage = useKamiImage(kamiData.kamiID);

    return (
        <div className="flex flex-col items-center m-2 p-3 w-[22%]">
            <img 
                src={kamiImage.src}
                alt={kamiData.title}
                className="w-auto h-auto border-2 rounded-lg border-theme-gray"
            />
            <p className="mt-3 w-full flex items-center">
                <div className="h-7 w-7 rounded-full bg-theme-blue flex items-center justify-center">
                    <span className="text-theme-white font-bold">{kamiData.userName.charAt(0).toUpperCase()}</span>
                </div>
                <span className="ml-2 font-medium text-theme-black">{kamiData.userName}</span>
            </p>
        </div>
    )
}