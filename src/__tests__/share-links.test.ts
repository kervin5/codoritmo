/**
 * @jest-environment node
 */
import { createDocument, readSharedDocument } from "../components/workspace/documents";

function encode(payload: object): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

describe("share links", () => {
  it("reads an uncompressed program from the URL fragment", async () => {
    const doc = createDocument("Compartido.psc", "Algoritmo A\n\tEscribir 1\nFinAlgoritmo", "estricto");
    const shared = await readSharedDocument(`#u=${encode({ n: doc.name, s: doc.source, p: doc.profileId })}`);
    expect(shared?.name).toBe("Compartido.psc");
    expect(shared?.source).toBe(doc.source);
    expect(shared?.profileId).toBe("estricto");
  });

  it("reads a deflated program from the URL fragment", async () => {
    const bytes = new TextEncoder().encode(JSON.stringify({ n: "B.psc", s: "Algoritmo B\nFinAlgoritmo", p: "flexible" }));
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"));
    const compressed = Buffer.from(await new Response(stream).arrayBuffer()).toString("base64url");
    const shared = await readSharedDocument(`#c=${compressed}`);
    expect(shared?.source).toBe("Algoritmo B\nFinAlgoritmo");
    expect(shared?.profileId).toBe("flexible");
  });

  it("falls back to the default profile and rejects junk", async () => {
    const shared = await readSharedDocument(`#u=${encode({ n: "C.psc", s: "x", p: "no-such-profile" })}`);
    expect(shared?.profileId).toBe("desktop-default");
    expect(await readSharedDocument("#nope")).toBeNull();
    expect(await readSharedDocument("#c=@@@")).toBeNull();
  });
});
