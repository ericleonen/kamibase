import KamiCard from "./KamiCard";
import { getPublicKamis } from "@/db/kami/read";

export default async function KamiCards() {
    const publicKamis = await getPublicKamis();

    return (
        <div
            className="h-[100vh-5rem] flex flex-wrap w-full p-3 overflow-y-scroll"
        >
            {
                publicKamis.map(publicKami => 
                    <KamiCard 
                        key={publicKami.kamiID}
                        viewableKami={publicKami}
                    />
                )
            }
        </div>
    );
}