import { getEditableKami } from "@/db/kami/read";

type EditorPageProps = {
    params: { kamiID: string }
}

export default async function EditorPage({ params }: EditorPageProps) {
    const { kamiID } = params;
    
    const kami = await getEditableKami(kamiID);

    return (
        <div>
            {kami.title}
            {kami.kamiString}
            {kami.public}
            {kami.description}
        </div>
    )
}