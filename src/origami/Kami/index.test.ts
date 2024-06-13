import fs from 'node:fs';
import Kami from '.';

test("Kami.fromString() correctly reads waterbomb.kami", () => {
    try {
        const kamiString = fs.readFileSync("public/waterbomb.kami", "utf8");
        const kami = Kami.fromString(kamiString);

        expect(kami.vertexes.length()).toBe(7);
        expect(kami.creases.length()).toBe(6);
    } catch (err) {
        console.error(err);
    }
});