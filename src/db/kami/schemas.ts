import { User } from "../user/schemas"

export type Kami = {
    title: string,
    userID: string,
    kamiString: string,
    public: boolean,
    imageSrc: string,
    description: string
}

export type EditableKami = {
    title: string,
    kamiString: string,
    public: boolean,
    description: string
}

export type ReadOnlyKami = {
    kamiID: string,
    title: string,
    author: User,
    imageSrc: string,
    description: string
}