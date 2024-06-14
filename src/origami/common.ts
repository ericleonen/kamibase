import Crease from "./Crease"
import Vertex from "./Vertex"

export const VERTEXES = {
    "top left": new Vertex(0, 0),
    "top right": new Vertex(1, 0),
    "bottom left": new Vertex(0, 1),
    "bottom right": new Vertex(1, 1),
    "center": new Vertex(0.5, 0.5)
}

export const CREASES = {
    "major mountain": new Crease("M", VERTEXES["top left"], VERTEXES["bottom right"]),
    "minor mountain": new Crease("M", VERTEXES["top right"], VERTEXES["bottom left"]),
    "major valley": new Crease("V", VERTEXES["top left"], VERTEXES["bottom right"]),
    "minor valley": new Crease("V", VERTEXES["top right"], VERTEXES["bottom left"])
}