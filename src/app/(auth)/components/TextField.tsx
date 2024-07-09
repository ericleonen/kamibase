type TextFieldProps = {
    text: string,
    setText: (text: string) => void,
    placeholder: string,
    sensitive?: boolean
}

export default function TextField({ text, setText, placeholder, sensitive }: TextFieldProps) {
    return (
        <input
            type={sensitive ? "password" : "text"}
            value={text}
            onChange={({target}) => setText(target.value)}
            placeholder={placeholder}
            className="mt-3 w-64 px-3 py-2 rounded-lg bg-theme-light-gray placeholder:text-theme-dark-gray text-theme-black focus:outline-2 focus:outline-theme-yellow focus:outline"
        />
    )
}