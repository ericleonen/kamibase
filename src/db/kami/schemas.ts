import { ReadOnlyUser } from "../user/schemas"

export type Kami = {
    title: string,
    authorUid: string,
    kamiString: string,
    public: boolean,
    imageURL: string,
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
    author: ReadOnlyUser,
    imageURL: string,
    description: string
}