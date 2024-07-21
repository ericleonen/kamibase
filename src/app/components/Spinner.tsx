import { ImSpinner8 } from "react-icons/im"

type SpinnerProps = {
    className: string
}

export default function Spinner({ className }: SpinnerProps) {
    return <ImSpinner8 className={`${className} animate-spin`} />
}