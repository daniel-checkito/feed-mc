import React, { useMemo, useState, useRef } from 'react';
import Papa from 'papaparse';
import Tooltip from './Tooltip';

function normalizeKey(input) {
    const s = String(input ?? '');
    return s
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[^a-z0-9_ ]/g, '')
        .replace(/\s/g, '_');
}

function bestHeaderMatch(headers, candidates) {
    const safeHeaders = (Array.isArray(headers) ? headers : []).filter((h) => h !== null && h !== undefined);
    const safeCandidates = (Array.isArray(candidates) ? candidates : []).filter((c) => c !== null && c !== undefined);

    const normHeaders = safeHeaders.map((h) => ({ raw: h, norm: normalizeKey(h) }));
    const normCandidates = safeCandidates.map((c) => normalizeKey(c));

    for (const c of normCandidates) {
        const exact = normHeaders.find((h) => h.norm === c);
        if (exact) return exact.raw;
    }

    for (const c of normCandidates) {
        const contains = normHeaders.find((h) => h.norm.includes(c) || c.includes(h.norm));
        if (contains) return contains.raw;
    }

    return null;
}

// Content-based column detection: inspects first N rows to identify columns
// when header-name matching fails.
function detectFieldByContent(unmappedFields, headers, rows, sampleSize = 10) {
    const sample = rows.slice(0, Math.min(sampleSize, rows.length));
    const result = {};

    const fieldDetectors = {
        shipping_mode: (values) => {
            const nonEmpty = values.filter((v) => String(v ?? '').trim());
            return nonEmpty.length > 0 && nonEmpty.every((v) => /^(paket|spedition)$/i.test(String(v ?? '').trim()));
        },
        ean: (values) => {
            const nonEmpty = values.filter((v) => String(v ?? '').trim());
            if (nonEmpty.length < 3) return false;
            return nonEmpty.filter((v) => /^\d{8,14}$/.test(String(v ?? '').trim())).length / nonEmpty.length > 0.7;
        },
        price: (values) => {
            const nonEmpty = values.filter((v) => String(v ?? '').trim());
            if (nonEmpty.length < 3) return false;
            return (
                nonEmpty.filter((v) => {
                    const s = String(v ?? '')
                        .trim()
                        .replace(',', '.');
                    return /^\d+(\.\d{1,2})?$/.test(s) && parseFloat(s) > 0 && parseFloat(s) < 100000;
                }).length /
                    nonEmpty.length >
                0.7
            );
        },
        delivery_time: (values) => {
            const nonEmpty = values.filter((v) => String(v ?? '').trim());
            if (nonEmpty.length < 2) return false;
            return (
                nonEmpty.filter((v) =>
                    /\d+\s*(tage?|werktage?|arbeitstage?|wochen?|wk\.?|wt\.?|days?)/i.test(String(v ?? '')),
                ).length /
                    nonEmpty.length >
                0.5
            );
        },
        stock_amount: (values) => {
            const nonEmpty = values.filter((v) => String(v ?? '').trim());
            if (nonEmpty.length < 3) return false;
            return nonEmpty.filter((v) => /^\d+$/.test(String(v ?? '').trim())).length / nonEmpty.length > 0.8;
        },
        material: (values) => {
            const nonEmpty = values.filter((v) => String(v ?? '').trim());
            if (nonEmpty.length < 2) return false;
            const matWords =
                /holz|metall|stoff|leder|kunststoff|glas|eiche|kiefer|buche|mdf|aluminium|stahl|polyester|baumwolle|massiv|spanplatte/i;
            return nonEmpty.filter((v) => matWords.test(String(v ?? ''))).length / nonEmpty.length > 0.4;
        },
        color: (values) => {
            const nonEmpty = values.filter((v) => String(v ?? '').trim());
            if (nonEmpty.length < 2) return false;
            const colorWords =
                /schwarz|wei(ß|ss)|grau|braun|beige|blau|gr(ü|ue)n|rot|gelb|natur|anthrazit|silber|gold|cognac|creme|olive|lila|pink/i;
            return nonEmpty.filter((v) => colorWords.test(String(v ?? ''))).length / nonEmpty.length > 0.4;
        },
        brand: (values) => {
            const nonEmpty = values.filter((v) => String(v ?? '').trim());
            if (nonEmpty.length < 3) return false;
            // Brand: short strings, relatively few unique values (same brand repeated)
            const unique = new Set(
                nonEmpty.map((v) =>
                    String(v ?? '')
                        .trim()
                        .toLowerCase(),
                ),
            );
            return (
                unique.size <= Math.ceil(nonEmpty.length * 0.5) &&
                nonEmpty.every((v) => {
                    const s = String(v ?? '').trim();
                    return s.length >= 2 && s.length <= 40 && !/^\d+$/.test(s);
                })
            );
        },
        description: (values) => {
            const nonEmpty = values.filter((v) => String(v ?? '').trim());
            if (nonEmpty.length < 2) return false;
            return nonEmpty.filter((v) => String(v ?? '').trim().length > 80).length / nonEmpty.length > 0.5;
        },
        name: (values) => {
            const nonEmpty = values.filter((v) => String(v ?? '').trim());
            if (nonEmpty.length < 2) return false;
            return (
                nonEmpty.filter((v) => {
                    const s = String(v ?? '').trim();
                    return s.length >= 10 && s.length <= 200 && !/^\d+$/.test(s);
                }).length /
                    nonEmpty.length >
                0.7
            );
        },
    };

    const usedHeaders = new Set();

    for (const field of unmappedFields) {
        if (!fieldDetectors[field]) continue;
        for (const header of headers) {
            if (usedHeaders.has(header)) continue;
            const values = sample.map((r) => r[header]).filter((v) => v != null && v !== '');
            if (values.length && fieldDetectors[field](values)) {
                result[field] = header;
                usedHeaders.add(header);
                break;
            }
        }
    }

    return result;
}

const MC_BLUE = '#1553B6';

const MC_PFLICHT_COLS = [
    'name',
    'price',
    'seller_offer_id',
    'brand',
    'description',
    'delivery_time',
    'shipping_mode',
    'ean',
    // one of availability OR stock_amount is required (handled as OR in validation)
    'availability',
    'stock_amount',
    // Hauptbild
    'image_url',
];
// Stufe 2: Feed-Qualitätsscore – empfohlene Attribute (Score-relevant, 27 + Bildlink_2–10)
const MC_OPTIONAL_COLS = [
    // Frühere Pflichtfelder, jetzt empfohlen
    'category_path',
    'delivery_includes',
    'color',
    'material',
    'size',
    'size_height',
    'size_depth',
    'size_diameter',
    'manufacturer_name',
    'manufacturer_street',
    'manufacturer_postcode',
    'manufacturer_city',
    'manufacturer_country',
    'manufacturer_email',
    // Informationen (2)
    'deeplink',
    'model',
    // Produktmerkmale (7)
    'size_lying_surface',
    'size_seat_height',
    'ausrichtung',
    'style',
    'temper',
    'weight',
    'weight_capacity',
    // Medien extra (4 non-image)
    'youtube_link',
    'bild_3d_glb',
    'bild_3d_usdz',
    'assembly_instructions',
    // Funktion & Ausstattung (7)
    'illuminant_included',
    'incl_mattress',
    'incl_slatted_frame',
    'led_verbaut',
    'lighting_included',
    'set_includes',
    'socket',
    // Textilien & Polster (4)
    'care_instructions',
    'filling',
    'removable_cover',
    'suitable_for_allergic',
    // Nachweise (2)
    'energy_efficiency_category',
    'product_data_sheet',
    // Herstellerangaben (1)
    'manufacturer_phone_number',
];
const MC_PFLICHT_ALIASES = {
    ean: ['ean', 'gtin', 'gtin14', 'ean13', 'barcode'],
    brand: ['brand', 'marke'],
    category_path: ['category_path', 'kategorie', 'category', 'kategoriepfad'],
    description: ['description', 'beschreibung', 'desc'],
    name: ['name', 'title', 'titel', 'product_name', 'produktname'],
    seller_offer_id: [
        'seller_offer_id',
        'offer_id',
        'sku',
        'merchant_sku',
        'eindeutige_id',
        'eindeutige id',
        'unique_id',
    ],
    color: ['color', 'farbe', 'colour'],
    material: ['material', 'materials'],
    size: ['size', 'abmessung', 'dimension', 'größe', 'groesse', 'maße', 'masse'],
    size_depth: ['size_depth', 'tiefe', 'depth'],
    size_diameter: ['size_diameter', 'durchmesser', 'diameter'],
    size_height: ['size_height', 'höhe', 'hoehe', 'height'],
    image_url: ['image_url', 'image', 'img_url', 'bild', 'bild_url', 'bildlink_1', 'bildlink1'],
    manufacturer_name: ['manufacturer_name', 'manufacturer', 'hersteller'],
    manufacturer_street: ['manufacturer_street', 'hersteller_strasse', 'hersteller_straße'],
    manufacturer_postcode: ['manufacturer_postcode', 'hersteller_plz'],
    manufacturer_city: ['manufacturer_city', 'hersteller_stadt', 'hersteller_ort'],
    manufacturer_country: ['manufacturer_country', 'hersteller_land'],
    manufacturer_email: ['manufacturer_email', 'hersteller_email'],
    availability: ['availability', 'verfügbarkeit', 'verfuegbarkeit', 'lieferstatus'],
    delivery_time: ['delivery_time', 'lieferzeit', 'delivery time'],
    delivery_includes: ['delivery_includes', 'lieferumfang'],
    price: ['price', 'preis', 'vk', 'selling_price'],
    stock_amount: ['stock_amount', 'stock', 'bestand', 'quantity', 'qty'],
    shipping_mode: [
        'shipping_mode',
        'versandart',
        'shipping',
        'shipping_type',
        'delivery_mode',
        'lieferart',
        'versand_art',
        'shipment_mode',
        'transport_mode',
    ],
};
const MC_OPTIONAL_ALIASES = {
    deeplink: ['deeplink', 'link', 'url', 'produktlink'],
    model: ['model', 'modell'],
    size_lying_surface: ['size_lying_surface', 'liegefläche', 'liegeflaeche'],
    size_seat_height: ['size_seat_height', 'sitzhöhe', 'sitzhoehe'],
    ausrichtung: ['ausrichtung', 'orientation'],
    style: ['style', 'stil'],
    temper: ['temper', 'härte', 'haerte'],
    weight: ['weight', 'gewicht'],
    weight_capacity: ['weight_capacity', 'tragkraft', 'belastbarkeit'],
    youtube_link: ['youtube_link', 'youtube', 'video_link'],
    bild_3d_glb: ['bild_3d_glb', '3d_glb', 'glb'],
    bild_3d_usdz: ['bild_3d_usdz', '3d_usdz', 'usdz'],
    assembly_instructions: ['assembly_instructions', 'montageanleitung', 'aufbauanleitung'],
    illuminant_included: ['illuminant_included', 'leuchtmittel'],
    incl_mattress: ['incl_mattress', 'matratze_enthalten', 'mit_matratze'],
    incl_slatted_frame: ['incl_slatted_frame', 'lattenrost_enthalten'],
    led_verbaut: ['led_verbaut', 'led'],
    lighting_included: ['lighting_included', 'beleuchtung'],
    set_includes: ['set_includes', 'set_inhalt'],
    socket: ['socket', 'steckdose'],
    care_instructions: ['care_instructions', 'pflegehinweise'],
    filling: ['filling', 'füllung', 'fuellung'],
    removable_cover: ['removable_cover', 'abnehmbarer_bezug'],
    suitable_for_allergic: ['suitable_for_allergic', 'allergikergeeignet'],
    energy_efficiency_category: ['energy_efficiency_category', 'energieklasse'],
    product_data_sheet: ['product_data_sheet', 'datenblatt'],
    manufacturer_phone_number: ['manufacturer_phone_number', 'hersteller_telefon'],
};

// ── Translations ──────────────────────────────────────────────────────────────
const DE_T = {
    // Header
    stepUpload: 'Hochladen', stepMapping: 'Zuordnung', stepResults: 'Ergebnis', stepRecommendations: 'Empfehlungen',
    helpContact: 'Hilfe & Kontakt',
    // Step 1
    s1Heading: 'Feed hochladen',
    s1Sub: 'Laden Sie Ihren Angebotsfeed als CSV hoch. Wir prüfen alle Pflichtfelder und zeigen genau, welche Artikel Fehler haben.',
    fileReading: 'Wird gelesen…',
    fileLoaded: (n) => `${n} Artikel erkannt`,
    fileChange: 'Ändern',
    dropHeading: 'CSV-Datei hochladen',
    dropSub: 'Hierher ziehen oder klicken · max. 64 MB',
    warehouseLabel: 'Lagerstandort des Händlers',
    warehouseDE: 'Deutschland', warehouseNonDE: 'Außerhalb Deutschland',
    hsNote: 'HS-Code wird als Pflichtfeld geprüft.',
    continueBtn: (n) => `Weiter · ${n} Artikel geladen →`,
    uploadPrompt: 'Bitte Datei hochladen',
    feedGuide: 'Feedleitfaden', feedGuideSub: 'PDF · Vorschau & Download',
    feedTemplate: 'Feedvorlage', feedTemplateSub: 'XLSX · sofort herunterladen',
    // Step 2
    back: 'Zurück',
    wrongFileTitle: 'Diese Datei sieht nicht wie ein gültiger Produkt-Feed aus.',
    wrongFileDesc: 'Es konnten keine bekannten Spalten erkannt werden. Erwartete Spalten: ean, name, price, shipping_mode o. ä.',
    mappingTitle: 'Spalten-Zuordnung prüfen',
    mappingFound: (f, t) => `${f} von ${t} Feldern automatisch erkannt.`,
    mappingMissing: (n) => ` ${n} Pflichtfeld${n > 1 ? 'er' : ''} nicht gefunden.`,
    mappingWarning: 'Bitte ordnen Sie die rot markierten Pflichtfelder manuell zu, bevor Sie fortfahren.',
    notAssigned: '-- Nicht zugeordnet --',
    mainImageLabel: 'Hauptbild (+ Zusatzb.)',
    notDetected: '– nicht erkannt –',
    hiddenFields: (n) => `${n} weitere optionale Felder nicht im Feed erkannt`,
    startAnalysis: 'Analyse starten →',
    // Step 3
    newFeed: 'Neuen Feed prüfen',
    statusOk: 'Feed fehlerfrei — alle Artikel können gelistet werden.',
    statusErr: 'Fehler gefunden — bitte beheben und Feed erneut hochladen.',
    errorRateFmt: (r) => `Fehlerquote: ${r.replace('.', ',')}%`,
    analysisTitle: 'Pflichtfeldanalyse',
    analysisSummary: (t, v, e) => `${t} Felder · ${v} vollständig · ${e} fehlerhaft`,
    colField: 'FELD', colStatus: 'STATUS', colCoverage: 'ABDECKUNG',
    notInFeed: 'Nicht im Feed', complete: '✓ Vollständig',
    missingCount: (n) => `${n} fehlend`,
    statComplete: 'Vollständig', statErrors: 'Fehler', statTotal: 'Gesamt',
    tipComplete: 'Artikel ohne Fehler in Pflichtfeldern',
    tipErrors: 'Artikel mit mindestens einem Pflichtfeld-Fehler',
    tipTotal: 'Gesamtzahl Artikel im Feed',
    csvTitle: 'Fehlerbericht herunterladen',
    csvDesc: 'CSV mit allen Fehlern pro Zeile. Importieren Sie die Datei in Excel, um die Fehler zu beheben.',
    csvBtn: 'CSV herunterladen',
    topErrorsTitle: 'Häufigste Fehler',
    articles: (n) => `${n} Artikel`,
    // PDF modal
    pdfTitle: 'Feedleitfaden 2026', pdfDownload: 'Herunterladen',
    // CSV error messages
    csvFieldLabels: { name: 'Artikelname', brand: 'Marke', description: 'Beschreibung', ean: 'EAN', price: 'Preis', availability: 'Verfügbarkeit', stock_amount: 'Bestand', shipping_mode: 'Versandart', delivery_time: 'Lieferzeit', image_url: 'Bild', hs_code: 'HS-Code', seller_offer_id: 'Seller-ID' },
    csvErrMissing: (l) => `${l} fehlt`,
    csvErrPlaceholder: (l) => `${l}: Platzhalter-Wert`,
    csvErrTooShort: (l) => `${l}: zu kurz`,
    csvErrOneWord: (l) => `${l}: mind. 2 Wörter`,
    csvErrBware: (l) => `${l}: enthält "B-Ware"`,
    csvErrLength: (l) => `${l}: muss 13 oder 14 Zeichen haben`,
    csvErrInvalid: (l) => `${l}: ungültiger Wert`,
    csvErrFallback: (l) => `${l} fehlerhaft`,
    csvEanDup: 'EAN: doppelt vorhanden',
    csvNameDup: 'Artikelname: doppelt vorhanden',
    csvColPflicht: 'Fehler Pflichtfelder',
    csvColOptional: 'Fehler Optionale Felder',
    // Error group hints
    errGroups: [
        { key: 'name', label: 'Artikelname', hint: 'Fehlt, zu kurz, ein Wort oder doppelt' },
        { key: 'ean', label: 'EAN', hint: 'Nicht 13 oder 14 Zeichen oder doppelt' },
        { key: 'desc', label: 'Beschreibung', hint: 'Fehlt, unter 20 Zeichen oder B-Ware' },
        { key: 'img', label: 'Hauptbild', hint: 'Bild-URL fehlt' },
        { key: 'price', label: 'Preis / Lieferung', hint: 'Fehlt oder ungültig' },
        { key: 'brand', label: 'Marke', hint: 'Fehlt oder unter 2 Zeichen' },
        { key: 'mfr', label: 'Herstellerangaben', hint: 'Name, PLZ, Ort oder E-Mail fehlt' },
        { key: 'size', label: 'Maße', hint: 'Ungültiger Zahlenwert' },
        { key: 'hs_code', label: 'HS-Code', hint: 'Pflicht bei Lager außerhalb DE' },
    ],
    // Field labels
    fields: {
        name: 'Artikelname', price: 'Preis', seller_offer_id: 'Eigene Artikel-ID',
        brand: 'Marke', ean: 'EAN (GTIN14)', delivery_time: 'Lieferzeit',
        shipping_mode: 'Versandart', availability: 'Bestand / Verfügbarkeit',
        stock_amount: 'Bestand', image_url: 'Hauptbild', description: 'Beschreibung',
        hs_code: 'HS-Code', category_path: 'Kategoriepfad', delivery_includes: 'Lieferumfang',
        color: 'Farbe', material: 'Material', size: 'Maße (Gesamt)', size_height: 'Höhe',
        size_depth: 'Tiefe', size_diameter: 'Durchmesser', manufacturer_name: 'Herstellername',
        manufacturer_street: 'Herstellerstraße', manufacturer_postcode: 'Herstellerpostleitzahl',
        manufacturer_city: 'Herstellerstadt', manufacturer_country: 'Herstellerland',
        manufacturer_email: 'Hersteller-E-Mail', deeplink: 'Deeplink', model: 'Modellbezeichnung',
        size_lying_surface: 'Liegefläche', size_seat_height: 'Sitzhöhe', ausrichtung: 'Ausrichtung',
        style: 'Stil', temper: 'Härtegrad', weight: 'Gewicht', weight_capacity: 'Belastbarkeit',
        youtube_link: 'Youtube-Video', bild_3d_glb: '3D-Ansicht (GLB)', bild_3d_usdz: '3D-Ansicht (USDZ)',
        assembly_instructions: 'Montageanleitung', illuminant_included: 'Leuchtmittel inklusive',
        incl_mattress: 'Matratze inklusive', incl_slatted_frame: 'Lattenrost inklusive',
        led_verbaut: 'LED verbaut', lighting_included: 'Beleuchtung inklusive', set_includes: 'Set-Inhalt',
        socket: 'Steckdose/Anschluss', care_instructions: 'Pflegehinweise', filling: 'Füllung',
        removable_cover: 'Bezug abnehmbar', suitable_for_allergic: 'Allergikergeeignet',
        energy_efficiency_category: 'Energieeffizienzklasse', product_data_sheet: 'Produktdatenblatt',
        manufacturer_phone_number: 'Herstellertelefonnummer',
    },
    // How it works
    listableCount: (l, t) => `${l} / ${t} Artikel listbar`,
    statusBanner: (n, t) => `Bitte beheben Sie die Fehler und laden Sie den Feed erneut hoch. — ${n} von ${t} Artikeln betroffen`,
    hinweisTitle: 'Wichtige Hinweise zum Feed',
    hinweisBeforeNext: 'Vor dem nächsten Upload prüfen',
    hinweisPflicht: {
        label: 'PFLICHT', color: '#DC2626', bg: '#FEF2F2', border: '#FECACA',
        title: 'Kritische Anforderungen', sub: 'Bei Verstoß keine Listing',
        items: [
            'Ausschließlich Neuware zulässig im Feed',
            'EAN (GTIN) je Produkt – nur 1 EAN je Produkt, keine Duplikate',
            'Bestand oder Availability muss gesetzt sein',
            'HS-Code notwendig, wenn Lager außerhalb Deutschlands',
            'Eindeutige Seller_Offer_ID je Produkt',
            'Preis, Versandart und Lieferzeit vollständig angegeben',
            'Vollständige Herstellerangaben: Marke, Name, Adresse, E-Mail',
        ],
    },
    hinweisQuality: {
        label: 'QUALITÄT', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A',
        title: 'Sichtbarkeit & Darstellung', sub: 'Beeinflusst Conversion',
        items: [
            'Titelformat: Marke + Produktname + Produktart + Material + Farbe + Maße',
            'Bilder mind. 800 × 600 px – kein Logo/Wasserzeichen, Freisteller',
            'Nur YouTube-Links als Produkt-/Montagevideo zulässig',
            'Maße im Format HxTxB (cm) · Gewicht in kg oder g',
            '3D-Modelle (optional): GLB für Android & USDZ für iOS',
            'Material und Farbe (color) angegeben',
        ],
    },
    hinweisInhalt: {
        label: 'INHALT', color: '#1553B6', bg: '#EEF4FF', border: '#BFDBFE',
        title: 'Texte & Felder', sub: 'Best Practices',
        items: [
            'Beschreibung im HTML-Format – ohne Zeichenbegrenzung',
            'Keine Shop-/Händlertexte oder externen Links',
            'Kein Hinweis auf eigenen Kundenservice oder Lieferdienst',
            'Lieferumfang im Format „1x Tisch, 4x Stuhl"',
            'Leere Spalten leer lassen – kein „0", „X", „nicht vorhanden"',
            'Category_Path korrekt zugeordnet (z. B. Boxspringbett)',
        ],
    },
    portalUrl: 'mc.moebel.check24.de/settings/offerfeed',
    portalBtn: 'Zum Portal →',
    reuploadTitle: 'Korrigierten Feed hochladen',
    reuploadSub: 'Datei hier ablegen oder direkt im Händlerportal hochladen.',
    footerLeft: 'CHECK24 Feed Checker · Stand: 04/2026 · Hinweise basieren auf dem aktuellen Feedleitfaden',
    footerRight: 'v2.4.1 · haendler-support@check24.de',
    howTitle: 'So funktioniert es',
    howSummary: 'Laden Sie Ihren Angebotsfeed hoch – wir prüfen alle Pflichtfelder und zeigen genau, welche Artikel Fehler haben.',
    howSteps: [
        { n: 1, title: 'Feed hochladen', desc: 'CSV-Datei per Drag & Drop oder Klick hochladen' },
        { n: 2, title: 'Zuordnung prüfen', desc: 'Spalten werden automatisch erkannt und zugeordnet' },
        { n: 3, title: 'Fehler prüfen', desc: 'Alle Pflichtfelder werden auf Fehler geprüft' },
        { n: 4, title: 'Hinweise beachten', desc: 'Wichtige Anforderungen zum Feed lesen' },
        { n: 5, title: 'Fehler beheben', desc: 'Fehlerbericht als CSV herunterladen und korrigieren' },
        { n: 6, title: 'Produkte live schalten', desc: 'Sauberer Feed = schnelleres Listing, mehr Sichtbarkeit' },
    ],
    // Pflicht table field labels
    pflichtFields: [
        { key: 'name', label: 'Artikelname' }, { key: 'price', label: 'Preis' },
        { key: 'seller_offer_id', label: 'Eigene Artikel-ID' }, { key: 'brand', label: 'Marke' },
        { key: 'ean', label: 'EAN (GTIN14)' }, { key: 'delivery_time', label: 'Lieferzeit' },
        { key: 'shipping_mode', label: 'Versandart' }, { key: 'availability', label: 'Bestand / Verfügbarkeit' },
        { key: 'description', label: 'Beschreibung' }, { key: 'image_url', label: 'Hauptbild' },
    ],
    hsField: { key: 'hs_code', label: 'HS-Code' },
    qualityTitle: 'Tipps zur Feed-Qualität',
    qualityTips: [
        { field: 'name', icon: '✏️', title: 'Artikelname', tips: ['Mindestens 2 Wörter, aussagekräftig und spezifisch', 'Ideal: Marke + Produkt + Hauptattribut, z. B. „BRAND Sofa 3-Sitzer grau 180 cm"', 'Keine B-Ware-Hinweise oder generischen Begriffe wie „Produkt"', 'GTIN-konforme Bezeichnung, max. 255 Zeichen'] },
        { field: 'description', icon: '📝', title: 'Beschreibung', tips: ['Mindestens 100 Zeichen, besser 300–500 Zeichen', 'Wichtige Eigenschaften nennen: Material, Farbe, Maße, Besonderheiten', 'Keine reinen Aufzählungen – fließender Text wirkt besser', 'Keine Werbefloskeln wie „günstig" oder „Top-Qualität"'] },
        { field: 'ean', icon: '🔢', title: 'EAN (GTIN14)', tips: ['Muss 13 oder 14 Stellen lang sein (EAN-13 oder GTIN-14)', 'Muss eindeutig pro Artikel sein – keine Duplikate', 'Nicht erfundene oder Test-EANs verwenden', 'Handelsübliche GTIN aus GS1-Datenbank'] },
        { field: 'image_url', icon: '🖼️', title: 'Produktbild', tips: ['Freisteller auf weißem oder transparentem Hintergrund', 'Mindestens 600×600 Pixel, optimal 1000×1000+', 'Öffentlich erreichbare URL (kein Login erforderlich)', 'Kein Wasserzeichen, keine Preise im Bild'] },
        { field: 'price', icon: '💶', title: 'Preis & Lieferung', tips: ['Preis im Format 19.99 (Punkt als Dezimaltrennzeichen)', 'Versandart muss einen gültigen Wert enthalten', 'Lieferzeit als Werktage angeben, z. B. „3-5"', 'Verfügbarkeit / Bestand stets aktuell halten'] },
    ],
    qualityShowMore: 'Alle Tipps anzeigen',
    qualityShowLess: 'Weniger anzeigen',
    resourcesTitle: 'Ressourcen',
    recNextStep: 'Weiter zu Empfehlungen →',
    recTitle: (n) => `${n} Handlungsempfehlung${n !== 1 ? 'en' : ''} zur Fehlerbehebung`,
    recNoErrorsTitle: 'Feed fehlerfrei',
    recNoErrorsSub: 'Ihr Feed enthält keine Pflichtfeldfehler. Alle Artikel können gelistet werden.',
    recPriority: 'Kritisch',
    recAffected: (n) => `${n} Artikel betroffen`,
    recDownloadTitle: 'Fehlerbericht herunterladen',
    recDownloadDesc: 'CSV-Datei mit allen Fehlern je Zeile – importieren Sie diese in Excel, um gezielt die betroffenen Artikel zu korrigieren.',
    recDownloadBtn: 'Fehlerbericht als CSV herunterladen',
};

const EN_T = {
    stepUpload: 'Upload', stepMapping: 'Mapping', stepResults: 'Results', stepRecommendations: 'Recommendations',
    helpContact: 'Help & Contact',
    s1Heading: 'Upload Feed',
    s1Sub: 'Upload your product feed as a CSV file. We check all required fields and show exactly which items have errors.',
    fileReading: 'Reading…',
    fileLoaded: (n) => `${n} items detected`,
    fileChange: 'Change',
    dropHeading: 'Upload CSV file',
    dropSub: 'Drag here or click · max. 64 MB',
    warehouseLabel: 'Warehouse Location',
    warehouseDE: 'Germany', warehouseNonDE: 'Outside Germany',
    hsNote: 'HS Code will be validated as a required field.',
    continueBtn: (n) => `Continue · ${n} items loaded →`,
    uploadPrompt: 'Please upload a file',
    feedGuide: 'Feed Guide', feedGuideSub: 'PDF · Preview & Download',
    feedTemplate: 'Feed Template', feedTemplateSub: 'XLSX · download instantly',
    back: 'Back',
    wrongFileTitle: 'This file does not look like a valid product feed.',
    wrongFileDesc: 'No known columns could be detected. Expected columns: ean, name, price, shipping_mode etc.',
    mappingTitle: 'Review Column Mapping',
    mappingFound: (f, t) => `${f} of ${t} fields automatically detected.`,
    mappingMissing: (n) => ` ${n} required field${n > 1 ? 's' : ''} not found.`,
    mappingWarning: 'Please manually assign the red-highlighted required fields before continuing.',
    notAssigned: '-- Not assigned --',
    mainImageLabel: 'Main Image (+ Add.)',
    notDetected: '– not detected –',
    hiddenFields: (n) => `${n} more optional fields not detected in feed`,
    startAnalysis: 'Start Analysis →',
    newFeed: 'Check New Feed',
    statusOk: 'Feed is error-free — all items can be listed.',
    statusErr: 'Errors found — please fix and re-upload the feed.',
    errorRateFmt: (r) => `Error rate: ${r}%`,
    analysisTitle: 'Required Field Analysis',
    analysisSummary: (t, v, e) => `${t} fields · ${v} complete · ${e} with errors`,
    colField: 'FIELD', colStatus: 'STATUS', colCoverage: 'COVERAGE',
    notInFeed: 'Not in feed', complete: '✓ Complete',
    missingCount: (n) => `${n} missing`,
    statComplete: 'Complete', statErrors: 'Errors', statTotal: 'Total',
    tipComplete: 'Items with no errors in required fields',
    tipErrors: 'Items with at least one required field error',
    tipTotal: 'Total number of items in feed',
    csvTitle: 'Download Error Report',
    csvDesc: 'CSV with all errors per row. Import the file into Excel to fix the errors.',
    csvBtn: 'Download CSV',
    topErrorsTitle: 'Most Common Errors',
    articles: (n) => `${n} items`,
    pdfTitle: 'Feed Guide 2026', pdfDownload: 'Download',
    csvFieldLabels: { name: 'Item Name', brand: 'Brand', description: 'Description', ean: 'EAN', price: 'Price', availability: 'Availability', stock_amount: 'Stock', shipping_mode: 'Shipping Mode', delivery_time: 'Delivery Time', image_url: 'Image', hs_code: 'HS Code', seller_offer_id: 'Seller ID' },
    csvErrMissing: (l) => `${l} missing`,
    csvErrPlaceholder: (l) => `${l}: placeholder value`,
    csvErrTooShort: (l) => `${l}: too short`,
    csvErrOneWord: (l) => `${l}: at least 2 words required`,
    csvErrBware: (l) => `${l}: contains "used goods" label`,
    csvErrLength: (l) => `${l}: must be 13 or 14 characters`,
    csvErrInvalid: (l) => `${l}: invalid value`,
    csvErrFallback: (l) => `${l} error`,
    csvEanDup: 'EAN: duplicate',
    csvNameDup: 'Item Name: duplicate',
    csvColPflicht: 'Required Field Errors',
    csvColOptional: 'Optional Field Hints',
    errGroups: [
        { key: 'name', label: 'Item Name', hint: 'Missing, too short, one word, or duplicate' },
        { key: 'ean', label: 'EAN', hint: 'Not 13 or 14 characters or duplicate' },
        { key: 'desc', label: 'Description', hint: 'Missing, under 20 chars, or contains used-goods label' },
        { key: 'img', label: 'Main Image', hint: 'Image URL missing' },
        { key: 'price', label: 'Price / Delivery', hint: 'Missing or invalid' },
        { key: 'brand', label: 'Brand', hint: 'Missing or under 2 characters' },
        { key: 'mfr', label: 'Manufacturer Info', hint: 'Name, postcode, city, or email missing' },
        { key: 'size', label: 'Dimensions', hint: 'Invalid numeric value' },
        { key: 'hs_code', label: 'HS Code', hint: 'Required for warehouses outside Germany' },
    ],
    fields: {
        name: 'Item Name', price: 'Price', seller_offer_id: 'Own Item ID',
        brand: 'Brand', ean: 'EAN (GTIN14)', delivery_time: 'Delivery Time',
        shipping_mode: 'Shipping Mode', availability: 'Stock / Availability',
        stock_amount: 'Stock', image_url: 'Main Image', description: 'Description',
        hs_code: 'HS Code', category_path: 'Category Path', delivery_includes: 'Delivery Includes',
        color: 'Color', material: 'Material', size: 'Dimensions (Total)', size_height: 'Height',
        size_depth: 'Depth', size_diameter: 'Diameter', manufacturer_name: 'Manufacturer Name',
        manufacturer_street: 'Manufacturer Street', manufacturer_postcode: 'Manufacturer Postcode',
        manufacturer_city: 'Manufacturer City', manufacturer_country: 'Manufacturer Country',
        manufacturer_email: 'Manufacturer Email', deeplink: 'Deeplink', model: 'Model Name',
        size_lying_surface: 'Lying Surface', size_seat_height: 'Seat Height', ausrichtung: 'Orientation',
        style: 'Style', temper: 'Firmness', weight: 'Weight', weight_capacity: 'Load Capacity',
        youtube_link: 'YouTube Video', bild_3d_glb: '3D View (GLB)', bild_3d_usdz: '3D View (USDZ)',
        assembly_instructions: 'Assembly Instructions', illuminant_included: 'Bulb Included',
        incl_mattress: 'Mattress Included', incl_slatted_frame: 'Slatted Frame Included',
        led_verbaut: 'LED Built-in', lighting_included: 'Lighting Included', set_includes: 'Set Contents',
        socket: 'Socket/Connection', care_instructions: 'Care Instructions', filling: 'Filling',
        removable_cover: 'Removable Cover', suitable_for_allergic: 'Allergy-Friendly',
        energy_efficiency_category: 'Energy Efficiency Class', product_data_sheet: 'Product Data Sheet',
        manufacturer_phone_number: 'Manufacturer Phone Number',
    },
    pflichtFields: [
        { key: 'name', label: 'Item Name' }, { key: 'price', label: 'Price' },
        { key: 'seller_offer_id', label: 'Own Item ID' }, { key: 'brand', label: 'Brand' },
        { key: 'ean', label: 'EAN (GTIN14)' }, { key: 'delivery_time', label: 'Delivery Time' },
        { key: 'shipping_mode', label: 'Shipping Mode' }, { key: 'availability', label: 'Stock / Availability' },
        { key: 'description', label: 'Description' }, { key: 'image_url', label: 'Main Image' },
    ],
    hsField: { key: 'hs_code', label: 'HS Code' },
    qualityTitle: 'Feed Quality Tips',
    qualityTips: [
        { field: 'name', icon: '✏️', title: 'Item Name', tips: ['At least 2 words, descriptive and specific', 'Ideal: Brand + Product + Key Attribute, e.g. "BRAND Sofa 3-seater grey 180 cm"', 'No used-goods labels or generic terms like "product"', 'Max 255 characters'] },
        { field: 'description', icon: '📝', title: 'Description', tips: ['At least 100 characters, ideally 300–500', 'Include key attributes: material, color, dimensions, features', 'Flowing text works better than bullet lists alone', 'Avoid marketing phrases like "cheap" or "top quality"'] },
        { field: 'ean', icon: '🔢', title: 'EAN (GTIN14)', tips: ['Must be 13 or 14 digits (EAN-13 or GTIN-14)', 'Must be unique per item — no duplicates', 'Do not use invented or test EANs', 'Use a valid GTIN from the GS1 database'] },
        { field: 'image_url', icon: '🖼️', title: 'Product Image', tips: ['White or transparent background (cut-out)', 'At least 600×600 pixels, ideally 1000×1000+', 'Publicly accessible URL (no login required)', 'No watermarks or prices in the image'] },
        { field: 'price', icon: '💶', title: 'Price & Delivery', tips: ['Price in format 19.99 (dot as decimal separator)', 'Shipping mode must contain a valid value', 'Delivery time in working days, e.g. "3-5"', 'Keep availability/stock always up to date'] },
    ],
    qualityShowMore: 'Show all tips',
    qualityShowLess: 'Show less',
    resourcesTitle: 'Resources',
    recNextStep: 'Continue to Recommendations →',
    recTitle: (n) => `${n} Recommendation${n !== 1 ? 's' : ''} to Fix Errors`,
    recNoErrorsTitle: 'Feed error-free',
    recNoErrorsSub: 'Your feed has no required field errors. All items can be listed.',
    recPriority: 'Critical',
    recAffected: (n) => `${n} item${n !== 1 ? 's' : ''} affected`,
    recDownloadTitle: 'Download Error Report',
    recDownloadDesc: 'CSV file with all errors per row – import into Excel to fix the affected items directly.',
    recDownloadBtn: 'Download Error Report as CSV',
    listableCount: (l, t) => `${l} / ${t} items listable`,
    statusBanner: (n, t) => `Please fix the errors and re-upload the feed. — ${n} of ${t} items affected`,
    hinweisTitle: 'Important Feed Requirements',
    hinweisBeforeNext: 'Check before next upload',
    hinweisPflicht: {
        label: 'REQUIRED', color: '#DC2626', bg: '#FEF2F2', border: '#FECACA',
        title: 'Critical Requirements', sub: 'Violations prevent listing',
        items: [
            'Only new goods allowed in the feed',
            'EAN (GTIN) per product – only 1 EAN per product, no duplicates',
            'Stock or Availability must be set',
            'HS Code required if warehouse is outside Germany',
            'Unique Seller_Offer_ID per product',
            'Price, shipping mode, and delivery time fully provided',
            'Complete manufacturer info: brand, name, address, email',
        ],
    },
    hinweisQuality: {
        label: 'QUALITY', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A',
        title: 'Visibility & Presentation', sub: 'Affects conversion',
        items: [
            'Title format: Brand + Product name + Type + Material + Color + Size',
            'Images min. 800 × 600 px – no logos/watermarks, cut-out preferred',
            'Only YouTube links for product/assembly videos',
            'Dimensions in HxDxW (cm) · Weight in kg or g',
            '3D models (optional): GLB for Android & USDZ for iOS',
            'Material and color fields filled in',
        ],
    },
    hinweisInhalt: {
        label: 'CONTENT', color: '#1553B6', bg: '#EEF4FF', border: '#BFDBFE',
        title: 'Texts & Fields', sub: 'Best Practices',
        items: [
            'Description in HTML format – no character limit',
            'No shop/retailer texts or external links',
            'No reference to own customer service or delivery',
            'Delivery scope in format "1x Table, 4x Chair"',
            'Leave empty fields blank – no "0", "X", "not available"',
            'Category_Path correctly mapped (e.g. Boxspring bed)',
        ],
    },
    portalUrl: 'mc.moebel.check24.de/settings/offerfeed',
    portalBtn: 'Go to Portal →',
    reuploadTitle: 'Upload corrected feed',
    reuploadSub: 'Drop file here or upload directly in the merchant portal.',
    footerLeft: 'CHECK24 Feed Checker · As of 04/2026 · Notes based on current feed guide',
    footerRight: 'v2.4.1 · haendler-support@check24.de',
    // How it works
    howTitle: 'How it works',
    howSummary: 'Upload your product feed – we check all required fields and show exactly which items have errors.',
    howSteps: [
        { n: 1, title: 'Upload feed', desc: 'Drop your CSV file or click to browse' },
        { n: 2, title: 'Review mapping', desc: 'Columns are detected and matched automatically' },
        { n: 3, title: 'Check errors', desc: 'All required fields are checked for errors' },
        { n: 4, title: 'Read requirements', desc: 'Review important feed requirements' },
        { n: 5, title: 'Fix errors', desc: 'Download error report as CSV and correct' },
        { n: 6, title: 'Go live', desc: 'Clean feed = faster listing, more visibility' },
    ],
};

export default function McAngebotsfeed() {
    const showQualityScore = false; // not public yet - re-enable when ready

    const [file, setFile] = useState(null);
    const [dragging, setDragging] = useState(false);
    const [showLeitfaden, setShowLeitfaden] = useState(false);
    const [storeLocation, setStoreLocation] = useState('germany');
    const [step, setStep] = useState(1);
    const [rows, setRows] = useState([]);
    const [headers, setHeaders] = useState([]);
    const [manualMapping, setManualMapping] = useState({});
    const [mappingExpanded, setMappingExpanded] = useState(false);
    const [lang, setLang] = useState('de');
    const [langOpen, setLangOpen] = useState(false);
    const fileRef = useRef(null);

    function parseFile(f) {
        if (!f) return;
        const ext = f.name.split('.').pop().toLowerCase();
        if (ext !== 'csv' && f.type !== 'text/csv' && f.type !== 'application/csv') return;
        setFile(f);
        setRows([]);
        setHeaders([]);
        setManualMapping({});
        const tryParseMc = (encoding) => {
            const reader = new FileReader();
            reader.onload = (evt) => {
                const text = evt.target?.result;
                if (typeof text !== 'string') return;
                if (encoding === 'UTF-8' && /Ã¤|Ã¶|Ã¼|Ã\x84|Ã\x96|Ã\x9C|Ã\x9F/.test(text)) {
                    tryParseMc('windows-1252');
                    return;
                }
                Papa.parse(text, {
                    header: true,
                    skipEmptyLines: true,
                    complete: (res) => {
                        const r = Array.isArray(res.data) ? res.data : [];
                        const h = res.meta?.fields || Object.keys(r[0] || {});
                        setHeaders(h);
                        setRows(r);
                    },
                });
            };
            reader.readAsText(f, encoding);
        };
        tryParseMc('UTF-8');
    }

    // ── Same 3-tier mapping as Feed Analyse tab ──

    // Tier 1: auto-detect by header name (uses same bestHeaderMatch + synonyms)
    const mcAutoMapping = useMemo(() => {
        if (!headers.length) return {};
        const m = {};
        for (const key of MC_PFLICHT_COLS) {
            if (key === 'image_url') continue; // image cols handled via imageColumns
            m[key] = bestHeaderMatch(headers, MC_PFLICHT_ALIASES[key] || [key]) || null;
        }
        for (const key of MC_OPTIONAL_COLS) {
            m[key] = bestHeaderMatch(headers, MC_OPTIONAL_ALIASES[key] || [key]) || null;
        }
        m['hs_code'] = bestHeaderMatch(headers, ['hs_code', 'hs-code', 'hscode', 'zolltarifnummer', 'taric']) || null;
        return m;
    }, [headers]);

    // Tier 2: content-based fallback for fields not found by name
    const mcContentMapping = useMemo(() => {
        if (!headers.length || !rows.length) return {};
        const allFields = [...MC_PFLICHT_COLS.filter((f) => f !== 'image_url'), ...MC_OPTIONAL_COLS];
        const unmapped = allFields.filter((f) => !mcAutoMapping[f]);
        if (!unmapped.length) return {};
        return detectFieldByContent(unmapped, headers, rows);
    }, [headers, rows, mcAutoMapping]);

    // Final mapping: auto → content → manual overrides
    const mcMapping = useMemo(
        () => ({ ...mcAutoMapping, ...mcContentMapping, ...manualMapping }),
        [mcAutoMapping, mcContentMapping, manualMapping],
    );

    // Image columns (all headers that look like images)
    const mcImageColumns = useMemo(
        () =>
            headers.filter((h) => {
                const n = h.toLowerCase();
                return n.includes('image') || n.includes('bild') || n.includes('img');
            }),
        [headers],
    );

    // Reactive analysis - re-runs whenever mapping or rows change
    // Implements Zwei-Stufen-Modell: Stufe 1 (Hard Gate) + Stufe 2 (Soft Score)
    const issues = useMemo(() => {
        if (!rows.length || !headers.length) return null;

        const outsideGermany = storeLocation === 'outside_germany';

        const missingPflichtCols = MC_PFLICHT_COLS.filter((c) => {
            if (c === 'image_url') return mcImageColumns.length === 0;
            if (c === 'stock_amount') return false; // handled together with availability
            if (c === 'availability') return !mcMapping['availability'] && !mcMapping['stock_amount'];
            return !mcMapping[c];
        });
        if (outsideGermany && !mcMapping['hs_code']) {
            missingPflichtCols.push('hs_code');
        }
        const missingOptionalCols = MC_OPTIONAL_COLS.filter((c) => !mcMapping[c]);

        const pflichtErrors = [];
        const optionalHints = [];
        const duplicateEans = {};
        const duplicateNames = {};
        const duplicateNameEans = {};
        let pflichtOkCount = 0;
        let totalOptionalFieldsPresent = 0;
        // Stufe 2: 27 recommended cols + 9 extra image slots (Bildlink_2–10)
        const optionalFieldCount = MC_OPTIONAL_COLS.length + 9;

        const pflichtErrorRowNums = new Set();

        // Placeholder patterns: common filler values that are not real data
        const PLACEHOLDER_RE = /^(n\/?a|tbd|test|xxx+|leer|placeholder|example|musterwert|beispiel|0{4,}|null|undefined|-)$/i;
        const isPlaceholder = (v) => PLACEHOLDER_RE.test(v);

        rows.forEach((row, i) => {
            const rn = i + 1;
            const ean = mcMapping.ean ? String(row[mcMapping.ean] ?? '').trim() : '';
            const name = mcMapping.name ? String(row[mcMapping.name] ?? '').trim() : '';
            let pflichtOk = true;
            let optionalFieldsPresent = 0;

            for (const key of MC_PFLICHT_COLS) {
                if (key === 'image_url') continue;
                if (key === 'stock_amount') continue; // handled with availability below
                if (key === 'availability') {
                    const avVal = mcMapping.availability ? String(row[mcMapping.availability] ?? '').trim() : '';
                    const stVal = mcMapping.stock_amount ? String(row[mcMapping.stock_amount] ?? '').trim() : '';
                    if (!avVal && !stVal) {
                        pflichtErrors.push({ row: rn, ean, field: 'availability', type: 'missing' });
                        pflichtOk = false;
                    } else {
                        if (avVal && isPlaceholder(avVal)) {
                            pflichtErrors.push({ row: rn, ean, field: 'availability', type: 'placeholder', value: avVal });
                            pflichtOk = false;
                        }
                        if (stVal && !/^\d+$/.test(stVal)) {
                            pflichtErrors.push({ row: rn, ean, field: 'stock_amount', type: 'invalid', value: stVal });
                            pflichtOk = false;
                        }
                    }
                    continue;
                }
                const col = mcMapping[key];
                if (!col) continue;
                const val = String(row[col] ?? '').trim();
                if (!val) {
                    pflichtErrors.push({ row: rn, ean, field: key, type: 'missing' });
                    pflichtOk = false;
                    continue;
                }
                if (isPlaceholder(val)) {
                    pflichtErrors.push({ row: rn, ean, field: key, type: 'placeholder', value: val });
                    pflichtOk = false;
                    continue;
                }
                if (key === 'name') {
                    if (val.length < 10) {
                        pflichtErrors.push({ row: rn, ean, field: 'name', type: 'too_short', value: val });
                        pflichtOk = false;
                    } else if (val.trim().split(/\s+/).length < 2) {
                        pflichtErrors.push({ row: rn, ean, field: 'name', type: 'one_word', value: val });
                        pflichtOk = false;
                    }
                }
                if (key === 'brand' && val.length < 2) {
                    pflichtErrors.push({ row: rn, ean, field: 'brand', type: 'too_short', value: val });
                    pflichtOk = false;
                }
                if (key === 'description') {
                    if (val.length < 20) {
                        pflichtErrors.push({ row: rn, ean, field: 'description', type: 'too_short', value: val });
                        pflichtOk = false;
                    } else if (/b-?ware/i.test(val)) {
                        pflichtErrors.push({ row: rn, ean, field: 'description', type: 'bware', value: val });
                        pflichtOk = false;
                    }
                }
                if (key === 'price') {
                    const n = parseFloat(val.replace(',', '.'));
                    if (Number.isNaN(n) || n <= 0) {
                        pflichtErrors.push({ row: rn, ean, field: key, type: 'invalid', value: val });
                        pflichtOk = false;
                    }
                }
                if (key === 'shipping_mode' && val.toLowerCase() !== 'paket' && val.toLowerCase() !== 'spedition') {
                    pflichtErrors.push({ row: rn, ean, field: key, type: 'invalid', value: val });
                    pflichtOk = false;
                }
                if (key === 'ean') {
                    if (val.length !== 13 && val.length !== 14) {
                        pflichtErrors.push({ row: rn, ean, field: 'ean', type: 'wrong_length', value: val });
                        pflichtOk = false;
                    }
                }
            }
            if (mcImageColumns.length > 0) {
                const imgCount = mcImageColumns.reduce((c, col) => c + (String(row[col] ?? '').trim() ? 1 : 0), 0);
                if (imgCount === 0) {
                    pflichtErrors.push({ row: rn, ean, field: 'image_url', type: 'missing' });
                    pflichtOk = false;
                }
            }
            if (outsideGermany && mcMapping['hs_code']) {
                const hsVal = String(row[mcMapping['hs_code']] ?? '').trim();
                if (!hsVal) {
                    pflichtErrors.push({ row: rn, ean, field: 'hs_code', type: 'missing' });
                    pflichtOk = false;
                } else if (isPlaceholder(hsVal)) {
                    pflichtErrors.push({ row: rn, ean, field: 'hs_code', type: 'placeholder', value: hsVal });
                    pflichtOk = false;
                }
            }

            // Stufe 2: recommended field fill rate
            for (const key of MC_OPTIONAL_COLS) {
                const col = mcMapping[key];
                if (!col) continue;
                if (!String(row[col] ?? '').trim()) {
                    optionalHints.push({ row: rn, ean, field: key });
                } else {
                    optionalFieldsPresent++;
                }
            }
            // Extra image slots (Bildlink_2 to Bildlink_10 = up to 9 bonus slots)
            const extraImageCols = mcImageColumns.slice(1, 10);
            optionalFieldsPresent += extraImageCols.filter((col) => String(row[col] ?? '').trim()).length;

            // EAN tracking (Stufe 1: duplicates = hard error)
            if (ean) {
                if (!duplicateEans[ean]) duplicateEans[ean] = [];
                duplicateEans[ean].push(rn);
            }
            // Name dedup tracking (Stufe 1: duplicate names = hard error)
            if (name) {
                if (!duplicateNames[name]) duplicateNames[name] = [];
                duplicateNames[name].push(rn);
            }
            // Name+EAN tracking (Stufe 2: identical name+EAN = malus)
            if (name && ean) {
                const k = `${name}|||${ean}`;
                if (!duplicateNameEans[k]) duplicateNameEans[k] = [];
                duplicateNameEans[k].push(rn);
            }

            if (pflichtOk) {
                pflichtOkCount++;
            } else {
                pflichtErrorRowNums.add(rn);
            }
            totalOptionalFieldsPresent += optionalFieldsPresent;
        });

        // Stufe 1: EAN duplicates are a hard gate error
        const dupEanCount = Object.values(duplicateEans)
            .filter((r) => r.length > 1)
            .reduce((s, r) => s + r.length, 0);
        const eanDupRows = new Set(
            Object.values(duplicateEans)
                .filter((r) => r.length > 1)
                .flat(),
        );
        // Stufe 1: Name duplicates are a hard gate error
        const dupNameCount = Object.values(duplicateNames)
            .filter((r) => r.length > 1)
            .reduce((s, r) => s + r.length, 0);
        const nameDupRows = new Set(
            Object.values(duplicateNames)
                .filter((r) => r.length > 1)
                .flat(),
        );
        // Stufe 1: live-fähig = no pflicht errors AND no EAN/Name duplicate
        const livefaehigCount = rows.filter((_, i) => !pflichtErrorRowNums.has(i + 1) && !eanDupRows.has(i + 1) && !nameDupRows.has(i + 1)).length;

        // Stufe 2: name+EAN duplicate malus (same product listed twice)
        const dupNameEanCount = Object.values(duplicateNameEans)
            .filter((r) => r.length > 1)
            .reduce((s, r) => s + r.length, 0);

        // Categorise Stufe 1 errors by attribute group
        const PFLICHT_CAT = {
            ean: 'informationen',
            brand: 'informationen',
            category_path: 'informationen',
            description: 'informationen',
            name: 'informationen',
            seller_offer_id: 'informationen',
            color: 'produktmerkmale',
            material: 'produktmerkmale',
            size: 'produktmerkmale',
            size_depth: 'produktmerkmale',
            size_diameter: 'produktmerkmale',
            size_height: 'produktmerkmale',
            image_url: 'medien',
            manufacturer_name: 'hersteller',
            manufacturer_street: 'hersteller',
            manufacturer_postcode: 'hersteller',
            manufacturer_city: 'hersteller',
            manufacturer_country: 'hersteller',
            manufacturer_email: 'hersteller',
            availability: 'preis',
            delivery_time: 'preis',
            delivery_includes: 'preis',
            price: 'preis',
            stock_amount: 'preis',
            shipping_mode: 'versand',
        };
        const catRows = {
            informationen: new Set(),
            produktmerkmale: new Set(),
            medien: new Set(),
            hersteller: new Set(),
            preis: new Set(),
            versand: new Set(),
        };
        pflichtErrors.forEach((e) => {
            const c = PFLICHT_CAT[e.field];
            if (c) catRows[c].add(e.row);
        });
        eanDupRows.forEach((rn) => catRows.informationen.add(rn));
        nameDupRows.forEach((rn) => catRows.informationen.add(rn));
        const pflichtCategoryErrors = Object.fromEntries(Object.entries(catRows).map(([k, s]) => [k, s.size]));

        // Scoring (Stufe 2) – Pflichtfelder-Score (max. 70) + Empfohlene-Felder-Score (max. 30)
        const pflichtScore = rows.length ? Math.round((pflichtOkCount / rows.length) * 70) : 0;
        const optionalFillRatio =
            rows.length && optionalFieldCount > 0 ? totalOptionalFieldsPresent / (rows.length * optionalFieldCount) : 0;
        const optionalScore = Math.round(optionalFillRatio * 30);
        const totalScore = Math.max(0, Math.min(100, pflichtScore + optionalScore));

        return {
            totalRows: rows.length,
            pflichtMapping: MC_PFLICHT_COLS.reduce((m, k) => {
                m[k] = k === 'image_url' ? mcImageColumns[0] || null : mcMapping[k] || null;
                return m;
            }, {}),
            optionalMapping: MC_OPTIONAL_COLS.reduce((m, k) => {
                m[k] = mcMapping[k] || null;
                return m;
            }, {}),
            imageColumns: mcImageColumns,
            missingPflichtCols,
            missingOptionalCols,
            pflichtErrors,
            optionalHints,
            pflichtOkCount,
            livefaehigCount,
            blockiertCount: rows.length - livefaehigCount,
            totalOptionalFieldsPresent,
            optionalFieldCount,
            dupEanCount,
            dupNameCount,
            dupNameEanCount,
            eanDupRows,
            nameDupRows,
            pflichtCategoryErrors,
            pflichtScore,
            optionalScore,
            optionalFillRatio,
            totalScore,
        };
    }, [rows, headers, mcMapping, mcImageColumns, storeLocation]);

    const mcIsWrongFile =
        rows.length > 0 && Object.values(mcMapping).filter(Boolean).length === 0 && mcImageColumns.length === 0;

    const outsideGermany = storeLocation === 'outside_germany';

    const T = lang === 'de' ? DE_T : EN_T;
    const numLocale = lang === 'de' ? 'de-DE' : 'en-US';

    function resetToStart() {
        setFile(null);
        setRows([]);
        setHeaders([]);
        setManualMapping({});
        setStep(1);
    }

    const FIELD_LABELS = T.fields;
    const PFLICHT_TABLE_FIELDS = [...T.pflichtFields, ...(outsideGermany ? [T.hsField] : [])];

    // ── Per-field error rows (for step 3 table) ──
    const fieldErrorRows = {};
    if (issues) {
        issues.pflichtErrors.forEach((e) => {
            const k = e.field === 'stock_amount' ? 'availability' : e.field;
            if (!fieldErrorRows[k]) fieldErrorRows[k] = new Set();
            fieldErrorRows[k].add(e.row);
        });
        issues.eanDupRows.forEach((rn) => {
            if (!fieldErrorRows.ean) fieldErrorRows.ean = new Set();
            fieldErrorRows.ean.add(rn);
        });
        issues.nameDupRows.forEach((rn) => {
            if (!fieldErrorRows.name) fieldErrorRows.name = new Set();
            fieldErrorRows.name.add(rn);
        });
    }

    const errorRate = issues ? (issues.blockiertCount / issues.totalRows) * 100 : 0;
    const stufe1Passed = issues ? errorRate <= 5 : false;

    return (
        <div style={{ background: '#F3F4F6', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* ── HEADER ── */}
            <header style={{ background: MC_BLUE, padding: '10px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                <span style={{ color: '#FFF', fontWeight: 900, fontSize: 22, letterSpacing: '-0.5px', fontStyle: 'italic', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    FEED CHECKER
                </span>

                {/* Header resource buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button type="button" onClick={() => setShowLeitfaden(true)}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid rgba(255,255,255,0.3)', background: 'transparent', color: '#FFF', fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 6, cursor: 'pointer' }}>
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M2.5 1.5h8.5l3 3v10h-11.5v-13z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/><path d="M11 1.5v3h3" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/><path d="M5 8h6M5 10.5h6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                        {T.feedGuide}
                    </button>
                    <button type="button" onClick={() => { const a = document.createElement('a'); a.href = 'http://media-partner.moebel.check24.de/feedvorlagen/Feedleitfaden_Anhang_2026/CHECK24_Feedvorlage_V2025.xlsx'; a.download = 'CHECK24_Feedvorlage_V2025.xlsx'; a.click(); }}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid rgba(255,255,255,0.3)', background: 'transparent', color: '#FFF', fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 6, cursor: 'pointer' }}>
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M8 2v8M5 7l3 3 3-3M2 13h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        {T.feedTemplate}
                    </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {/* Language dropdown */}
                    <div style={{ position: 'relative' }}>
                        <button type="button" onClick={() => setLangOpen((v) => !v)}
                            style={{ display: 'flex', alignItems: 'center', gap: 7, background: langOpen ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: langOpen ? '8px 8px 0 0' : 8, padding: '6px 12px', cursor: 'pointer', color: '#FFF', fontSize: 13, fontWeight: 600, transition: 'background 0.15s' }}>
                            <span style={{ fontSize: 16, lineHeight: 1 }}>{lang === 'de' ? '🇩🇪' : '🇬🇧'}</span>
                            <span>{lang === 'de' ? 'Deutsch' : 'English'}</span>
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ opacity: 0.8, transform: langOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}><path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </button>
                        {langOpen && (
                            <>
                                {/* Click-outside backdrop */}
                                <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setLangOpen(false)} />
                                <div style={{ position: 'absolute', top: '100%', right: 0, background: '#FFF', borderRadius: '0 0 8px 8px', border: '1px solid rgba(255,255,255,0.25)', boxShadow: '0 8px 24px rgba(0,0,0,0.18)', overflow: 'hidden', zIndex: 100, minWidth: '100%' }}>
                                    {[{ value: 'de', flag: '🇩🇪', label: 'Deutsch' }, { value: 'en', flag: '🇬🇧', label: 'English' }].map((opt) => (
                                        <button key={opt.value} type="button"
                                            onClick={() => { setLang(opt.value); setLangOpen(false); }}
                                            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', background: lang === opt.value ? '#EEF4FF' : '#FFF', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: lang === opt.value ? 700 : 400, color: lang === opt.value ? MC_BLUE : '#374151', whiteSpace: 'nowrap' }}>
                                            <span style={{ fontSize: 16 }}>{opt.flag}</span>
                                            {opt.label}
                                            {lang === opt.value && <svg width="11" height="11" viewBox="0 0 11 11" fill="none" style={{ marginLeft: 'auto' }}><path d="M2 5.5l2.5 2.5 4.5-4.5" stroke={MC_BLUE} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                    <a
                        href="mailto:contentmanagement.moebel@check24.de?subject=Feed%20Checker%20-%20Hilfe"
                        style={{ border: '1px solid rgba(255,255,255,0.3)', background: 'transparent', color: '#FFFFFF', fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
                    >
                        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ flexShrink: 0 }}><rect x="1" y="2.5" width="11" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M1 4l5.5 3.5L12 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
                        {T.helpContact}
                    </a>
                </div>
            </header>
        {/* ── FUNNEL BODY ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 32px 0', overflow: 'hidden', boxSizing: 'border-box' }}>

            {/* Step indicator */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
                {[
                    { n: 1, label: T.stepUpload },
                    { n: 2, label: T.stepMapping },
                    { n: 3, label: T.stepResults },
                    { n: 4, label: T.stepRecommendations },
                ].map((s, i) => (
                    <React.Fragment key={s.n}>
                        {i > 0 && (
                            <div style={{ width: 48, height: 2, background: step > s.n ? MC_BLUE : step === s.n ? '#CBD5E1' : '#E5E7EB', margin: '0 4px', marginBottom: 18, borderRadius: 1 }} />
                        )}
                        <button
                            type="button"
                            onClick={() => {
                                if (s.n === 1) setStep(1);
                                else if (s.n === 2 && rows.length > 0) setStep(2);
                                else if ((s.n === 3 || s.n === 4) && issues) setStep(s.n);
                            }}
                            style={{ background: 'none', border: 'none', padding: 0, cursor: (s.n === 1 || (s.n === 2 && rows.length > 0) || ((s.n === 3 || s.n === 4) && issues)) ? 'pointer' : 'default', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}
                        >
                            <div style={{
                                width: 28, height: 28, borderRadius: '50%',
                                background: step > s.n ? MC_BLUE : step === s.n ? MC_BLUE : '#E5E7EB',
                                color: step >= s.n ? '#FFF' : '#9CA3AF',
                                fontSize: 11, fontWeight: 800,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'all 0.2s',
                                opacity: (s.n === 1 || (s.n === 2 && rows.length > 0) || ((s.n === 3 || s.n === 4) && issues)) ? 1 : 0.5,
                            }}>
                                {step > s.n ? '✓' : s.n}
                            </div>
                            <span style={{ fontSize: 10, color: step === s.n ? '#111827' : '#9CA3AF', fontWeight: step === s.n ? 700 : 400, whiteSpace: 'nowrap' }}>
                                {s.label}
                            </span>
                        </button>
                    </React.Fragment>
                ))}
            </div>

            {/* Status banner — shown in steps 3/4 when errors exist */}
            {(step === 3 || step === 4) && issues && !stufe1Passed && (
                <div style={{ width: '100%', maxWidth: step === 3 ? 1280 : 1200, marginBottom: 10, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}><circle cx="8" cy="8" r="6.5" stroke="#DC2626" strokeWidth="1.4"/><path d="M8 5v3.5" stroke="#DC2626" strokeWidth="1.4" strokeLinecap="round"/><circle cx="8" cy="11" r=".6" fill="#DC2626"/></svg>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#991B1B' }}>{T.statusBanner(issues.blockiertCount.toLocaleString(numLocale), issues.totalRows.toLocaleString(numLocale))}</span>
                    </div>
                    <button type="button" onClick={() => setStep(4)} style={{ fontSize: 12, fontWeight: 600, color: MC_BLUE, background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        {lang === 'de' ? 'Empfehlungen ansehen →' : 'View recommendations →'}
                    </button>
                </div>
            )}

            <div style={{ display: 'contents' }}>

            {/* ══════════════════════════════════════════
                STEP 1 — Upload
            ══════════════════════════════════════════ */}
            {step === 1 && (
                <div style={{ width: '100%', maxWidth: 1100, display: 'flex', flexDirection: 'column', gap: 14 }}>

                    {/* Title row — above both columns */}
                    <div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#111827', marginBottom: 3 }}>{T.howTitle}</div>
                        <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.5 }}>{T.howSummary}</div>
                    </div>

                    {/* Two columns aligned at the same top */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 16, alignItems: 'start' }}>

                        {/* Left: How it works */}
                        <div style={{ background: '#FFF', borderRadius: 10, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
                            {T.howSteps.map((s, i) => (
                                <div key={s.n} style={{ padding: '10px 14px', borderBottom: i < T.howSteps.length - 1 ? '1px solid #F3F4F6' : 'none', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: MC_BLUE, color: '#FFF', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{s.n}</div>
                                    <div>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: '#111827', marginBottom: 1 }}>{s.title}</div>
                                        <div style={{ fontSize: 11, color: '#6B7280', lineHeight: 1.35 }}>{s.desc}</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Right: Upload card */}
                        <div style={{ background: '#FFF', borderRadius: 12, padding: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>
                        {/* Drop zone */}
                        {file ? (
                            <div style={{ borderRadius: 8, border: '2px solid #BBF7D0', background: '#F0FDF4', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2.5 1.5h8.5l3 3v10h-11.5v-13z" stroke="#16A34A" strokeWidth="1.4" strokeLinejoin="round"/><path d="M11 1.5v3h3" stroke="#16A34A" strokeWidth="1.4" strokeLinejoin="round"/><path d="M5 8.5l2 2 4-3" stroke="#16A34A" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: '#166534', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
                                    <div style={{ fontSize: 11, color: '#4B7A5A', marginTop: 2 }}>{(file.size / 1024).toFixed(1)} KB · {rows.length > 0 ? T.fileLoaded(rows.length.toLocaleString(numLocale)) : T.fileReading}</div>
                                </div>
                                <button type="button" onClick={() => { setFile(null); setRows([]); setHeaders([]); setManualMapping({}); }}
                                    style={{ fontSize: 11, color: '#6B7280', background: 'none', border: '1px solid #D1D5DB', borderRadius: 5, padding: '4px 10px', cursor: 'pointer' }}>
                                    {T.fileChange}
                                </button>
                            </div>
                        ) : (
                            <div
                                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                                onDragLeave={() => setDragging(false)}
                                onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) parseFile(f); }}
                                onClick={() => fileRef.current?.click()}
                                style={{ border: `2px dashed ${dragging ? MC_BLUE : '#D1D5DB'}`, background: dragging ? '#EEF4FF' : '#F9FAFB', borderRadius: 8, padding: '20px', cursor: 'pointer', transition: 'all 0.15s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
                            >
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" style={{ color: dragging ? MC_BLUE : '#9CA3AF' }}>
                                    <path d="M7 18.5A4.5 4.5 0 017 9.5h.1A6.5 6.5 0 0120 11a4 4 0 010 8H7z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                                    <path d="M12 21v-7m0 0l-2.5 2.5M12 14l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                <div>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 2, textAlign: 'center' }}>{T.dropHeading}</div>
                                    <div style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center' }}>{T.dropSub}</div>
                                </div>
                                <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={(e) => parseFile(e.target.files?.[0] || null)} />
                            </div>
                        )}

                        {/* Primary CTA */}
                        <button
                            type="button"
                            onClick={() => rows.length > 0 && setStep(2)}
                            disabled={rows.length === 0}
                            style={{ width: '100%', marginTop: 12, padding: '12px', background: rows.length > 0 ? MC_BLUE : '#D1D5DB', color: '#FFF', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: rows.length > 0 ? 'pointer' : 'default', transition: 'background 0.2s' }}
                        >
                            {rows.length > 0 ? T.continueBtn(rows.length.toLocaleString(numLocale)) : T.uploadPrompt}
                        </button>
                        </div>{/* end upload card */}

                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════
                STEP 2 — Spalten-Zuordnung
            ══════════════════════════════════════════ */}
            {step === 2 && (() => {
                const allFields2 = [
                    ...MC_PFLICHT_COLS.filter((f) => f !== 'image_url'),
                    ...(outsideGermany ? ['hs_code'] : []),
                    ...MC_OPTIONAL_COLS,
                    'manufacturer_phone_number',
                ];
                const totalFields2 = allFields2.length + 1; // +1 for image
                const foundFields2 = allFields2.filter((f) => mcMapping[f]).length + (mcImageColumns.length > 0 ? 1 : 0);
                const pct2 = Math.round((foundFields2 / totalFields2) * 100);

                // Detected pflicht fields (for summary list)
                const detectedPflicht = MC_PFLICHT_COLS.filter((f) => f !== 'image_url' && mcMapping[f]);
                if (mcImageColumns.length > 0) detectedPflicht.push('image_url');
                const detectedOptional = MC_OPTIONAL_COLS.filter((f) => mcMapping[f]);
                const detectedAll = [...detectedPflicht, ...detectedOptional];
                const SHOW_DET = 5;
                const moreDetected = Math.max(0, detectedAll.length - SHOW_DET);

                // Missing pflicht fields
                const missingPflicht2 = issues ? issues.missingPflichtCols : [];
                const SHOW_MISS = 6;
                const moreMissing = Math.max(0, missingPflicht2.length - SHOW_MISS);

                // Full mapping fields (for expanded view)
                const pflichtForFull = [
                    ...MC_PFLICHT_COLS.filter((f) => f !== 'image_url'),
                    ...(outsideGermany ? ['hs_code'] : []),
                ];
                const optionalForFull = MC_OPTIONAL_COLS.filter((f) => mcMapping[f]);

                const langDE = lang === 'de';

                return (
                    <div style={{ width: '100%', maxWidth: 1100 }}>
                        {/* Back */}
                        <button type="button" onClick={() => setStep(1)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#6B7280', fontWeight: 600, padding: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            {T.back}
                        </button>

                        {mcIsWrongFile ? (
                            <div style={{ padding: '20px', borderRadius: 12, border: '1px solid #FECACA', background: '#FEF2F2', display: 'flex', gap: 12 }}>
                                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0, color: '#DC2626' }}><path d="M10 3L2 17h16L10 3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M10 9v3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><circle cx="10" cy="14.5" r="0.75" fill="currentColor"/></svg>
                                <div>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: '#B91C1C', marginBottom: 4 }}>{T.wrongFileTitle}</div>
                                    <div style={{ fontSize: 11, color: '#7F1D1D', lineHeight: 1.6 }}>{T.wrongFileDesc}</div>
                                </div>
                            </div>
                        ) : (
                            <div style={{ background: '#FFF', borderRadius: 16, boxShadow: '0 2px 16px rgba(0,0,0,0.08)', overflow: 'hidden' }}>

                                {/* Card header */}
                                <div style={{ padding: '20px 24px 16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                        <div style={{ fontSize: 18, fontWeight: 800, color: '#111827' }}>{T.mappingTitle}</div>
                                        <div style={{ fontSize: 12, color: '#6B7280' }}>
                                            {T.mappingFound(foundFields2, totalFields2)}
                                            {missingPflicht2.length > 0 && <span style={{ color: '#DC2626', fontWeight: 600 }}>{T.mappingMissing(missingPflicht2.length)}</span>}
                                        </div>
                                    </div>
                                    {/* Progress bar */}
                                    <div style={{ height: 6, background: '#E5E7EB', borderRadius: 3, overflow: 'hidden' }}>
                                        <div style={{ height: '100%', width: `${pct2}%`, background: MC_BLUE, borderRadius: 3, transition: 'width 0.4s' }} />
                                    </div>
                                </div>

                                {/* Two-column summary */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, borderTop: '1px solid #F3F4F6' }}>
                                    {/* ERKANNT */}
                                    <div style={{ padding: '14px 20px', borderRight: '1px solid #F3F4F6' }}>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.06em', marginBottom: 10 }}>
                                            {langDE ? 'ERKANNT' : 'DETECTED'}
                                        </div>
                                        <div style={{ display: 'grid', gap: 5 }}>
                                            {detectedAll.slice(0, SHOW_DET).map((f) => {
                                                const col = f === 'image_url' ? mcImageColumns[0] : mcMapping[f];
                                                const label = f === 'image_url' ? (langDE ? 'Hauptbild' : 'Main Image') : (FIELD_LABELS[f] || f);
                                                return (
                                                    <div key={f} style={{ fontSize: 12, color: '#166534', display: 'flex', alignItems: 'baseline', gap: 4 }}>
                                                        <span style={{ color: '#16A34A', fontWeight: 700, flexShrink: 0 }}>✓</span>
                                                        <span style={{ color: '#374151' }}>{label}</span>
                                                        <span style={{ color: '#9CA3AF', fontSize: 11 }}>→ {col}</span>
                                                    </div>
                                                );
                                            })}
                                            {moreDetected > 0 && (
                                                <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
                                                    + {moreDetected} {langDE ? 'weitere Felder erkannt' : 'more fields detected'}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* FEHLEND */}
                                    <div style={{ padding: '14px 20px' }}>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.06em', marginBottom: 10 }}>
                                            {langDE ? 'FEHLEND' : 'MISSING'}
                                        </div>
                                        <div style={{ display: 'grid', gap: 5 }}>
                                            {missingPflicht2.length === 0 ? (
                                                <div style={{ fontSize: 12, color: '#16A34A', fontWeight: 600 }}>
                                                    {langDE ? '✓ Alle Pflichtfelder erkannt' : '✓ All required fields detected'}
                                                </div>
                                            ) : (
                                                <>
                                                    {missingPflicht2.slice(0, SHOW_MISS).map((f) => {
                                                        const label = f === 'image_url' ? (langDE ? 'Hauptbild' : 'Main Image') : (FIELD_LABELS[f] || f);
                                                        return (
                                                            <div key={f} style={{ fontSize: 12, display: 'flex', alignItems: 'baseline', gap: 4 }}>
                                                                <span style={{ color: '#DC2626', fontWeight: 700, flexShrink: 0 }}>✕</span>
                                                                <span style={{ color: '#374151' }}>{label}</span>
                                                                <span style={{ color: '#9CA3AF', fontSize: 11 }}>({f})</span>
                                                            </div>
                                                        );
                                                    })}
                                                    {moreMissing > 0 && (
                                                        <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
                                                            + {moreMissing} {langDE ? 'weitere fehlende Felder' : 'more missing fields'}
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Expand full mapping */}
                                <div style={{ borderTop: '1px solid #F3F4F6' }}>
                                    <button type="button" onClick={() => setMappingExpanded((v) => !v)}
                                        style={{ width: '100%', padding: '10px 20px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#6B7280', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <span style={{ fontSize: 10 }}>{mappingExpanded ? '▲' : '▼'}</span>
                                        {mappingExpanded
                                            ? (langDE ? 'Zuordnung ausblenden' : 'Hide mapping')
                                            : (langDE ? 'Vollständige Spalten-Zuordnung anzeigen' : 'Show full column mapping')}
                                    </button>

                                    {mappingExpanded && (
                                        <div style={{ padding: '0 20px 16px', display: 'grid', gap: 5 }}>
                                            {missingPflicht2.length > 0 && (
                                                <div style={{ padding: '8px 12px', borderRadius: 8, background: '#FEF2F2', border: '1px solid #FECACA', fontSize: 12, color: '#991B1B', marginBottom: 8 }}>
                                                    {T.mappingWarning}
                                                </div>
                                            )}
                                            {[...pflichtForFull, ...optionalForFull].map((f) => {
                                                const isManual = f in manualMapping;
                                                const col = mcMapping[f];
                                                const isPflicht = MC_PFLICHT_COLS.includes(f) || (outsideGermany && f === 'hs_code');
                                                const missing = !col && isPflicht;
                                                return (
                                                    <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        <span style={{ fontSize: 11, color: '#374151', width: 160, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                            {FIELD_LABELS[f] || f}
                                                            {isPflicht && <span style={{ color: '#DC2626', fontWeight: 700 }}>*</span>}
                                                        </span>
                                                        <select value={col || ''} onChange={(e) => { const val = e.target.value; setManualMapping((prev) => { const next = { ...prev }; if (val === '') delete next[f]; else next[f] = val; return next; }); }}
                                                            style={{ flex: 1, fontSize: 11, padding: '4px 7px', borderRadius: 6, border: `1px solid ${missing ? '#FCA5A5' : col ? '#D1FAE5' : '#D1D5DB'}`, background: missing ? '#FFF5F5' : col ? '#F0FDF4' : '#FFF', cursor: 'pointer' }}>
                                                            <option value="">{T.notAssigned}</option>
                                                            {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                                                        </select>
                                                        {isManual && (
                                                            <button type="button" onClick={() => setManualMapping((prev) => { const next = { ...prev }; delete next[f]; return next; })}
                                                                style={{ fontSize: 10, padding: '3px 7px', borderRadius: 4, border: '1px solid #C4B5FD', background: '#FFF', color: '#7C3AED', cursor: 'pointer' }}>↩</button>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                            {/* Image row */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <span style={{ fontSize: 11, color: '#374151', width: 160, flexShrink: 0 }}>
                                                    {T.mainImageLabel}<span style={{ color: '#DC2626', fontWeight: 700 }}>*</span>
                                                </span>
                                                <div style={{ flex: 1, fontSize: 11, padding: '5px 8px', borderRadius: 6, border: `1px solid ${mcImageColumns.length > 0 ? '#D1FAE5' : '#FCA5A5'}`, background: mcImageColumns.length > 0 ? '#F0FDF4' : '#FFF5F5', color: mcImageColumns.length > 0 ? '#166534' : '#DC2626', fontWeight: 600 }}>
                                                    {mcImageColumns.length > 0 ? mcImageColumns.join(', ') : T.notDetected}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* CTA */}
                                <div style={{ padding: '0 20px 20px' }}>
                                    <button type="button" onClick={() => setStep(3)}
                                        style={{ width: '100%', padding: '14px', background: MC_BLUE, color: '#FFF', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                                        {T.startAnalysis}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })()}

            {/* ══════════════════════════════════════════
                STEP 3 — Ergebnis
            ══════════════════════════════════════════ */}
            {step === 3 && issues && (() => {
                const totalPflichtFields = PFLICHT_TABLE_FIELDS.length;
                const vollstaendigFields = PFLICHT_TABLE_FIELDS.filter(({ key }) => {
                    const isMapped = key === 'availability'
                        ? (mcMapping.availability || mcMapping.stock_amount)
                        : key === 'image_url' ? mcImageColumns.length > 0
                        : mcMapping[key];
                    return isMapped && (fieldErrorRows[key]?.size || 0) === 0;
                }).length;

                // Build per-type error breakdown for sidebar
                const errorsByType = {};
                issues.pflichtErrors.forEach((e) => {
                    const fieldLabel = T.csvFieldLabels[e.field] || e.field;
                    let label;
                    if (e.type === 'missing') label = T.csvErrMissing(fieldLabel);
                    else if (e.type === 'placeholder') label = T.csvErrPlaceholder(fieldLabel);
                    else if (e.type === 'too_short') label = T.csvErrTooShort(fieldLabel);
                    else if (e.type === 'one_word') label = T.csvErrOneWord(fieldLabel);
                    else if (e.type === 'bware') label = T.csvErrBware(fieldLabel);
                    else if (e.type === 'wrong_length') label = T.csvErrLength(fieldLabel);
                    else if (e.type === 'invalid') label = T.csvErrInvalid(fieldLabel);
                    else label = T.csvErrFallback(fieldLabel);
                    const key = `${e.field}::${e.type}`;
                    if (!errorsByType[key]) errorsByType[key] = { label, count: 0 };
                    errorsByType[key].count++;
                });
                if (issues.eanDupRows.size > 0) errorsByType['ean::dup'] = { label: T.csvEanDup, count: issues.eanDupRows.size };
                if (issues.nameDupRows.size > 0) errorsByType['name::dup'] = { label: T.csvNameDup, count: issues.nameDupRows.size };
                const detailedErrors = Object.values(errorsByType)
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 7);

                const csvOnClick = () => {
                    const pflichtByRow = {}, optionalByRow = {};
                    const errorMsg = (e) => {
                        const label = T.csvFieldLabels[e.field] || e.field;
                        if (e.type === 'missing') return T.csvErrMissing(label);
                        if (e.type === 'placeholder') return T.csvErrPlaceholder(label);
                        if (e.type === 'too_short') return T.csvErrTooShort(label);
                        if (e.type === 'one_word') return T.csvErrOneWord(label);
                        if (e.type === 'bware') return T.csvErrBware(label);
                        if (e.type === 'wrong_length') return T.csvErrLength(label);
                        if (e.type === 'invalid') return T.csvErrInvalid(label);
                        return T.csvErrFallback(label);
                    };
                    issues.pflichtErrors.forEach((e) => { if (!pflichtByRow[e.row]) pflichtByRow[e.row] = []; pflichtByRow[e.row].push(errorMsg(e)); });
                    issues.eanDupRows.forEach((rn) => { if (!pflichtByRow[rn]) pflichtByRow[rn] = []; pflichtByRow[rn].push(T.csvEanDup); });
                    issues.nameDupRows.forEach((rn) => { if (!pflichtByRow[rn]) pflichtByRow[rn] = []; pflichtByRow[rn].push(T.csvNameDup); });
                    issues.optionalHints.forEach((e) => { if (!optionalByRow[e.row]) optionalByRow[e.row] = []; optionalByRow[e.row].push(T.csvErrMissing(e.field)); });
                    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
                    const sep = ';';
                    const headerRow = [T.csvColPflicht, T.csvColOptional, ...headers].map(esc).join(sep);
                    const lines = rows.map((r, i) => {
                        const rn = i + 1;
                        const p = pflichtByRow[rn] ? [...new Set(pflichtByRow[rn])].join('; ') : '';
                        const o = optionalByRow[rn] ? [...new Set(optionalByRow[rn])].join('; ') : '';
                        return [esc(p), esc(o), ...headers.map((h) => esc(r[h]))].join(sep);
                    });
                    const csv = [headerRow, ...lines].join('\n');
                    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `feed-fehlerliste-${new Date().toISOString().slice(0, 10)}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                };

                // Reusable Wichtige Hinweise panel (also used in step 4)
                const HinweisPanel = () => (
                    <div style={{ background: '#FFF', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%' }}>
                        <div style={{ padding: '10px 14px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexShrink: 0 }}>
                            <span style={{ fontSize: 12, fontWeight: 800, color: '#111827' }}>{T.hinweisTitle}</span>
                            <span style={{ fontSize: 10, color: '#9CA3AF' }}>{T.hinweisBeforeNext}</span>
                        </div>
                        <div style={{ flex: 1, overflow: 'auto', padding: '10px 14px', display: 'grid', gap: 10 }}>
                            {[T.hinweisPflicht, T.hinweisQuality, T.hinweisInhalt].map((h) => (
                                <div key={h.label}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                                        <span style={{ fontSize: 9, fontWeight: 800, color: h.color, background: h.bg, border: `1px solid ${h.border}`, padding: '2px 6px', borderRadius: 4, letterSpacing: '0.06em' }}>{h.label}</span>
                                        <span style={{ fontSize: 11, fontWeight: 700, color: '#111827' }}>{h.title}</span>
                                        <span style={{ fontSize: 9, color: '#9CA3AF', marginLeft: 'auto', whiteSpace: 'nowrap' }}>{h.sub}</span>
                                    </div>
                                    <ul style={{ margin: 0, padding: '0 0 0 14px', display: 'grid', gap: 3 }}>
                                        {h.items.map((item, i) => (
                                            <li key={i} style={{ fontSize: 10, color: '#374151', lineHeight: 1.45 }}>{item}</li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                            {/* Vorlagen & Dokumentation */}
                            <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: 8 }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{lang === 'de' ? 'Vorlagen & Dokumentation' : 'Templates & Docs'}</div>
                                <div style={{ display: 'grid', gap: 4 }}>
                                    {[
                                        { icon: '📄', label: T.feedGuide, sub: lang === 'de' ? 'PDF · 24 Seiten' : 'PDF · 24 pages', onClick: () => setShowLeitfaden(true) },
                                        { icon: '📊', label: T.feedTemplate, sub: lang === 'de' ? 'XLSX · Alle Pflichtfelder' : 'XLSX · All required fields', onClick: () => { const a = document.createElement('a'); a.href = 'http://media-partner.moebel.check24.de/feedvorlagen/Feedleitfaden_Anhang_2026/CHECK24_Feedvorlage_V2025.xlsx'; a.download = 'CHECK24_Feedvorlage_V2025.xlsx'; a.click(); } },
                                    ].map((r) => (
                                        <button key={r.label} type="button" onClick={r.onClick}
                                            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6, border: '1px solid #E5E7EB', background: '#F9FAFB', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                                            <span style={{ fontSize: 14 }}>{r.icon}</span>
                                            <div>
                                                <div style={{ fontSize: 10, fontWeight: 700, color: '#111827' }}>{r.label}</div>
                                                <div style={{ fontSize: 9, color: '#9CA3AF' }}>{r.sub}</div>
                                            </div>
                                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ marginLeft: 'auto', flexShrink: 0 }}><path d="M3 2l4 3-4 3" stroke="#9CA3AF" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                );

                const listablePct = Math.round((issues.livefaehigCount / issues.totalRows) * 100);

                return (
                    <div style={{ width: '100%', maxWidth: 1280, display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', gap: 12 }}>

                        {/* Back */}
                        <button type="button" onClick={() => setStep(2)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#6B7280', fontWeight: 600, padding: 0, display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            {T.back}
                        </button>

                        {/* Status header */}
                        <div style={{ borderRadius: 12, background: stufe1Passed ? '#F0FDF4' : '#FEF2F2', border: `1px solid ${stufe1Passed ? '#BBF7D0' : '#FECACA'}`, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
                            <div style={{ width: 36, height: 36, borderRadius: '50%', background: stufe1Passed ? '#DCFCE7' : '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                {stufe1Passed
                                    ? <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8l4 4 6-6" stroke="#16A34A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                    : <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2L1 14h14L8 2z" stroke="#DC2626" strokeWidth="1.5" strokeLinejoin="round"/><path d="M8 7v3" stroke="#DC2626" strokeWidth="1.5" strokeLinecap="round"/><circle cx="8" cy="12" r=".6" fill="#DC2626"/></svg>}
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 14, fontWeight: 700, color: stufe1Passed ? '#166534' : '#991B1B', marginBottom: 2 }}>
                                    {stufe1Passed ? T.statusOk : T.statusErr}
                                </div>
                                <div style={{ fontSize: 11, color: stufe1Passed ? '#4B7A5A' : '#B91C1C' }}>
                                    {T.errorRateFmt(errorRate.toFixed(1))}
                                    {file && <span style={{ color: '#9CA3AF', marginLeft: 10 }}>{file.name}</span>}
                                </div>
                            </div>
                            {/* Inline stats */}
                            {[
                                { val: issues.livefaehigCount, label: T.statComplete, color: '#16A34A', tip: T.tipComplete },
                                { val: issues.blockiertCount, label: T.statErrors, color: '#DC2626', tip: T.tipErrors },
                                { val: issues.totalRows, label: T.statTotal, color: '#374151', tip: T.tipTotal },
                            ].map(({ val, label, color, tip }) => (
                                <Tooltip key={label} text={tip}>
                                    <div style={{ textAlign: 'center', paddingLeft: 24, borderLeft: '1px solid rgba(0,0,0,0.08)', cursor: 'help' }}>
                                        <div style={{ fontSize: 24, fontWeight: 900, color, lineHeight: 1 }}>{val.toLocaleString(numLocale)}</div>
                                        <div style={{ fontSize: 10, color: '#6B7280', marginTop: 2 }}>{label}</div>
                                    </div>
                                </Tooltip>
                            ))}
                            {/* Progress bar */}
                            <div style={{ paddingLeft: 24, borderLeft: '1px solid rgba(0,0,0,0.08)', minWidth: 140 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                    <span style={{ fontSize: 10, fontWeight: 600, color: '#374151' }}>{T.statComplete}</span>
                                    <span style={{ fontSize: 10, fontWeight: 700, color: stufe1Passed ? '#16A34A' : '#DC2626' }}>{listablePct}%</span>
                                </div>
                                <div style={{ height: 7, background: 'rgba(0,0,0,0.08)', borderRadius: 4, overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${listablePct}%`, background: stufe1Passed ? '#16A34A' : '#DC2626', borderRadius: 4, transition: 'width 0.4s' }} />
                                </div>
                                <div style={{ fontSize: 9, color: '#9CA3AF', marginTop: 3 }}>{T.listableCount(issues.livefaehigCount.toLocaleString(numLocale), issues.totalRows.toLocaleString(numLocale))}</div>
                            </div>
                        </div>

                        {/* 2-column: table | action panel */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 12, flex: 1, overflow: 'hidden', alignItems: 'start' }}>

                        {/* Field analysis table */}
                        <div style={{ background: '#FFF', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'auto', height: '100%' }}>
                            <div style={{ padding: '12px 18px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', position: 'sticky', top: 0, background: '#FFF', zIndex: 1 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{T.analysisTitle}</div>
                                <div style={{ fontSize: 10, color: '#6B7280' }}>
                                    {T.analysisSummary(totalPflichtFields, vollstaendigFields, totalPflichtFields - vollstaendigFields)}
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 130px', padding: '6px 18px', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.05em' }}>{T.colField}</div>
                                <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.05em', textAlign: 'right' }}>{T.colStatus}</div>
                                <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.05em', paddingLeft: 12 }}>{T.colCoverage}</div>
                            </div>
                            {PFLICHT_TABLE_FIELDS.map(({ key, label }) => {
                                const isMapped = key === 'availability'
                                    ? !!(mcMapping.availability || mcMapping.stock_amount)
                                    : key === 'image_url' ? mcImageColumns.length > 0
                                    : !!mcMapping[key];
                                const errs = fieldErrorRows[key]?.size || 0;
                                const pct = isMapped ? Math.max(0, Math.round((1 - errs / issues.totalRows) * 100)) : null;
                                const barColor = pct === null ? '#E5E7EB' : pct === 100 ? '#16A34A' : pct >= 70 ? '#D97706' : '#DC2626';
                                return (
                                    <div key={key} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 130px', padding: '9px 18px', borderBottom: '1px solid #F9FAFB', alignItems: 'center' }}>
                                        <div style={{ fontSize: 12, color: '#374151', fontWeight: 500 }}>{label}</div>
                                        <div style={{ textAlign: 'right', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
                                            {pct === null ? <span style={{ color: '#9CA3AF' }}>{T.notInFeed}</span>
                                                : errs === 0 ? <span style={{ color: '#16A34A' }}>{T.complete}</span>
                                                : <span style={{ color: pct < 30 ? '#DC2626' : '#D97706' }}>{T.missingCount(errs.toLocaleString(numLocale))}</span>}
                                        </div>
                                        <div style={{ paddingLeft: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                                            {pct !== null ? (
                                                <>
                                                    <div style={{ flex: 1, height: 5, background: '#F3F4F6', borderRadius: 3, overflow: 'hidden' }}>
                                                        <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 3, transition: 'width 0.4s' }} />
                                                    </div>
                                                    <span style={{ fontSize: 9, color: '#9CA3AF', width: 26, textAlign: 'right', flexShrink: 0 }}>{pct}%</span>
                                                </>
                                            ) : <span style={{ fontSize: 9, color: '#D1D5DB' }}>—</span>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Right action panel */}
                        <div style={{ background: '#FFF', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%' }}>

                            {/* Top errors */}
                            {detailedErrors.length > 0 && (
                                <div style={{ padding: '16px 18px', borderBottom: '1px solid #F3F4F6' }}>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: '#111827', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{T.topErrorsTitle}</div>
                                    <div style={{ display: 'grid', gap: 7 }}>
                                        {detailedErrors.map((e, i) => (
                                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <div style={{ minWidth: 36, height: 22, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                    <span style={{ fontSize: 11, fontWeight: 800, color: '#DC2626' }}>{e.count.toLocaleString(numLocale)}</span>
                                                </div>
                                                <span style={{ fontSize: 11, color: '#374151', lineHeight: 1.35 }}>{e.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Spacer */}
                            <div style={{ flex: 1 }} />

                            {/* Download section */}
                            <div style={{ padding: '16px 18px', borderTop: '1px solid #F3F4F6' }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: '#111827', marginBottom: 2 }}>{T.csvTitle}</div>
                                <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 12, lineHeight: 1.5 }}>{T.csvDesc}</div>
                                <button type="button" onClick={csvOnClick}
                                    style={{ width: '100%', padding: '10px', background: '#F9FAFB', color: '#374151', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 2v9M4 8l4 4 4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 14h12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
                                    {T.csvBtn}
                                </button>
                            </div>

                            {/* Primary CTA */}
                            <div style={{ padding: '0 18px 16px' }}>
                                <button type="button" onClick={() => setStep(4)}
                                    style={{ width: '100%', padding: '12px', background: MC_BLUE, color: '#FFF', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                                    {T.recNextStep}
                                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 2l5 5-5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                </button>
                            </div>

                            {/* Reset */}
                            <div style={{ padding: '0 18px 16px' }}>
                                <button type="button" onClick={resetToStart}
                                    style={{ width: '100%', padding: '9px', background: 'none', color: '#9CA3AF', border: 'none', borderRadius: 8, fontSize: 11, fontWeight: 500, cursor: 'pointer' }}>
                                    {lang === 'de' ? 'Neuen Feed hochladen' : 'Upload New Feed'}
                                </button>
                            </div>

                        </div>{/* end right panel */}

                        </div>{/* end grid */}

                    </div>
                );
            })()}

            {/* ══════════════════════════════════════════
                STEP 4 — Empfehlungen & Download
            ══════════════════════════════════════════ */}
            {step === 4 && issues && (() => {
                // Build grouped recommendations from errors
                const errorsByType = {};
                issues.pflichtErrors.forEach((e) => {
                    const key = `${e.field}::${e.type}`;
                    if (!errorsByType[key]) errorsByType[key] = { field: e.field, type: e.type, count: 0 };
                    errorsByType[key].count++;
                });
                if (issues.eanDupRows.size > 0) errorsByType['ean::dup'] = { field: 'ean', type: 'dup', count: issues.eanDupRows.size };
                if (issues.nameDupRows.size > 0) errorsByType['name::dup'] = { field: 'name', type: 'dup', count: issues.nameDupRows.size };

                const recRules = lang === 'de' ? {
                    'name::missing':       { icon: '✏️', title: 'Artikelname fehlt',               action: 'Tragen Sie für jeden betroffenen Artikel einen vollständigen Namen ein.',         tip: 'Format: Marke + Produkttyp + Hauptattribut, z. B. „BRAND Sofa 3-Sitzer grau 180 cm" · mind. 2 Wörter und 10 Zeichen.' },
                    'name::too_short':     { icon: '✏️', title: 'Artikelname zu kurz',              action: 'Verlängern Sie den Artikelnamen auf mindestens 10 Zeichen.',                     tip: 'Ergänzen Sie Produkttyp, Farbe oder Material für einen aussagekräftigen Namen.' },
                    'name::one_word':      { icon: '✏️', title: 'Artikelname: nur ein Wort',        action: 'Der Name muss aus mindestens 2 Wörtern bestehen.',                              tip: 'Kombinieren Sie Marke + Produktname, z. B. „BRAND Tisch" oder „Hersteller Sofa grau".' },
                    'name::placeholder':   { icon: '✏️', title: 'Artikelname: Platzhalterwert',     action: 'Ersetzen Sie Platzhalter wie „n/a" oder „test" durch echte Artikelnamen.',       tip: 'Verwenden Sie produktspezifische, eindeutige Namen.' },
                    'name::dup':           { icon: '✏️', title: 'Artikelname: Duplikate',           action: 'Jeder Artikel muss einen eindeutigen Namen haben. Korrigieren oder entfernen Sie Duplikate.', tip: 'Unterscheiden Sie Varianten durch Farbe, Größe oder Modellbezeichnung.' },
                    'ean::missing':        { icon: '🔢', title: 'EAN fehlt',                        action: 'Ergänzen Sie die EAN (GTIN14) für alle betroffenen Artikel.',                   tip: 'Verwenden Sie die offizielle GTIN aus der GS1-Datenbank.' },
                    'ean::wrong_length':   { icon: '🔢', title: 'EAN: falsche Länge',               action: 'Die EAN muss 13 oder 14 Stellen haben (EAN-13 oder GTIN-14).',                   tip: 'Beispiel: EAN-13 „4012345678901" (13-stellig) oder GTIN-14 „04012345678901" (14-stellig).' },
                    'ean::invalid':        { icon: '🔢', title: 'EAN: ungültiger Wert',             action: 'Entfernen Sie Sonderzeichen – die EAN darf nur Ziffern enthalten.',              tip: 'Keine Buchstaben, Leerzeichen oder Bindestriche erlaubt.' },
                    'ean::placeholder':    { icon: '🔢', title: 'EAN: Platzhalterwert',             action: 'Ersetzen Sie Test-EANs durch gültige GTIN14-Nummern.',                          tip: 'Erfundene oder Test-EANs werden blockiert.' },
                    'ean::dup':            { icon: '🔢', title: 'EAN: Duplikate',                   action: 'Jede EAN darf nur einmal vorkommen. Korrigieren Sie die doppelten Einträge.',   tip: 'Prüfen Sie, ob Artikel versehentlich mehrfach exportiert wurden.' },
                    'description::missing':    { icon: '📝', title: 'Beschreibung fehlt',               action: 'Ergänzen Sie eine Produktbeschreibung für alle betroffenen Artikel.',           tip: 'Mindestens 20 Zeichen, empfohlen 100–500 Zeichen mit Material, Maßen und Features.' },
                    'description::too_short':  { icon: '📝', title: 'Beschreibung zu kurz',             action: 'Verlängern Sie die Beschreibung auf mindestens 20 Zeichen.',                     tip: 'Nennen Sie Material, Farbe, Maße und besondere Produkteigenschaften.' },
                    'description::bware':      { icon: '📝', title: 'Beschreibung: B-Ware-Hinweis',     action: 'Entfernen Sie die Kennzeichnung „B-Ware" aus der Beschreibung.',                tip: 'B-Ware-Artikel können nicht als Neuware gelistet werden.' },
                    'description::placeholder':{ icon: '📝', title: 'Beschreibung: Platzhalterwert',    action: 'Ersetzen Sie Platzhalter durch echte Produktbeschreibungen.',                   tip: 'Beschreiben Sie Material, Farbe und Besonderheiten des Produkts.' },
                    'price::missing':      { icon: '💶', title: 'Preis fehlt',                      action: 'Ergänzen Sie den Preis für alle betroffenen Artikel.',                          tip: 'Format: 19.99 (Punkt als Dezimaltrennzeichen, ohne €-Zeichen).' },
                    'price::invalid':      { icon: '💶', title: 'Preis: ungültiges Format',         action: 'Korrigieren Sie das Preisformat auf 19.99.',                                    tip: 'Nur positive Zahlen mit Punkt als Dezimaltrennzeichen, z. B. 29.99.' },
                    'price::placeholder':  { icon: '💶', title: 'Preis: Platzhalterwert',           action: 'Ersetzen Sie Platzhalterwerte durch den korrekten Artikelpreis.',               tip: 'Der Preis muss eine positive Zahl größer als 0 sein.' },
                    'shipping_mode::missing':  { icon: '🚚', title: 'Versandart fehlt',              action: 'Tragen Sie die Versandart für alle betroffenen Artikel ein.',                   tip: 'Erlaubte Werte: „paket" oder „spedition" (Groß-/Kleinschreibung egal).' },
                    'shipping_mode::invalid':  { icon: '🚚', title: 'Versandart: ungültiger Wert',   action: 'Korrigieren Sie die Versandart auf „paket" oder „spedition".',                  tip: 'Keine anderen Werte zulässig – prüfen Sie Leerzeichen oder Tippfehler.' },
                    'shipping_mode::placeholder': { icon: '🚚', title: 'Versandart: Platzhalterwert', action: 'Ersetzen Sie Platzhalterwerte durch „paket" oder „spedition".',              tip: 'Erlaubte Werte: „paket" für Paketversand, „spedition" für Speditionslieferung.' },
                    'image_url::missing':  { icon: '🖼️', title: 'Bild-URL fehlt',                  action: 'Fügen Sie für jeden Artikel eine öffentlich erreichbare Bild-URL ein.',         tip: 'Freigestelltes Bild auf weißem Hintergrund, mind. 600×600 px, kein Login nötig.' },
                    'image_url::invalid':  { icon: '🖼️', title: 'Bild-URL: ungültiger Wert',       action: 'Prüfen Sie, ob die Bild-URL korrekt und öffentlich erreichbar ist.',            tip: 'URL muss mit http:// oder https:// beginnen und direkt auf eine Bilddatei zeigen.' },
                    'availability::missing':   { icon: '📦', title: 'Bestand / Verfügbarkeit fehlt', action: 'Geben Sie Lagerbestand oder Verfügbarkeitsstatus für alle Artikel an.',        tip: 'Entweder numerischer Bestand (z. B. 10) oder einen Verfügbarkeitsstatus.' },
                    'stock_amount::missing':   { icon: '📦', title: 'Bestand fehlt',                 action: 'Ergänzen Sie den numerischen Lagerbestand.',                                   tip: 'Tragen Sie den aktuellen Bestand als Zahl ein, z. B. 5 oder 100.' },
                    'brand::missing':      { icon: '🏷️', title: 'Marke fehlt',                      action: 'Ergänzen Sie den Markennamen für alle betroffenen Artikel.',                   tip: 'Verwenden Sie den offiziellen Markennamen, mind. 2 Zeichen.' },
                    'brand::too_short':    { icon: '🏷️', title: 'Marke: zu kurz',                   action: 'Der Markenname muss mindestens 2 Zeichen haben.',                              tip: 'Verwenden Sie den vollständigen, offiziellen Markennamen.' },
                    'brand::placeholder':  { icon: '🏷️', title: 'Marke: Platzhalterwert',           action: 'Ersetzen Sie Platzhalter durch den echten Markennamen.',                       tip: 'Der Markenname muss für jeden Artikel ausgefüllt sein.' },
                    'delivery_time::missing':  { icon: '⏱️', title: 'Lieferzeit fehlt',              action: 'Ergänzen Sie die Lieferzeit für alle betroffenen Artikel.',                   tip: 'Format: Zahl + Einheit, z. B. „3-5 Werktage" oder „2 Tage".' },
                    'delivery_time::invalid':  { icon: '⏱️', title: 'Lieferzeit: ungültiges Format', action: 'Korrigieren Sie das Format der Lieferzeit.',                                   tip: 'Beispiele: „3-5 Werktage", „1 Woche", „2 Tage". Einheit muss erkennbar sein.' },
                    'delivery_time::placeholder': { icon: '⏱️', title: 'Lieferzeit: Platzhalterwert', action: 'Ersetzen Sie Platzhalter durch reale Lieferzeitangaben.',                   tip: 'Geben Sie die tatsächliche Lieferzeit an, z. B. „3-5 Werktage".' },
                    'seller_offer_id::missing':{ icon: '🆔', title: 'Eigene Artikel-ID fehlt',       action: 'Ergänzen Sie Ihre interne Artikel-ID für alle betroffenen Zeilen.',            tip: 'Die Artikel-ID muss eindeutig pro Artikel sein.' },
                    'seller_offer_id::placeholder':{ icon: '🆔', title: 'Artikel-ID: Platzhalterwert', action: 'Ersetzen Sie Platzhalter durch echte, eindeutige Artikel-IDs.',            tip: 'Verwenden Sie Ihre internen SKU oder Artikelnummern.' },
                    'hs_code::missing':    { icon: '🌍', title: 'HS-Code fehlt',                    action: 'Da Ihr Lager außerhalb Deutschlands liegt, ist der HS-Code Pflichtfeld.',      tip: 'Den passenden HS-Code finden Sie im EU-Zolltarifverzeichnis (customs.ec.europa.eu).' },
                } : {
                    'name::missing':       { icon: '✏️', title: 'Item name missing',              action: 'Add a full product name for every affected item.',                              tip: 'Format: Brand + Product type + Key attribute, e.g. "BRAND Sofa 3-seater grey 180 cm" · min. 2 words and 10 chars.' },
                    'name::too_short':     { icon: '✏️', title: 'Item name too short',            action: 'Extend the item name to at least 10 characters.',                               tip: 'Add product type, color, or material to create a descriptive name.' },
                    'name::one_word':      { icon: '✏️', title: 'Item name: single word only',   action: 'The name must consist of at least 2 words.',                                    tip: 'Combine brand + product name, e.g. "BRAND Table" or "Brand Sofa grey".' },
                    'name::placeholder':   { icon: '✏️', title: 'Item name: placeholder value',  action: 'Replace placeholders like "n/a" or "test" with real item names.',               tip: 'Use product-specific, unique names.' },
                    'name::dup':           { icon: '✏️', title: 'Item name: duplicates',         action: 'Every item must have a unique name. Fix or remove duplicates.',                  tip: 'Differentiate variants by color, size, or model designation.' },
                    'ean::missing':        { icon: '🔢', title: 'EAN missing',                   action: 'Add the EAN (GTIN14) for all affected items.',                                  tip: 'Use the official GTIN from the GS1 database.' },
                    'ean::wrong_length':   { icon: '🔢', title: 'EAN: wrong length',             action: 'EAN must be 13 or 14 digits (EAN-13 or GTIN-14).',                              tip: 'Example: EAN-13 "4012345678901" (13 digits) or GTIN-14 "04012345678901" (14 digits).' },
                    'ean::invalid':        { icon: '🔢', title: 'EAN: invalid value',            action: 'Remove special characters – EAN must contain digits only.',                     tip: 'No letters, spaces, or hyphens allowed.' },
                    'ean::placeholder':    { icon: '🔢', title: 'EAN: placeholder value',        action: 'Replace test EANs with valid GTIN14 numbers.',                                  tip: 'Invented or test EANs will be blocked.' },
                    'ean::dup':            { icon: '🔢', title: 'EAN: duplicates',               action: 'Each EAN may only appear once. Fix the duplicate entries.',                     tip: 'Check whether items were accidentally exported multiple times.' },
                    'description::missing':    { icon: '📝', title: 'Description missing',           action: 'Add a product description for all affected items.',                             tip: 'Min. 20 characters, ideally 100–500 with material, dimensions, and features.' },
                    'description::too_short':  { icon: '📝', title: 'Description too short',         action: 'Extend the description to at least 20 characters.',                             tip: 'Mention material, color, dimensions, and key product features.' },
                    'description::bware':      { icon: '📝', title: 'Description: used-goods label', action: 'Remove the "B-Ware" label from the description.',                               tip: 'Used goods items cannot be listed as new.' },
                    'description::placeholder':{ icon: '📝', title: 'Description: placeholder value', action: 'Replace placeholder values with real product descriptions.',                  tip: 'Describe material, color, and special features of the product.' },
                    'price::missing':      { icon: '💶', title: 'Price missing',                  action: 'Add the price for all affected items.',                                         tip: 'Format: 19.99 (dot as decimal separator, no currency symbol).' },
                    'price::invalid':      { icon: '💶', title: 'Price: invalid format',          action: 'Correct the price format to 19.99.',                                            tip: 'Only positive numbers with dot as decimal separator, e.g. 29.99.' },
                    'price::placeholder':  { icon: '💶', title: 'Price: placeholder value',       action: 'Replace placeholder values with the correct item price.',                       tip: 'The price must be a positive number greater than 0.' },
                    'shipping_mode::missing':  { icon: '🚚', title: 'Shipping mode missing',      action: 'Set the shipping mode for all affected items.',                                 tip: 'Allowed values: "paket" or "spedition" (case-insensitive).' },
                    'shipping_mode::invalid':  { icon: '🚚', title: 'Shipping mode: invalid value', action: 'Fix the shipping mode to "paket" or "spedition".',                           tip: 'No other values allowed – check for spaces or typos.' },
                    'shipping_mode::placeholder':{ icon: '🚚', title: 'Shipping mode: placeholder', action: 'Replace placeholders with "paket" or "spedition".',                          tip: '"paket" for parcel delivery, "spedition" for freight delivery.' },
                    'image_url::missing':  { icon: '🖼️', title: 'Image URL missing',             action: 'Add a publicly accessible image URL for every item.',                           tip: 'Cut-out on white background, min. 600×600 px, no login required.' },
                    'image_url::invalid':  { icon: '🖼️', title: 'Image URL: invalid value',      action: 'Check that the image URL is correct and publicly accessible.',                  tip: 'URL must start with http:// or https:// and point directly to an image file.' },
                    'availability::missing':   { icon: '📦', title: 'Stock / Availability missing', action: 'Provide stock count or availability status for every item.',                   tip: 'Either a numeric stock count (e.g. 10) or an availability status.' },
                    'stock_amount::missing':   { icon: '📦', title: 'Stock missing',              action: 'Add the numeric stock count.',                                                  tip: 'Enter the current stock as a number, e.g. 5 or 100.' },
                    'brand::missing':      { icon: '🏷️', title: 'Brand missing',                 action: 'Add the brand name for all affected items.',                                   tip: 'Use the official brand name, min. 2 characters.' },
                    'brand::too_short':    { icon: '🏷️', title: 'Brand: too short',              action: 'Brand name must be at least 2 characters.',                                    tip: 'Use the full, official brand name.' },
                    'brand::placeholder':  { icon: '🏷️', title: 'Brand: placeholder value',      action: 'Replace placeholders with the real brand name.',                               tip: 'Brand name must be filled in for every item.' },
                    'delivery_time::missing':  { icon: '⏱️', title: 'Delivery time missing',     action: 'Add the delivery time for all affected items.',                                 tip: 'Format: number + unit, e.g. "3-5 working days" or "2 days".' },
                    'delivery_time::invalid':  { icon: '⏱️', title: 'Delivery time: invalid format', action: 'Fix the delivery time format.',                                              tip: 'Examples: "3-5 working days", "1 week", "2 days". Unit must be recognizable.' },
                    'delivery_time::placeholder':{ icon: '⏱️', title: 'Delivery time: placeholder', action: 'Replace placeholders with actual delivery time information.',                 tip: 'Enter the real delivery time, e.g. "3-5 working days".' },
                    'seller_offer_id::missing':{ icon: '🆔', title: 'Own item ID missing',        action: 'Add your internal item ID for all affected rows.',                              tip: 'The item ID must be unique per item.' },
                    'seller_offer_id::placeholder':{ icon: '🆔', title: 'Item ID: placeholder value', action: 'Replace placeholders with real, unique item IDs.',                         tip: 'Use your internal SKUs or item numbers.' },
                    'hs_code::missing':    { icon: '🌍', title: 'HS Code missing',                action: 'Since your warehouse is outside Germany, HS Code is required.',                 tip: 'Find the correct HS Code in the EU customs tariff directory.' },
                };

                const recommendations = Object.entries(errorsByType)
                    .sort((a, b) => b[1].count - a[1].count)
                    .map(([key, { count }]) => ({ key, count, rule: recRules[key] || null }))
                    .filter(({ rule }) => rule !== null);

                const csvOnClick = () => {
                    const pflichtByRow = {}, optionalByRow = {};
                    const errorMsg = (e) => {
                        const label = T.csvFieldLabels[e.field] || e.field;
                        if (e.type === 'missing') return T.csvErrMissing(label);
                        if (e.type === 'placeholder') return T.csvErrPlaceholder(label);
                        if (e.type === 'too_short') return T.csvErrTooShort(label);
                        if (e.type === 'one_word') return T.csvErrOneWord(label);
                        if (e.type === 'bware') return T.csvErrBware(label);
                        if (e.type === 'wrong_length') return T.csvErrLength(label);
                        if (e.type === 'invalid') return T.csvErrInvalid(label);
                        return T.csvErrFallback(label);
                    };
                    issues.pflichtErrors.forEach((e) => { if (!pflichtByRow[e.row]) pflichtByRow[e.row] = []; pflichtByRow[e.row].push(errorMsg(e)); });
                    issues.eanDupRows.forEach((rn) => { if (!pflichtByRow[rn]) pflichtByRow[rn] = []; pflichtByRow[rn].push(T.csvEanDup); });
                    issues.nameDupRows.forEach((rn) => { if (!pflichtByRow[rn]) pflichtByRow[rn] = []; pflichtByRow[rn].push(T.csvNameDup); });
                    issues.optionalHints.forEach((e) => { if (!optionalByRow[e.row]) optionalByRow[e.row] = []; optionalByRow[e.row].push(T.csvErrMissing(e.field)); });
                    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
                    const sep = ';';
                    const headerRow = [T.csvColPflicht, T.csvColOptional, ...headers].map(esc).join(sep);
                    const lines = rows.map((r, i) => {
                        const rn = i + 1;
                        const p = pflichtByRow[rn] ? [...new Set(pflichtByRow[rn])].join('; ') : '';
                        const o = optionalByRow[rn] ? [...new Set(optionalByRow[rn])].join('; ') : '';
                        return [esc(p), esc(o), ...headers.map((h) => esc(r[h]))].join(sep);
                    });
                    const csv = [headerRow, ...lines].join('\n');
                    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `feed-fehlerliste-${new Date().toISOString().slice(0, 10)}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                };

                return (
                    <div style={{ width: '100%', maxWidth: 1200, display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

                        {/* Back */}
                        <button type="button" onClick={() => setStep(3)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#6B7280', fontWeight: 600, padding: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            {T.back}
                        </button>

                        {/* Header */}
                        <div style={{ marginBottom: 12, flexShrink: 0 }}>
                            <div style={{ fontSize: 18, fontWeight: 800, color: '#111827', marginBottom: 4 }}>
                                {recommendations.length > 0 ? T.recTitle(recommendations.length) : T.recNoErrorsTitle}
                            </div>
                            {recommendations.length === 0 && (
                                <div style={{ fontSize: 13, color: '#6B7280' }}>{T.recNoErrorsSub}</div>
                            )}
                        </div>

                        {/* Two-column layout: recommendations left, download panel right */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start', flex: 1, overflow: 'hidden' }}>

                            {/* Left: recommendations (scrollable) */}
                            <div style={{ overflow: 'auto', height: '100%', paddingRight: 4 }}>
                                {/* No-errors state */}
                                {recommendations.length === 0 && (
                                    <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 12, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 14 }}>
                                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <svg width="18" height="18" viewBox="0 0 16 16" fill="none"><path d="M3 8l4 4 6-6" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 14, fontWeight: 700, color: '#166534' }}>{T.recNoErrorsTitle}</div>
                                            <div style={{ fontSize: 12, color: '#4B7A5A', marginTop: 2 }}>{T.recNoErrorsSub}</div>
                                        </div>
                                    </div>
                                )}

                                {/* Recommendation cards */}
                                {recommendations.length > 0 && (
                                    <div style={{ display: 'grid', gap: 10 }}>
                                        {recommendations.map(({ key, count, rule }) => (
                                            <div key={key} style={{ background: '#FFF', border: '1px solid #E5E7EB', borderLeft: '4px solid #DC2626', borderRadius: 10, padding: '16px 20px' }}>
                                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                        <span style={{ fontSize: 20, lineHeight: 1 }}>{rule.icon}</span>
                                                        <div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                                                <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{rule.title}</span>
                                                                <span style={{ fontSize: 10, fontWeight: 700, color: '#DC2626', background: '#FEE2E2', padding: '2px 7px', borderRadius: 4, letterSpacing: '0.04em' }}>
                                                                    {T.recPriority}
                                                                </span>
                                                            </div>
                                                            <div style={{ fontSize: 11, color: '#DC2626', fontWeight: 600, marginTop: 2 }}>
                                                                {T.recAffected(count.toLocaleString(numLocale))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, marginBottom: 6 }}>
                                                    {rule.action}
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, background: '#F9FAFB', borderRadius: 6, padding: '8px 12px' }}>
                                                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="8" cy="8" r="6.5" stroke={MC_BLUE} strokeWidth="1.4"/><path d="M8 7v4" stroke={MC_BLUE} strokeWidth="1.4" strokeLinecap="round"/><circle cx="8" cy="5.5" r=".6" fill={MC_BLUE}/></svg>
                                                    <span style={{ fontSize: 11, color: '#6B7280', lineHeight: 1.5 }}>{rule.tip}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Right: download + re-upload panel */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%', overflow: 'auto' }}>
                                {/* Download Fehlerbericht */}
                                <div style={{ background: '#EEF4FF', border: `2px solid ${MC_BLUE}`, borderRadius: 12, padding: '16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                        <svg width="16" height="16" viewBox="0 0 18 18" fill="none"><path d="M9 2v10M6 9l3 3 3-3M2 15h14" stroke={MC_BLUE} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                        <span style={{ fontSize: 13, fontWeight: 800, color: '#111827' }}>{T.recDownloadTitle}</span>
                                    </div>
                                    <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 12, lineHeight: 1.5 }}>{T.recDownloadDesc}</div>
                                    <button type="button" onClick={csvOnClick}
                                        style={{ width: '100%', padding: '11px', background: MC_BLUE, color: '#FFF', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                                        <svg width="13" height="13" viewBox="0 0 15 15" fill="none"><path d="M7.5 2v8M5 7l2.5 2.5L10 7M2 13h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                        {T.recDownloadBtn}
                                    </button>
                                </div>

                                {/* Re-upload zone */}
                                <div style={{ border: '2px dashed #D1D5DB', borderRadius: 12, padding: '16px', background: '#FAFAFA' }}>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 3 }}>{T.reuploadTitle}</div>
                                    <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 12, lineHeight: 1.5 }}>{T.reuploadSub}</div>
                                    <div
                                        onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = MC_BLUE; e.currentTarget.style.background = '#EEF4FF'; }}
                                        onDragLeave={(e) => { e.currentTarget.style.borderColor = '#D1D5DB'; e.currentTarget.style.background = '#F9FAFB'; }}
                                        onDrop={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = '#D1D5DB'; e.currentTarget.style.background = '#F9FAFB'; const f = e.dataTransfer.files?.[0]; if (f) { resetToStart(); setTimeout(() => parseFile(f), 50); } }}
                                        onClick={() => fileRef.current?.click()}
                                        style={{ border: '1.5px dashed #D1D5DB', background: '#F9FAFB', borderRadius: 8, padding: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 10, transition: 'all 0.15s' }}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ color: '#9CA3AF' }}><path d="M7 18.5A4.5 4.5 0 017 9.5h.1A6.5 6.5 0 0120 11a4 4 0 010 8H7z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M12 21v-7m0 0l-2.5 2.5M12 14l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                        <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 600 }}>{lang === 'de' ? 'Datei hierher ziehen oder klicken' : 'Drop file here or click'}</span>
                                    </div>
                                    <a href={`https://${T.portalUrl}`} target="_blank" rel="noopener noreferrer"
                                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#FFF', border: '1px solid #E5E7EB', borderRadius: 7, textDecoration: 'none' }}>
                                        <span style={{ fontSize: 10, color: '#6B7280' }}>{T.portalUrl}</span>
                                        <span style={{ fontSize: 11, fontWeight: 700, color: MC_BLUE, whiteSpace: 'nowrap', marginLeft: 8 }}>{T.portalBtn}</span>
                                    </a>
                                </div>

                                {/* Reset */}
                                <button type="button" onClick={resetToStart}
                                    style={{ width: '100%', padding: '9px', background: '#FFF', color: '#374151', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                                    <svg width="11" height="11" viewBox="0 0 15 15" fill="none"><path d="M2 7.5h11M7 2.5l-5 5 5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                    {lang === 'de' ? 'Neuen Feed hochladen' : 'Upload New Feed'}
                                </button>
                            </div>

                        </div>

                    </div>
                );
            })()}

            </div>
        </div>

        {/* Feedleitfaden PDF Modal */}
        {showLeitfaden && (
            <div
                onClick={() => setShowLeitfaden(false)}
                style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1000, padding: 24,
                }}
            >
                <div
                    onClick={(e) => e.stopPropagation()}
                    style={{
                        background: '#FFF', borderRadius: 12, width: '100%', maxWidth: 900,
                        height: '90vh', display: 'flex', flexDirection: 'column',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid #E5E7EB' }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{T.pdfTitle}</span>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <a
                                href="https://w9cedwr8emsi29qt.public.blob.vercel-storage.com/CHECK24_Feedleitfaden_V2026.pdf"
                                download="CHECK24_Feedleitfaden_V2026.pdf"
                                style={{
                                    fontSize: 12, fontWeight: 600, color: '#111827',
                                    padding: '6px 14px', borderRadius: 6, border: '1px solid #E5E7EB',
                                    background: '#F9FAFB', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6,
                                }}
                            >
                                <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 1.5v7M4 6l2.5 2.5L9 6M1.5 11h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                {T.pdfDownload}
                            </a>
                            <button
                                type="button"
                                onClick={() => setShowLeitfaden(false)}
                                style={{
                                    fontSize: 18, lineHeight: 1, color: '#6B7280', background: 'none',
                                    border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 4,
                                }}
                            >
                                ✕
                            </button>
                        </div>
                    </div>
                    <iframe
                        src="https://w9cedwr8emsi29qt.public.blob.vercel-storage.com/CHECK24_Feedleitfaden_V2026.pdf"
                        style={{ flex: 1, border: 'none', borderRadius: '0 0 12px 12px' }}
                        title="Feedleitfaden 2026"
                    />
                </div>
            </div>
        )}
        {/* ── FOOTER ── */}
        <footer style={{ background: '#FFF', borderTop: '1px solid #E5E7EB', padding: '5px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: 10, color: '#9CA3AF' }}>{T.footerLeft}</span>
            <span style={{ fontSize: 10, color: '#9CA3AF' }}>{T.footerRight}</span>
        </footer>
        </div>
    );
}
