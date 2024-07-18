import { PublicKami } from "@/db/kami/read";
import { useKamiImage } from "@/storage/kamis/read";

type KamiCardProps = {
    kamiData: PublicKami
};

export default function KamiCard({ kamiData }: KamiCardProps) {
    const kamiImage = useKamiImage(kamiData.kamiID);

    console.log(kamiImage.src);

    return (
        <div className="flex flex-col items-center m-2 p-3 w-[30%]">
            <img 
                src={kamiImage.src}
                alt={kamiData.title}
                className="w-auto h-auto"
            />
            <p className="mt-3 text-theme-black">
                <span className="mr-1 text-theme-blue font-bold">{kamiData.title} </span>
                by 
                <span className="ml-1 text-theme-red">{kamiData.userName}</span>
            </p>
        </div>
    )
}