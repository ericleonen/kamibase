import Vertex from "./Vertex";

export default class Crease {
    vertex1: Vertex;
    vertex2: Vertex;

    constructor(vertex1: Vertex, vertex2: Vertex) {
        this.vertex1 = vertex1;
        this.vertex2 = vertex2;
    }
}