export type LoadStatus = "idle" | "loading" | "succeeded" | "failed";
export type SaveStatus = "deleting" | "saving" | "saved" | "failed";

export type Resource = { 
    loadStatus: LoadStatus,
    saveStatus: SaveStatus
}