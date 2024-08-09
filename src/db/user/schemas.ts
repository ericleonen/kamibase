export type User = {
    uid: string,
    name: string,
    photoURL: string
}

export type ReadOnlyUser = {
    uid: string,
    name: string,
    photoURL: string | null
}