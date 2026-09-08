"""Erzeugt App-Icon, adaptives Icon, Startbildschirm-Symbol und Store-Grafiken.

    python store/grafiken.py

Braucht nur Pillow, und zwar das des Betriebssystems - **keine** Abhaengigkeit
des Projekts (CLAUDE.md: keine neue Abhaengigkeit ohne Rueckfrage). Fehlt es:
`pip install Pillow`.

Warum ueberhaupt ein Skript und nicht einfach fertige Dateien?

Bis M12 lag hier die **Expo-Vorlage** - ein blauer Winkel auf hellblauem Grund,
in `assets/icon.png` sogar mit den Konstruktionslinien des Entwurfsrasters. Auf
dem Telefon sass dieser blaue Winkel auf einem hellgruenen Hintergrund, weil
`adaptiveIcon.backgroundColor` schon zur App-Farbwelt passte und das Symbol
nicht. Aufgefallen ist das erst beim Zusammenstellen des Store-Eintrags.

Damit so etwas nicht ein zweites Mal unbemerkt bleibt, liegt die Form jetzt als
Code vor: Wer die Farbe der App aendert, aendert sie hier an einer Stelle mit
und laesst das Skript neu laufen. Sieben Dateien, eine Wahrheit.

Die Farben stammen aus `src/theme/index.ts` und werden hier nicht neu erfunden.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

PROJEKT = Path(__file__).resolve().parent.parent
ASSETS = PROJEKT / "assets"
STORE = PROJEKT / "store"

GRUEN = (30, 108, 51)        # primary aus src/theme/index.ts
WEISS = (255, 255, 255)      # onPrimary
CONTAINER = (167, 245, 172)  # primaryContainer

# Vierfach zeichnen und herunterrechnen - die billigste brauchbare
# Kantenglaettung, die Pillow ohne Zusatzpakete hergibt.
SKALA = 4

# Noto Sans, SIL Open Font License. Bewusst nicht Segoe UI oder Arial: Deren
# Lizenz deckt das Rendern von Werbematerial nicht zweifelsfrei ab.
SCHRIFT = r"C:\Windows\Fonts\NotoSansSC-VF.ttf"

# Android beschneidet die Ebenen eines adaptiven Icons auf die inneren 66 %.
SICHERE_ZONE = 0.66


def haken(zeichner, groesse, dicke, farbe):
    """Ein Haken mit runden Enden, mittig auf einer quadratischen Flaeche."""
    e = groesse / 1024.0
    punkte = [(300 * e, 530 * e), (440 * e, 668 * e), (730 * e, 360 * e)]
    zeichner.line(punkte, fill=farbe, width=int(dicke), joint="curve")
    # joint="curve" rundet nur die Ecke. Die beiden Enden kommen von Hand.
    r = dicke / 2
    for x, y in (punkte[0], punkte[2]):
        zeichner.ellipse([x - r, y - r, x + r, y + r], fill=farbe)


def flaeche(groesse, hintergrund=None, radius=None):
    gross = groesse * SKALA
    bild = Image.new("RGBA", (gross, gross), (0, 0, 0, 0))
    z = ImageDraw.Draw(bild)
    if hintergrund is not None:
        if radius:
            z.rounded_rectangle([0, 0, gross - 1, gross - 1],
                                radius=radius * SKALA, fill=hintergrund)
        else:
            z.rectangle([0, 0, gross, gross], fill=hintergrund)
    return bild, z, gross


def in_sicherer_zone(groesse, farbe):
    """Haken auf 66 % verkleinert und mittig - fuer die Ebenen des Icons."""
    bild, _, gross = flaeche(groesse)
    voll = Image.new("RGBA", (gross, gross), (0, 0, 0, 0))
    haken(ImageDraw.Draw(voll), gross, 92 * SKALA * groesse / 1024, farbe)
    rand = (1 - SICHERE_ZONE) / 2
    klein = voll.resize((int(gross * SICHERE_ZONE),) * 2, Image.LANCZOS)
    bild.paste(klein, (int(gross * rand), int(gross * rand)), klein)
    return bild


def sichern(bild, groesse, ziel):
    bild.resize((groesse, groesse), Image.LANCZOS).save(ziel)
    print(f"  {ziel.relative_to(PROJEKT)}")


def app_icon():
    print("App:")

    bild, z, g = flaeche(1024, GRUEN, radius=225)
    haken(z, g, 92 * SKALA, WEISS)
    sichern(bild, 1024, ASSETS / "icon.png")

    sichern(in_sicherer_zone(512, WEISS), 512,
            ASSETS / "android-icon-foreground.png")

    bild, _, _ = flaeche(512, GRUEN)
    sichern(bild, 512, ASSETS / "android-icon-background.png")

    # Monochrom: nur die Form. Android faerbt sie selbst ein.
    sichern(in_sicherer_zone(432, WEISS), 432,
            ASSETS / "android-icon-monochrome.png")

    # Startbildschirm: gruen auf durchsichtig. Der Grund kommt aus
    # plugins/withAndroidBuildConfig.js - hell #FCFDF6, dunkel #1A1C19.
    # Gruen ist auf beiden lesbar, Weiss waere es nicht.
    bild, z, g = flaeche(1024)
    haken(z, g, 92 * SKALA, GRUEN)
    sichern(bild, 1024, ASSETS / "splash-icon.png")


def store_material():
    print("Store:")

    # Vollflaechig quadratisch und ohne Transparenz, anders als assets/icon.png.
    # Play rundet und beschattet selbst; transparente Ecken werden je nach
    # Oberflaeche schwarz statt durchsichtig dargestellt.
    bild, z, g = flaeche(1024, GRUEN)
    haken(z, g, 92 * SKALA, WEISS)
    sichern(bild.convert("RGB"), 512, STORE / "icon-512.png")

    feature_grafik()


def feature_grafik():
    """1024 x 500. Play beschneidet die Raender je nach Ansicht - deshalb
    bleibt alles Lesbare zwischen 140 und 950 px."""
    B, H = 1024 * SKALA, 500 * SKALA
    grafik = Image.new("RGB", (B, H), GRUEN)
    zg = ImageDraw.Draw(grafik)

    SYM = 240
    symbol = Image.new("RGBA", (SYM * SKALA,) * 2, (0, 0, 0, 0))
    zs = ImageDraw.Draw(symbol)
    zs.rounded_rectangle([0, 0, SYM * SKALA - 1, SYM * SKALA - 1],
                         radius=53 * SKALA, fill=CONTAINER)
    haken(zs, SYM * SKALA, 22 * SKALA, GRUEN)
    grafik.paste(symbol, (140 * SKALA, 130 * SKALA), symbol)

    links = 440 * SKALA
    try:
        titel = ImageFont.truetype(SCHRIFT, 66 * SKALA)
        unter = ImageFont.truetype(SCHRIFT, 29 * SKALA)
        try:
            titel.set_variation_by_name("Bold")
        except Exception:
            pass  # Statische Schrift statt variabler - sieht magerer aus, laeuft.
    except OSError as fehler:
        print(f"  Schrift nicht ladbar ({fehler}) - Grafik bleibt ohne Text")
    else:
        for schrift, text, farbe, y in (
            (titel, "To-Shopping", WEISS, 218),
            (unter, "Merkt sich, was du kaufst.", CONTAINER, 278),
            (unter, "Ohne Konto, alles bleibt lokal.", CONTAINER, 325),
        ):
            zg.text((links, y * SKALA), text, font=schrift, fill=farbe,
                    anchor="ls")
            rechts = (links + zg.textlength(text, font=schrift)) / SKALA
            if rechts > 950:
                print(f"  WARNUNG: '{text}' endet bei {rechts:.0f} px "
                      f"- Play kann das abschneiden")

    grafik.resize((1024, 500), Image.LANCZOS).save(STORE / "feature-graphic.png")
    print(f"  store/feature-graphic.png")


if __name__ == "__main__":
    app_icon()
    store_material()
