export type LoadStatus = "idle" | "loading" | "succeeded" | "failed";
export type SaveStatus = "deleting" | "unsaved" | "saving" | "saved" | "failed";

export type ReadOnlyResource = {
    loadStatus: LoadStatus
}

export type EditableResource = { 
    loadStatus: LoadStatus,
    saveStatus: SaveStatus,
}