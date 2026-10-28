# ♥️ Herzeln – Der Runde Tisch (Multiplayer WebApp)

Moderne Echtzeit-Multiplayer-WebApp für das traditionelle Kartenspiel **Herzeln** (32 Blatt, 4 Spieler am runden Tisch, 6 Strafrunden, automatisches Rundenende bei Erreichen der **8,00 € Kassa**), optimiert für **Smartphone Portrait-Layout (Hochformat)** und vorbereitet für **Render.com**.

---

## 🌟 Features

- **Echtzeit-Multiplayer Lobby (wie UNO / Lobby-Basis)**:
  - Raumerstellung mit 4-stelligem Buchstaben-Code.
  - Direktbeitritt per WhatsApp-Einladungslink (`?room=CODE`) mit automatischem Ready-Status.
  - Automatische Übernahme des zuletzt genutzten Spielernamens (`localStorage`).
  - Bis zu 4 menschliche Spieler; freie Plätze am 4er-Tisch werden bei Spielstart automatisch mit taktischen KI-Bots aufgefüllt.
- **Original Herzeln-Regelwerk (Der Runde Tisch)**:
  - **32 Blatt** (7, 8, 9, 10, Bube, Dame, König, Ass in Kreuz ♣, Pik ♠, Herz ♥, Karo ♦) – jeder der 4 Spieler erhält exakt **8 Karten**.
  - **Farbbedienpflicht**: Automatische Zugvalidierung und visuelle Hervorhebung aller gültigen Handkarten.
  - **6 Runden & Dynamisches Rundenende bei 8,00 €**:
    1. **Runde 1 – Keine Stiche 🚫**: 1,00 € pro Stich.
    2. **Runde 2 – Keine Herzen ♥**: 1,00 € pro Herz im Stich.
    3. **Runde 3 – Keine Damen 👸**: 2,00 € pro Dame im Stich.
    4. **Runde 4 – Keine Asse 🅰️**: 2,00 € pro Ass im Stich.
    5. **Runde 5 – Erster & Letzter Stich ⚡**: Je 4,00 € für den 1. und den 8. Stich.
    6. **Runde 6 – Der Herz-König 👑**: 8,00 € für den Fang des Herz-Königs (♥K).
  - **Sofortiges Rundenende bei 8,00 € Kassa-Summe**: Sobald die 8,00 € in einer Runde erreicht sind (z. B. sobald der Herz-König in Runde 6 fällt oder alle 4 Damen in Runde 3 vergeben sind), endet die Runde sofort und das Abrechnungsfenster öffnet sich!
- **Transparente Kassa- & Gesamtabrechnung**:
  - Permanente Anzeige der aktuellen Runden-Kassa (`0,00 € / 8,00 €`) und der Gesamt-Kassa am Tisch.
  - Detaillierte Abrechnungstabelle nach jeder Runde (und jederzeit über den `💶 Kassa`-Button): Wer hat wie viel in dieser Runde und über alle 6 Runden hinweg bezahlt?
- **Handy Portrait-Layout (Hochformat)**:
  - Speziell für einhändige Smartphone-Bedienung im Hochformat gestaltet (inkl. Landscape-Sperre, `rem`-Skalierung, Wake Lock API gegen Display-Standby und umschaltbarem Französischen Skat-Blatt / Doppeldeutschen Blatt).

---

## 🚀 Lokaler Start

1. **Abhängigkeiten installieren**:
   ```bash
   npm install
   ```
2. **Server starten**:
   ```bash
   npm start
   ```
   *(Oder einfach Doppelklick auf `Start_Herzeln.bat`)*
3. **Im Browser öffnen**:
   - `http://localhost:3000`

