import { PublicKami } from "@/db/kami/read";
import { useKamiImage } from "@/storage/kamis/read";

type KamiCardProps = {
    kamiData: PublicKami
};

export default function KamiCard({ kamiData }: KamiCardProps) {
    const kamiImage = useKamiImage(kamiData.kamiID);

    // TODO: Add feature that when a KamiCard is hovered, reveals title, author, and a button to view

    return (
        <div className="flex flex-col items-center w-[20rem] mx-auto m-3">
            <div className="w-full border-2 rounded-lg border-theme-gray overflow-hidden">
                <img 
                    src={kamiImage.src}
                    alt={kamiData.title}
                    className="w-auto h-auto"
                />
            </div>
            {/* <p className="mt-3 w-full flex items-center">
                <div className="h-7 w-7 rounded-full bg-theme-blue flex items-center justify-center">
                    <span className="text-theme-white font-bold">{kamiData.userName.charAt(0).toUpperCase()}</span>
                </div>
                <span className="ml-2 font-medium text-theme-black">{kamiData.userName}</span>
            </p> */}
        </div>
    )
}