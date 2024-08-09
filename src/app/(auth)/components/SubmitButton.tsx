import Spinner from "@/app/components/Spinner"

type SubmitButtonProps = {
    inProgress: boolean
}

export default function SubmitButton({ inProgress }: SubmitButtonProps) {
    return (
        <button
            type="submit"
            className="mt-6 font-medium rounded-full w-64 p-3 bg-theme-black hover:bg-theme-light-black text-theme-white text-sm flex items-center justify-center"
        >
            { inProgress ? <Spinner className="h-[1.25rem]"/> : "Submit" }
        </button>
    )
}