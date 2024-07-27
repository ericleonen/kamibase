import { useSetViewableKami } from "@/atoms/kami";
import { ViewableKami } from "@/db/kami/schemas";
import { useRouter } from "next/navigation";

type KamiCardProps = {
    viewableKami: ViewableKami
};

export default function KamiCard({ viewableKami }: KamiCardProps) {
    const router = useRouter();
    const setViewableKami = useSetViewableKami();

    const handleClick = () => {
        setViewableKami({
            ...viewableKami,
            loadStatus: "succeeded"
        });
        router.push(`/viewer/${viewableKami.kamiID}`);
    }

    return (
        <div className="w-full sm:w-1/2 md:w-1/4 p-3">
            <button
                onClick={handleClick}
                className="relative flex flex-col items-center border-2 border-theme-gray hover:border-theme-blue overflow-hidden transition-colors"
            >
                <img 
                    src={viewableKami.src}
                    alt={viewableKami.title}
                    className="w-auto h-auto"
                />
                <div className="absolute h-full w-full opacity-0 hover:opacity-100 bg-theme-blue/10 backdrop-blur-sm transition-opacity flex flex-col items-center justify-center">
                    <p className="font-bold text-2xl text-theme-blue">{viewableKami.title}</p>
                    <p className="text-sm text-theme-black mt-1">by {viewableKami.userName}</p>
                </div>
            </button>
        </div>
    )
}