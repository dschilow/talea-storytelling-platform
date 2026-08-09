// @ts-ignore Bun exposes this runtime-only test helper without Node typings.
import { describe, expect, test } from "bun:test";
import { detectStructureSignals } from "./dev-mode-sanitizers";

/**
 * The sacrifice detector is a keyword heuristic, and every false negative it
 * has produced cost a real story: the premium score caps at 8.4, the release
 * gate reports "personalCost not detected", and repair rounds go looking for a
 * sacrifice that is already on the page.
 *
 * This file pins the shapes that have actually shipped, so the next verb added
 * to the pattern cannot silently drop an older one.
 */

const page = (order: number, content: string) => ({ order, title: `Leseseite ${order}`, content });

/** Filler that is deliberately free of sacrifice, loss and finale keywords. */
const NEUTRAL = "Die Sonne stand hoch. Zwei Kinder liefen den Weg entlang und redeten.";

describe("sacrifice detection — shapes that shipped", () => {
  test("run 3a1dbd51: keepsake torn out of the notebook and pressed under the seam", () => {
    // Verbatim reading page 3 of "Die ungeduldige Flickkarte". Before this
    // case the detector missed it twice over: "drückte ... unter" was not a
    // placement verb, and "das leere Loch" / "es fehlt" was not a recognised
    // loss confirmation.
    const signals = detectStructureSignals([
      page(1, NEUTRAL),
      page(2, NEUTRAL),
      page(3, "Er griff in sein Nähheft. Sein Daumen strich über das alte Brückenstück. Einmal. Zweimal. "
        + "„Das rote Stück?“, fragte Adrian. „Das Andenken“, sagte Alexander. Er riss es heraus. "
        + "Er drückte es unter die neue Naht, um den Faden zu verstärken. Das leere Loch im Heft starrte ihn an. "
        + "Er schluckte. „Es fehlt“, sagte Adrian. „Es hält“, sagte Alexander."),
      page(4, NEUTRAL),
      page(5, NEUTRAL),
    ]);
    expect(signals.hasPersonalSacrifice).toBe(true);
  });

  test("a story that never gives anything up is still reported as missing one", () => {
    const signals = detectStructureSignals([
      page(1, NEUTRAL),
      page(2, NEUTRAL),
      page(3, "Alexander zählte die Planken. Adrian prüfte den Boden. Die Brücke knackte freundlich."),
      page(4, NEUTRAL),
      page(5, "Sie liefen zusammen weiter und winkten."),
    ]);
    expect(signals.hasPersonalSacrifice).toBe(false);
  });

  test("the previously fixed shapes still register", () => {
    const shapes: Array<[string, string]> = [
      ["give-away (b9994e62)", "Er gab ihr den letzten Rest Kreide. Sie braucht es dringender."],
      ["placement (a75b53af)", "Dann legte er den Kompass in den Spalt. Aber der Kompass war fort."],
      ["throw-away (3db9b3b0)", "Dann warf er den Notizblock. Weit in die Dunkelheit."],
      ["destruction (67d63377)", "Die Stiefel brachen auf. Sie fielen zu Boden. Grau. Leblos."],
      ["submersion (a611384d)", "Alexander ließ die Karte sinken. In die Pfütze. Sie blubberte auf. Versank."],
    ];
    for (const [label, midPage] of shapes) {
      const signals = detectStructureSignals([
        page(1, NEUTRAL), page(2, NEUTRAL), page(3, midPage), page(4, NEUTRAL), page(5, NEUTRAL),
      ]);
      expect(`${label}: ${signals.hasPersonalSacrifice}`).toBe(`${label}: true`);
    }
  });

  test("a sacrifice on the last pages counts too", () => {
    const signals = detectStructureSignals([
      page(1, NEUTRAL), page(2, NEUTRAL), page(3, NEUTRAL),
      page(4, NEUTRAL),
      page(5, "Er zog die Feder aus seiner Tasche heraus und legte sie hin. Die Stelle blieb leer. Nie wieder."),
    ]);
    expect(signals.hasPersonalSacrifice).toBe(true);
  });
});
