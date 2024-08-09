import KamiCard from "./KamiCard";
import { getPublicKamis } from "@/db/kami/read";

export default async function KamiCards() {
    const publicKamis = await getPublicKamis();

    return publicKamis.map(publicKami => 
        <KamiCard 
            key={publicKami.kamiID}
            viewableKami={publicKami}
        />
    );
}