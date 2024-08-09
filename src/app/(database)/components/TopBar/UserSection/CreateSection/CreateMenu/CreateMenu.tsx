import BaseOption from "./BaseOption";

type CreateMenuProps = {
    show: boolean
}

export default function CreateMenu({ show }: CreateMenuProps) {
    return show && (
        <div className="absolute flex flex-wrap rounded-lg w-[30vw] p-3 bg-theme-light-white border-2 border-theme-light-gray right-2 top-[calc(100%+0.5rem)] z-30">
            <p className="w-full px-5 mt-2 font-bold text-theme-black text-sm">Choose a base</p>
            <BaseOption
                title="8x8"
                kamiString={""}
            />
            <BaseOption
                title="16x16"
                kamiString={""}
            />
            <BaseOption
                title="32x32"
                kamiString={""}
            />
        </div>
    );
}