# ♥️ Herzeln – Der Runde Tisch (Multiplayer WebApp)

Moderne Echtzeit-Multiplayer-WebApp für das traditionelle Kartenspiel **Herzeln** am runden Tisch mit 7 Runden (6 Strafrunden + Finale: Unteranlegen / Dominos) und automatischer Kassa-Abrechnung. Optimiert für **Smartphone Portrait-Layout (Hochformat)** und vorbereitet für **Render.com**.

---

## 🌟 Features

- **Spieler-Auswahl & Modi**:
  - **4 Spieler (Standard)**: 32 Blatt (7 bis Ass in Kreuz ♣, Pik ♠, Herz ♥, Karo ♦) – jeder Spieler erhält 8 Karten. Gesamt-Kassa: 48,00 €.
  - **3 Spieler**: 24 Blatt (ohne 7er und 8er; Rangfolge 9 bis Ass) – jeder Spieler erhält 8 Karten. Gesamt-Kassa: 46,00 €.
- **Echtzeit-Multiplayer Lobby**:
  - Raumerstellung mit 4-stelligem Buchstaben-Code und Modus-Auswahl (3 oder 4 Spieler).
  - Die Lobby-Spieleranzeige passt sich automatisch an (z. B. `0/3` bzw. `0/4`).
  - Direktbeitritt per WhatsApp-Einladungslink (`?room=CODE`) mit automatischem Ready-Status.
  - Automatische Übernahme des zuletzt genutzten Spielernamens (`localStorage`).
  - Taktische KI-Bots übernehmen bei Verbindungsabbrüchen oder freien Plätzen.
- **Original Herzeln-Regelwerk (Der Runde Tisch)**:
  - **Farbbedienpflicht**: Automatische Zugvalidierung und visuelle Hervorhebung aller gültigen Handkarten.
  - **Die 7 Runden**:
    1. **Runde 1 – Keine Stiche 🚫**: 1,00 € pro Stich (max. 8,00 €).
    2. **Runde 2 – Keine Herzen ♥**: 1,00 € pro Herz im Stich (max. 8,00 € bei 4 Spielern, max. 6,00 € bei 3 Spielern).
    3. **Runde 3 – Keine Damen 👸**: 2,00 € pro Dame im Stich (max. 8,00 €).
    4. **Runde 4 – Keine Asse 🅰️**: 2,00 € pro Ass im Stich (max. 8,00 €).
    5. **Runde 5 – Erster & Letzter Stich ⚡**: Je 4,00 € für den 1. und den 8. Stich (max. 8,00 €).
    6. **Runde 6 – Der Herz-König 👑**: 8,00 € für den Fang des Herz-Königs (♥K).
    7. **Runde 7 – Finale: Unteranlegen (Dominos / Siebener raus) 🃏**:
       - Zwingender Start mit dem Kreuz-Buben (♣B).
       - Buben/Unter in die Breite, Farben nach oben (bis Ass) und nach unten (bis 7 bzw. bis 9 bei 3 Spielern).
       - **Auszahlung 4 Spieler**: 1. Platz: +24,00 € • 2. Platz: +16,00 € • 3. Platz: +8,00 € • 4. Platz: 0,00 €.
       - **Auszahlung 3 Spieler**: 1. Platz: +24,00 € • 2. Platz: +16,00 € • 3. Platz: Rest der Kassa (+6,00 €).
  - **Sofortiges Rundenende bei Kassa-Limit**: Sobald der maximale Runden-Betrag erreicht ist, endet die Stichrunde sofort und das Abrechnungsfenster öffnet sich!
- **Transparente Kassa & Bilanz**:
  - Permanente Anzeige der aktuellen Kassa und der Gesamt-Kassa am Tisch.
  - Detaillierte Abrechnungstabelle nach jeder Runde sowie Gesamtsieger-Podium nach Runde 7.
- **Atmosphäre & Sound**:
  - Authentische Soundeffekte beim Ausspielen von Karten und Stechen von Stichen.
  - Umschaltbares französisches Skat-Blatt und doppeldeutsches Blatt.
- **Handy Portrait-Layout (Hochformat)**:
  - Speziell für einhändige Smartphone-Bedienung im Hochformat gestaltet (inkl. Landscape-Sperre, `rem`-Skalierung, Wake Lock API gegen Display-Standby und blauem Vollbild-Button).

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
