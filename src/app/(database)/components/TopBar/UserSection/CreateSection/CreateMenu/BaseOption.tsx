import { useCreateKami } from "@/db/kami/create"

type BaseOptionProps = {
    title: string,
    kamiString: string
}

export default function BaseOption({ title, kamiString }: BaseOptionProps) {
    const { isCreating, create } = useCreateKami();

    const handleClick = () => {
        create(`Untitled ${title}`, kamiString);
    }

    return (
        <div className="w-1/3 p-3">
            <button 
                onClick={handleClick}
                className="flex flex-col w-full items-center hover:bg-theme-light-gray p-2 rounded-md"
            >
                <div className="w-full aspect-square bg-theme-gray" />
                <p className="text-sm text-theme-black font-medium mt-2">{title}</p>
            </button>
        </div>
    )
}