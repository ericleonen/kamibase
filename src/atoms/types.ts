export type LoadStatus = "idle" | "loading" | "succeeded" | "failed";
export type SaveStatus = "deleting" | "unsaved" | "saving" | "saved" | "failed";

export type Resource = { 
    loadStatus: LoadStatus,
    saveStatus: SaveStatus
}