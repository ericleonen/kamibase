import { usePublicKamis } from "@/db/kami/read";
import KamiCard from "./KamiCard";

export default function KamiCards() {
    const publicKamis = usePublicKamis();

    return (
        <div className="h-max w-full flex flex-wrap justify-center px-6">
            {
                publicKamis.list.map(publicKami => 
                    <KamiCard 
                        key={publicKami.kamiID}
                        kamiData={publicKami}
                    />
                )
            }
        </div>
    );
}