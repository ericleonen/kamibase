type SubmitButton = {
    onClick: () => void
}

export default function SubmitButton({ onClick }: SubmitButton) {
    return (
        <button
            onClick={onClick}
            className="mt-6 font-medium rounded-lg w-64 py-2 bg-theme-black hover:bg-theme-light-black text-theme-white"
        >
            Submit
        </button>
    )
}