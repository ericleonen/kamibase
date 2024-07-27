import { usePublicKamis } from "@/db/kami/read";
import KamiCard from "./KamiCard";

export default function KamiCards() {
    const publicKamis = usePublicKamis();

    return (
        <div className="h-[100vh-5rem] flex flex-wrap w-full p-3 overflow-y-scroll">
            {
                publicKamis.list.map(publicKami => 
                    <KamiCard 
                        key={publicKami.kamiID}
                        viewableKami={publicKami}
                    />
                )
            }
            {/* <div className="ml-auto" /> */}
        </div>
    );
}