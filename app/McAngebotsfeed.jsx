import React, { useMemo, useState, useRef, useEffect } from 'react';
import Papa from 'papaparse';
import Tooltip from './Tooltip';
import * as XLSX from 'xlsx';

const VORLAGE_HEADERS = ['EAN (GTIN14)','offer_id','name','description','category_path','deeplink','brand','series','model','color','size','size_height','size_width','size_depth','size_diameter','size_lying_surface','size_seat_height','size_seat_depth','size_seat_width','orientation','weight','weight_capacity','material','surface_treatment','material_wood_quality','frame_material','temper','density','cover','removable_cover','washable_cover','care_instructions','suitable_for_allergic','certificate','number_lying_zones','filling','filling_weight','filling_quantity','quilt_type','quilt_zones','with_drawer','numbers_doors','numbers_drawers','numbers_shelf','softclose','Bildlink_1','Bildlink_2','Bildlink_3','Bildlink_4','Bildlink_5','Bildlink_6','Bildlink_7','Bildlink_8','Bildlink_9','Bildlink_10','set_includes','delivery_includes','incl_mattress','incl_slatted_frame','lighting_included','illuminant_included','energy_efficiency_label','energy_efficiency_category','socket','two_men_handling','delivery_condition','EPREL_registration_number','stock_amount','price','delivery_time','shipping_mode','shipping_cost','shipping_no_of_items','shipping_size_pack1','shipping_weight_in_kg','availability','HS-Code','manufacturer_name','manufacturer_street','manufacturer_postcode','manufacturer_city','manufacturer_country','manufacturer_email','manufacturer_phone_number','delivery_place_use','assembly_service','disposal_old_packaging','disposal_old_furniture','ce_label_declaration_confirmation','ce_label_instruction_manual','ce_label_safety_instructions','assembly_instructions','product_data_sheet','automatic_return_label'];
const VORLAGE_EXAMPLE = ['4045347288557','T12345678-123','Dreammöbel "Dream" Ecksofa mit Hocker, Kunstleder schwarz, 180 x 200 cm','Dieses wunderschöne Sofa passt perfekt in jedes Wohnzimmer. Das Kunstleder ist leicht pflegbar. Weitere Infos: Maße: B 200cm x H 80cm x T 120cm; Material: Kunstleder, …','Wohnzimmer > Sofas > Ecksofas','https://beispielfeed.link.de/T12345678','Dreammöbel','Premiumline','T12345678-123','Rot / Schwarz','H 80 x T 120 x B 200 cm','80 cm','200 cm','120 cm','500 mm','140x200 cm','40 cm','50 cm','50 cm','links, rechts, beidseitig','26,5 kg','120 kg','Holz / Metall','matt / glänzend','MDF','Aluminium','H2','RG 40','Samt / 100 % Polyester','ja oder nein','ja oder nein','Bezug waschbar bei bis zu 60 °C','ja oder nein','OEKO-TEX Standard 100 / FSC','7','100 % Daunen','1531 g','240 l','Kassettensteppung','10 x 10 Kassetten','ja oder nein','2','2','3','ja oder nein','https://beispielfeed.link.de/T12345678/image1.jpg','https://beispielfeed.link.de/T12345678/image2.jpg','https://beispielfeed.link.de/T12345678/image3.jpg','https://beispielfeed.link.de/T12345678/image4.jpg','https://beispielfeed.link.de/T12345678/image5.jpg','https://beispielfeed.link.de/T12345678/image6.jpg','https://beispielfeed.link.de/T12345678/image7.jpg','https://beispielfeed.link.de/T12345678/image8.jpg','https://beispielfeed.link.de/T12345678/image9.jpg','https://beispielfeed.link.de/T12345678/image10.jpg','2x Kissen, 2x Bettdecke','1x Tisch, 4x Stuhl','ja oder nein','ja oder nein','ja oder nein','ja oder nein','https://beispielprodukt.link.de/eek_label/T12345.jpg','C','E27','"Bordsteinkante" oder "bis in die Wohnung"','teilmontiert, montiert, zerlegt','RF-A19D-W2SV0612-P8','25','39,55','24 Werktage, 1-2 Wochen, 24','Paket, Spedition','6,95','3','120 x 29 x 29 cm','20 kg','auf Lager, sofort lieferbar','https://www.tariffnumber.com/','Frank GmbH','Teststr. 1','10117','Berlin','Deutschland','test@gmail.com','309345678','0','40','10','30','https://beispielprodukt.link.de/ce_erklaerung/T12345.pdf','https://beispielprodukt.link.de/anleitung/T34567.pdf','https://beispielprodukt.link.de/sicherheitshinweis/T12345.pdf','https://beispielprodukt.link.de/anleitung/T12345.pdf','https://beispielprodukt.link.de/produktdatenblatt/T12345.pdf','ja/nein'];

function downloadFeedvorlage() {
    const ws = XLSX.utils.aoa_to_sheet([VORLAGE_HEADERS, VORLAGE_EXAMPLE, []]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Feedvorlage');
    XLSX.writeFile(wb, 'CHECK24_Feedvorlage_2026.xlsx');
}

const FIELD_TOOLTIPS_DE = {
    name: 'Artikelname: Marke + Produktname + Typ + Farbe + Maße. Min. 5 Zeichen, kein Einwort-Titel.',
    price: 'Bruttopreis in EUR. Dezimaltrennzeichen: Komma oder Punkt (z. B. 39,99).',
    seller_offer_id: 'Eindeutige Artikel-ID Ihres Systems. Keine Duplikate zulässig.',
    brand: 'Markenname des Produkts. Min. 2 Zeichen.',
    ean: 'EAN als GTIN-13 oder GTIN-14 (13–14 Ziffern). Keine Duplikate.',
    delivery_time: 'Lieferzeit z. B. "2-4 Werktage", "1-2 Wochen" oder "24 Stunden".',
    shipping_mode: 'Versandart: "Paket" oder "Spedition".',
    availability: 'Verfügbarkeitsstatus: z. B. "auf Lager" oder "sofort lieferbar".',
    stock_amount: 'Lagerbestand als ganze Zahl (z. B. 25). Alternativ zu availability.',
    image_url: 'Direkte Bild-URL (HTTPS). Min. 800×600 px, kein Logo/Wasserzeichen.',
    description: 'HTML-Beschreibung ohne Shop-Texte oder externe Links. Min. 20 Zeichen.',
    hs_code: 'Harmonisierter Systemcode (HS-Code). Pflicht bei Lager außerhalb Deutschlands.',
    category_path: 'Kategoriepfad z. B. "Wohnzimmer > Sofas > Ecksofas".',
    delivery_includes: 'Lieferumfang im Format "1x Tisch, 4x Stuhl".',
    color: 'Farbe des Produkts (z. B. "Schwarz", "Beige / Weiß").',
    material: 'Hauptmaterial z. B. "Eiche massiv", "Kunstleder".',
    size: 'Gesamtmaße im Format H×T×B in cm.',
    size_height: 'Höhe in cm.',
    size_depth: 'Tiefe in cm.',
    size_diameter: 'Durchmesser in cm oder mm.',
    manufacturer_name: 'Vollständiger Firmenname des Herstellers.',
    manufacturer_street: 'Straße und Hausnummer des Herstellers.',
    manufacturer_postcode: 'Postleitzahl des Herstellers.',
    manufacturer_city: 'Stadt des Herstellers.',
    manufacturer_country: 'Land des Herstellers (z. B. "Deutschland").',
    manufacturer_email: 'E-Mail-Adresse des Herstellers.',
    deeplink: 'Direkte URL zum Produkt auf Ihrer Website.',
    model: 'Modellbezeichnung oder Artikelnummer des Herstellers.',
    size_lying_surface: 'Liegefläche z. B. "140×200 cm".',
    size_seat_height: 'Sitzhöhe in cm.',
    ausrichtung: 'Ausrichtung: "links", "rechts" oder "beidseitig".',
    style: 'Stilrichtung z. B. "Modern", "Skandinavisch".',
    temper: 'Härtegrad z. B. "H2", "H3".',
    weight: 'Gewicht in kg.',
    weight_capacity: 'Max. Belastbarkeit in kg.',
    youtube_link: 'YouTube-Video-URL zum Produkt oder zur Montage.',
    assembly_instructions: 'URL zur Montageanleitung (PDF).',
    illuminant_included: 'Leuchtmittel beigelegt: "ja" oder "nein".',
    incl_mattress: 'Matratze inklusive: "ja" oder "nein".',
    incl_slatted_frame: 'Lattenrost inklusive: "ja" oder "nein".',
    led_verbaut: 'LED verbaut: "ja" oder "nein".',
    lighting_included: 'Beleuchtung inklusive: "ja" oder "nein".',
    set_includes: 'Set-Inhalt z. B. "2x Kissen, 1x Decke".',
    socket: 'Steckdose/Anschluss z. B. "E27".',
    care_instructions: 'Pflegehinweise z. B. "waschbar bei 60 °C".',
    filling: 'Füllung z. B. "100 % Daunen".',
    removable_cover: 'Bezug abnehmbar: "ja" oder "nein".',
    suitable_for_allergic: 'Allergikergeeignet: "ja" oder "nein".',
    energy_efficiency_category: 'Energieeffizienzklasse z. B. "A++", "C".',
    product_data_sheet: 'URL zum Produktdatenblatt (PDF).',
    manufacturer_phone_number: 'Telefonnummer des Herstellers.',
};
const FIELD_TOOLTIPS_EN = {
    name: 'Product name: Brand + Name + Type + Color + Dimensions. Min. 5 chars, no single-word titles.',
    price: 'Gross price in EUR. Decimal separator: comma or period (e.g. 39.99).',
    seller_offer_id: 'Unique item ID from your system. No duplicates allowed.',
    brand: 'Brand name. Min. 2 characters.',
    ean: 'EAN as GTIN-13 or GTIN-14 (13–14 digits). No duplicates.',
    delivery_time: 'Delivery time e.g. "2-4 business days" or "1-2 weeks".',
    shipping_mode: 'Shipping mode: "Paket" (parcel) or "Spedition" (freight).',
    availability: 'Availability status e.g. "auf Lager" or "sofort lieferbar".',
    stock_amount: 'Stock count as integer (e.g. 25). Alternative to availability.',
    image_url: 'Direct image URL (HTTPS). Min. 800×600 px, no logo/watermark.',
    description: 'HTML description without shop texts or external links. Min. 20 chars.',
    hs_code: 'Harmonized System Code. Required when warehouse is outside Germany.',
    category_path: 'Category path e.g. "Living Room > Sofas > Corner Sofas".',
    delivery_includes: 'Delivery scope e.g. "1x Table, 4x Chair".',
    color: 'Product color (e.g. "Black", "Beige / White").',
    material: 'Main material e.g. "Solid oak", "Faux leather".',
    size: 'Overall dimensions in H×D×W format in cm.',
    size_height: 'Height in cm.',
    size_depth: 'Depth in cm.',
    size_diameter: 'Diameter in cm or mm.',
    manufacturer_name: 'Full legal name of the manufacturer.',
    manufacturer_street: 'Street and number of the manufacturer.',
    manufacturer_postcode: 'Postal code of the manufacturer.',
    manufacturer_city: 'City of the manufacturer.',
    manufacturer_country: 'Country of the manufacturer (e.g. "Germany").',
    manufacturer_email: 'E-mail address of the manufacturer.',
    deeplink: 'Direct URL to the product on your website.',
    model: 'Model designation or manufacturer article number.',
};

const EXAMPLE_FEED_CSV = `EAN (GTIN14);offer_id;name;description;brand;price;delivery_time;shipping_mode;availability;stock_amount;Bildlink_1;manufacturer_name;manufacturer_street;manufacturer_postcode;manufacturer_city;manufacturer_country;manufacturer_email
4045347288557;T12345-SW;Dreammöbel Dream Ecksofa mit Hocker, Kunstleder schwarz, 180x200 cm;Elegantes Ecksofa aus hochwertigem Kunstleder in Schwarz. Maße: B 200 cm × H 80 cm × T 120 cm. Pflegeleicht und strapazierfähig. Inkl. Hocker.;Dreammöbel;599.00;3-5 Werktage;Spedition;auf Lager;12;https://example.com/img/sofa-schwarz.jpg;Traum GmbH;Musterstr. 1;10115;Berlin;Deutschland;info@traumgmbh.de
4045347288558;T12345-GR;Dreammöbel Dream Ecksofa mit Hocker, Kunstleder grau, 180x200 cm;Elegantes Ecksofa aus hochwertigem Kunstleder in Grau. Maße: B 200 cm × H 80 cm × T 120 cm. Pflegeleicht und strapazierfähig. Inkl. Hocker.;Dreammöbel;579.00;3-5 Werktage;Spedition;auf Lager;8;https://example.com/img/sofa-grau.jpg;Traum GmbH;Musterstr. 1;10115;Berlin;Deutschland;info@traumgmbh.de
4045347299001;T67890;Holztisch;Tisch aus Holz.;NaturWood;149.99;1-2 Wochen;Paket;auf Lager;25;https://example.com/img/tisch.jpg;NaturWood GmbH;Waldweg 5;80331;München;Deutschland;service@naturwood.de
;T99999;Regal;Schönes Regal für viele Bücher und Dekogegenstände, sehr praktisch und stabil aus MDF gefertigt.;HomeStyle;89.00;2-4 Werktage;Paket;auf Lager;5;https://example.com/img/regal.jpg;HomeStyle KG;Hauptstr. 10;20095;Hamburg;Deutschland;info@homestyle.de
4045347299002;T55555;;Modernes Sideboard aus Eiche massiv, naturfarben. Breite 160 cm, Höhe 75 cm, Tiefe 40 cm.;OakLine;349.00;1-2 Wochen;Spedition;sofort lieferbar;3;https://example.com/img/sideboard.jpg;OakLine GmbH;Eichenweg 3;50667;Köln;Deutschland;kontakt@oakline.de
4045347299003;T55555;Bücherregal Weiß 80cm breit, MDF lackiert;Weißes Bücherregal aus MDF, hochglanz lackiert. 5 Fächer, Breite 80 cm × Höhe 180 cm × Tiefe 30 cm.;HomeStyle;129.00;2-4 Werktage;Paket;auf Lager;15;https://example.com/img/buecherregal.jpg;HomeStyle KG;Hauptstr. 10;20095;Hamburg;Deutschland;info@homestyle.de`;

// Word lists for title structure analysis
const COLOR_WORDS_DE = ['schwarz','weiß','weiss','grau','beige','braun','natur','naturfarben','silber','gold','rot','blau','grün','gelb','orange','türkis','creme','sand','anthrazit','cognac','cappuccino','taupe','dunkelgrau','hellgrau','dunkelbraun','elfenbein','bordeaux','petrol'];
const COLOR_WORDS_EN = ['black','white','grey','gray','beige','brown','natural','silver','gold','red','blue','green','yellow','orange','turquoise','cream','sand','anthracite','cognac','taupe','dark','light'];
const MATERIAL_WORDS_DE = ['holz','eiche','kiefer','buche','ahorn','mdf','spanplatte','fichte','metall','stahl','edelstahl','aluminium','chrom','eisen','messing','kupfer','stoff','textil','leinen','baumwolle','polyester','velvet','samt','kunstleder','leder','glas','marmor','stein','beton','kunststoff','plastik','acryl','bambus','rattan','massiv'];
const MATERIAL_WORDS_EN = ['wood','oak','pine','beech','maple','mdf','metal','steel','stainless','aluminum','chrome','iron','brass','copper','fabric','linen','cotton','polyester','velvet','faux leather','leather','glass','marble','stone','plastic','acrylic','bamboo','rattan','solid'];
const DIMENSION_RE = /\d+[,.]?\d*\s*[×xX]\s*\d+|\d+[,.]?\d*\s*(cm|mm)\b/i;
const DELIVERY_INCLUDES_RE = /\d+\s*[xX×]\s*\S+/;
const NON_FURNITURE_CAT_RE = /\b(auto|kfz|spielzeug|elektronik|mode|kleidung|fashion|computer|handy|smartphone|sport|bücher|buch|lebensmittel|büro)\b/i;
const LIGHTING_TITLE_RE = /lampe|leuchte|licht\b|beleuchtung\b|\bled\b/i;
const LIGHTING_NO_RE = /ohne beleuchtung|nicht beleuchtet/i;
const SHIPPING_MODE_ALIASES = { package: 'paket', parcel: 'paket', freight: 'spedition', delivery: 'paket', express: 'paket' };
const TEMPLATE_DESC_RE = /beispieltext|musterbeschreibung|lorem ipsum/i;
const ADVERTISING_RE = /jetzt kaufen|rabatt\b|angebot\b/i;
const EXTERNAL_LINK_RE = /www\.|https?:\/\//i;

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
const HEADER_BG = '#0F2557';
const PAGE_BG = '#F0F2F5';
const CARD_BORDER = '#E2E6EE';
const TEXT_PRIMARY = '#0F2557';
const TEXT_MUTED = '#7A8499';
const TEXT_HINT = '#9099A8';

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
    'manufacturer_phone_number',
    // Informationen (2)
    'deeplink',
    'model',
    // Produktmerkmale
    'size_lying_surface',
    'size_seat_height',
    'ausrichtung',
    'style',
    'temper',
    'weight',
    // Medien extra
    'assembly_instructions',
    // Funktion & Ausstattung
    'illuminant_included',
    'incl_mattress',
    'incl_slatted_frame',
    'socket',
    // Textilien & Polster
    'removable_cover',
    // Nachweise (2)
    'energy_efficiency_category',
    'product_data_sheet',
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
    stepUpload: 'Hochladen', stepMapping: 'Zuordnung', stepResults: 'Pflichtfeldanalyse', stepOptional: 'Optionale Felder', stepRecommendations: 'Empfehlungen',
    helpContact: 'Hilfe & Kontakt',
    // Step 1
    s1Heading: 'Ihren Feed prüfen',
    s1Sub: 'CSV hochladen - wir analysieren Pflicht- und optionale Felder und zeigen, welche Artikel sofort veröffentlicht werden können.',
    fileReading: 'Wird gelesen…',
    fileLoaded: (n) => `${n} Artikel erkannt`,
    fileChange: 'Andere Datei',
    dropHeading: 'CSV-Datei auswählen',
    dropSub: 'Hierher ziehen oder klicken',
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
    mappingTitle: 'Spalten-Zuordnung',
    mappingFound: (f, t) => `${f} von ${t} Feldern automatisch erkannt.`,
    mappingMissing: (n) => `${n} Pflichtfeld${n > 1 ? 'er' : ''} fehlt`,
    mappingWarning: 'Bitte ordnen Sie die rot markierten Pflichtfelder manuell zu, bevor Sie fortfahren.',
    notAssigned: '-- Nicht zugeordnet --',
    mainImageLabel: 'Hauptbild (+ Zusatzb.)',
    notDetected: '(nicht erkannt)',
    hiddenFields: (n) => `${n} weitere optionale Felder nicht im Feed erkannt`,
    startAnalysis: 'Analyse starten →',
    // Step 3
    newFeed: 'Neuen Feed prüfen',
    statusOk: 'Feed fehlerfrei - alle Artikel können gelistet werden.',
    statusErr: 'Fehler gefunden - bitte beheben und Feed erneut hochladen.',
    errorRateFmt: (r) => `Fehlerquote: ${r.replace('.', ',')}%`,
    analysisTitle: 'Pflichtfelder',
    analysisSubtitle: 'Diese Felder müssen für jeden Artikel ausgefüllt sein',
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
    csvErrScientific: (l) => `${l}: wissenschaftliche Notation (z. B. 1.23e+13), als Zahl speichern`,
    csvErrSieheOben: (l) => `${l}: enthält "siehe oben", ungültig`,
    csvErrExternalLink: (l) => `${l}: enthält externe URL, nicht erlaubt`,
    csvErrTemplate: (l) => `${l}: enthält Musterwert / Lorem-Ipsum`,
    csvErrAdvertising: (l) => `${l}: enthält Werbephrasen`,
    csvErrIdentical: (l) => `${l}: identisch mit Artikelname`,
    csvErrSingleImage: 'Bild: nur 1 Bild vorhanden, mindestens 3 empfohlen',
    csvEanDup: 'EAN: doppelt vorhanden',
    csvNameDup: 'Artikelname: doppelt vorhanden',
    csvOfferIdDup: 'Eigene Artikel-ID: doppelt vorhanden',
    csvWrongCategory: 'Kategoriepfad: scheint keine Möbel-Kategorie zu sein',
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
    statusBanner: (n, t) => `Bitte beheben Sie die Fehler und laden Sie den Feed erneut hoch. ${n} von ${t} Artikeln betroffen`,
    hinweisTitle: 'Wichtige Hinweise zum Feed',
    hinweisBeforeNext: 'Vor dem nächsten Upload prüfen',
    hinweisPflicht: {
        label: 'PFLICHT', color: '#DC2626', bg: '#FEF2F2', border: '#FECACA',
        title: 'Kritische Anforderungen', sub: 'Bei Verstoß keine Listing',
        items: [
            'Ausschließlich Neuware zulässig im Feed',
            'EAN (GTIN) je Produkt, nur 1 EAN je Produkt, keine Duplikate',
            'Bestand oder Availability muss gesetzt sein',
            'HS-Code notwendig, wenn Lager außerhalb Deutschlands',
            'Eindeutige Eigene Artikel-ID (Seller_Offer_ID) je Produkt',
            'Preis, Versandart und Lieferzeit vollständig angegeben',
            'Vollständige Herstellerangaben: Marke, Name, Adresse, E-Mail',
        ],
    },
    hinweisQuality: {
        label: 'QUALITÄT', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A',
        title: 'Sichtbarkeit & Darstellung', sub: 'Beeinflusst Conversion',
        items: [
            'Titelformat: Marke + Produktname + Produktart + Material + Farbe + Maße',
            'Beispiel: Dreammöbel „Dream" Boxspringbett, Kunstleder, schwarz, 180×200 cm',
            'Guter Titel = bessere Auffindbarkeit, höhere Klickrate & korrekte Produktgruppe',
            'Bilder mind. 800 × 600 px, kein Logo/Wasserzeichen, Freisteller',
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
            'Beschreibung empfohlen im HTML-Format (Absätze, Listen, Hervorhebungen)',
            'Besonderheiten & Vorteile klar herausstellen; Struktur durch Stichpunkte',
            'Ohne Beschreibung kann ein Produkt nicht angelegt werden',
            'Keine Werbung, kein Cross-Selling, keine Variantenauswahl ("erhältlich in 3 Größen")',
            'Keine externen Links, kein Hinweis auf eigenen Kundenservice oder Lieferdienst',
            'Lieferumfang im Format „1x Tisch, 4x Stuhl"',
            'Leere Spalten leer lassen, kein „0", „X", „nicht vorhanden"',
            'Category_Path korrekt zugeordnet (z. B. Boxspringbett)',
        ],
    },
    portalUrl: 'mc.moebel.check24.de/settings/offerfeed',
    portalBtn: 'Zum Portal →',
    reuploadTitle: 'Korrigierten Feed hochladen',
    reuploadSub: 'Datei hier ablegen oder direkt im Händlerportal hochladen.',
    footerLeft: 'CHECK24 Feed Checker · Stand: 04/2026 · Hinweise basieren auf dem aktuellen Feedleitfaden',
    footerRight: 'v2.4.1 · contentmanagement.moebel@check24.de',
    howTitle: 'In 5 Schritten zum perfekten Feed',
    howSummary: 'CSV hochladen, Spalten zuordnen, Fehler beheben - direkt im Browser, ohne Anmeldung.',
    howSteps: [
        { n: 1, title: 'Hochladen', desc: 'CSV-Datei per Drag & Drop hochladen.' },
        { n: 2, title: 'Zuordnung', desc: 'Spalten den passenden Feldern zuordnen.' },
        { n: 3, title: 'Pflichtfelder', desc: 'Alle Pflichtfelder werden geprüft.' },
        { n: 4, title: 'Optionale Felder', desc: 'Empfohlene Felder für bessere Sichtbarkeit.' },
        { n: 5, title: 'Empfehlungen', desc: 'Fehlerbericht als CSV herunterladen und korrigieren.' },
    ],
    warehouseDEsub: 'Kein HS-Code erforderlich',
    warehouseNonDEsub: 'HS-Code wird als Pflichtfeld geprüft',
    continueMappingBtn: 'Weiter zur Spalten-Zuordnung',
    feedTemplateSub2: 'Excel-Datei mit allen Pflichtfeldern',
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
        { field: 'name', icon: '✏️', title: 'Artikelname', bad: 'Sofa grau', good: 'Mustermarke Sofa 3-Sitzer Cord grau 200 cm', tips: ['Mindestens 2 Wörter: Marke + Produkt + Hauptattribut', 'Keine B-Ware-Hinweise, max. 255 Zeichen', 'GTIN-konforme Bezeichnung'] },
        { field: 'description', icon: '📝', title: 'Beschreibung', tips: ['Mindestens 100 Zeichen, besser 300–500 Zeichen', 'Wichtige Eigenschaften nennen: Material, Farbe, Maße, Besonderheiten', 'Keine reinen Aufzählungen, fließender Text wirkt besser', 'Keine Werbefloskeln wie „günstig" oder „Top-Qualität"'] },
        { field: 'ean', icon: '🔢', title: 'EAN (GTIN14)', tips: ['Muss exakt 14 Stellen lang sein (führende Nullen ergänzen)', 'Muss eindeutig pro Artikel sein, keine Duplikate', 'Nicht erfundene oder Test-EANs verwenden', 'Handelsübliche GTIN aus GS1-Datenbank'] },
        { field: 'image_url', icon: '🖼️', title: 'Produktbild', tips: ['Freisteller auf weißem oder transparentem Hintergrund', 'Mindestens 600×600 Pixel, optimal 1000×1000+', 'Öffentlich erreichbare URL (kein Login erforderlich)', 'Kein Wasserzeichen, keine Preise im Bild'] },
        { field: 'price', icon: '💶', title: 'Preis & Lieferung', tips: ['Preis im Format 19.99 (Punkt als Dezimaltrennzeichen)', 'Versandart muss einen gültigen Wert enthalten', 'Lieferzeit als Werktage angeben, z. B. „3-5"', 'Verfügbarkeit / Bestand stets aktuell halten'] },
    ],
    qualityShowMore: 'Alle Tipps anzeigen',
    qualityShowLess: 'Weniger anzeigen',
    resourcesTitle: 'Ressourcen',
    recNextStep: 'Optionale Felder →',
    recNextStepFinal: 'Empfehlungen →',
    recTitle: (n) => `${n} Handlungsempfehlung${n !== 1 ? 'en' : ''} zur Fehlerbehebung`,
    recNoErrorsTitle: 'Alles in Ordnung',
    recNoErrorsSub: 'Ihr Feed enthält keine kritischen Fehler. Alle Artikel können gelistet werden.',
    recPriority: 'Kritisch',
    recAffected: (n) => `${n} Artikel betroffen`,
    recDownloadTitle: 'Fehlerbericht als CSV',
    recDownloadDesc: 'Pro Artikel werden alle Fehler in einer Spalte aufgelistet - direkt in Excel korrigierbar.',
    recDownloadBtn: 'Fehlerbericht herunterladen',
    optFieldsTitle: 'Optionale Felder',
    optFieldsSubtitle: 'Keine Pflicht - aber sie verbessern Filter, Suche und Conversion',
    sizeHintTitle: 'Maß-Attribut fehlt',
    sizeHintDesc: (n) => `${n} Artikel haben kein Maß-Attribut (size, size_height, size_depth, Liegefläche o. ä.)`,
    lightingHintTitle: 'Energie-Kennzeichnung für Leuchtprodukte',
    lightingHintDesc: (total, energyMissing, eprelMissing) => `${total} Leuchtprodukte erkannt · ${energyMissing} ohne Energieeffizienzklasse · ${eprelMissing} ohne EPREL-Nummer`,
};

const EN_T = {
    stepUpload: 'Upload', stepMapping: 'Mapping', stepResults: 'Results', stepOptional: 'Optional Fields', stepRecommendations: 'Recommendations',
    helpContact: 'Help & Contact',
    s1Heading: 'Check Your Feed',
    s1Sub: 'Upload a CSV - we analyze required and optional fields and show which items are ready to list.',
    fileReading: 'Reading…',
    fileLoaded: (n) => `${n} items detected`,
    fileChange: 'Different file',
    dropHeading: 'Select CSV file',
    dropSub: 'Drag here or click',
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
    mappingTitle: 'Column Mapping',
    mappingFound: (f, t) => `${f} of ${t} fields automatically detected.`,
    mappingMissing: (n) => `${n} required field${n > 1 ? 's' : ''} missing`,
    mappingWarning: 'Please manually assign the red-highlighted required fields before continuing.',
    notAssigned: '-- Not assigned --',
    mainImageLabel: 'Main Image (+ Add.)',
    notDetected: '(not detected)',
    hiddenFields: (n) => `${n} more optional fields not detected in feed`,
    startAnalysis: 'Start Analysis →',
    newFeed: 'Check New Feed',
    statusOk: 'Feed is error-free - all items can be listed.',
    statusErr: 'Errors found - please fix and re-upload the feed.',
    errorRateFmt: (r) => `Error rate: ${r}%`,
    analysisTitle: 'Required Fields',
    analysisSubtitle: 'These fields must be filled for every item',
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
    csvErrScientific: (l) => `${l}: scientific notation (e.g. 1.23e+13), save as plain number`,
    csvErrSieheOben: (l) => `${l}: contains "siehe oben", invalid`,
    csvErrExternalLink: (l) => `${l}: contains external URL, not allowed`,
    csvErrTemplate: (l) => `${l}: contains template/lorem-ipsum text`,
    csvErrAdvertising: (l) => `${l}: contains advertising phrases`,
    csvErrIdentical: (l) => `${l}: identical to item name`,
    csvErrSingleImage: 'Image: only 1 image, at least 3 recommended',
    csvEanDup: 'EAN: duplicate',
    csvNameDup: 'Item Name: duplicate',
    csvOfferIdDup: 'Own Item ID: duplicate',
    csvWrongCategory: 'Category path: does not appear to be a furniture category',
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
        { field: 'name', icon: '✏️', title: 'Item Name', bad: 'Sofa grey', good: 'BrandName Sofa 3-seater cord grey 200 cm', tips: ['At least 2 words: Brand + Product + Key Attribute', 'No used-goods labels, max 255 characters', 'GTIN-compliant name'] },
        { field: 'description', icon: '📝', title: 'Description', tips: ['At least 100 characters, ideally 300–500', 'Include key attributes: material, color, dimensions, features', 'Flowing text works better than bullet lists alone', 'Avoid marketing phrases like "cheap" or "top quality"'] },
        { field: 'ean', icon: '🔢', title: 'EAN (GTIN14)', tips: ['Must be exactly 14 digits (pad with leading zeros)', 'Must be unique per item - no duplicates', 'Do not use invented or test EANs', 'Use a valid GTIN from the GS1 database'] },
        { field: 'image_url', icon: '🖼️', title: 'Product Image', tips: ['White or transparent background (cut-out)', 'At least 600×600 pixels, ideally 1000×1000+', 'Publicly accessible URL (no login required)', 'No watermarks or prices in the image'] },
        { field: 'price', icon: '💶', title: 'Price & Delivery', tips: ['Price in format 19.99 (dot as decimal separator)', 'Shipping mode must contain a valid value', 'Delivery time in working days, e.g. "3-5"', 'Keep availability/stock always up to date'] },
    ],
    qualityShowMore: 'Show all tips',
    qualityShowLess: 'Show less',
    resourcesTitle: 'Resources',
    recNextStep: 'Optional Fields →',
    recNextStepFinal: 'Recommendations →',
    recTitle: (n) => `${n} Recommendation${n !== 1 ? 's' : ''} to Fix Errors`,
    recNoErrorsTitle: 'All clear',
    recNoErrorsSub: 'Your feed has no critical errors. All items can be listed.',
    recPriority: 'Critical',
    recAffected: (n) => `${n} item${n !== 1 ? 's' : ''} affected`,
    recDownloadTitle: 'Error report as CSV',
    recDownloadDesc: 'All errors per item in one column - directly fixable in Excel.',
    recDownloadBtn: 'Download error report',
    optFieldsTitle: 'Optional Fields',
    optFieldsSubtitle: 'Not required - but they boost filters, search and conversion',
    sizeHintTitle: 'Size attribute missing',
    sizeHintDesc: (n) => `${n} items have no size attribute (size, size_height, size_depth, lying surface, etc.)`,
    lightingHintTitle: 'Energy labelling for lighting products',
    lightingHintDesc: (total, energyMissing, eprelMissing) => `${total} lighting products detected · ${energyMissing} without energy efficiency class · ${eprelMissing} without EPREL number`,
    listableCount: (l, t) => `${l} / ${t} items listable`,
    statusBanner: (n, t) => `Please fix the errors and re-upload the feed. ${n} of ${t} items affected`,
    hinweisTitle: 'Important Feed Requirements',
    hinweisBeforeNext: 'Check before next upload',
    hinweisPflicht: {
        label: 'REQUIRED', color: '#DC2626', bg: '#FEF2F2', border: '#FECACA',
        title: 'Critical Requirements', sub: 'Violations prevent listing',
        items: [
            'Only new goods allowed in the feed',
            'EAN (GTIN) per product, only 1 EAN per product, no duplicates',
            'Stock or Availability must be set',
            'HS Code required if warehouse is outside Germany',
            'Unique Own Item ID (Seller_Offer_ID) per product',
            'Price, shipping mode, and delivery time fully provided',
            'Complete manufacturer info: brand, name, address, email',
        ],
    },
    hinweisQuality: {
        label: 'QUALITY', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A',
        title: 'Visibility & Presentation', sub: 'Affects conversion',
        items: [
            'Title format: Brand + Product name + Type + Material + Color + Size',
            'Example: Dreammöbel "Dream" Boxspring bed, faux leather, black, 180×200 cm',
            'Good title = better findability, higher CTR & correct product category',
            'Images min. 800 × 600 px, no logos/watermarks, cut-out preferred',
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
            'Description recommended in HTML format (paragraphs, lists, emphasis)',
            'Highlight unique features & benefits clearly; use bullet points for structure',
            'Missing description = product cannot be listed',
            'No advertising, no cross-selling, no variant selection text ("available in 3 sizes")',
            'No external links, no mention of own customer service or delivery',
            'Delivery scope in format "1x Table, 4x Chair"',
            'Leave empty fields blank, no "0", "X", "not available"',
            'Category_Path correctly mapped (e.g. Boxspring bed)',
        ],
    },
    portalUrl: 'mc.moebel.check24.de/settings/offerfeed',
    portalBtn: 'Go to Portal →',
    reuploadTitle: 'Upload corrected feed',
    reuploadSub: 'Drop file here or upload directly in the merchant portal.',
    footerLeft: 'CHECK24 Feed Checker · As of 04/2026 · Notes based on current feed guide',
    footerRight: 'v2.4.1 · contentmanagement.moebel@check24.de',
    // How it works
    howTitle: 'From CSV to perfect feed in 5 steps',
    howSummary: 'Upload, map, fix - all in your browser, no sign-in needed.',
    howSteps: [
        { n: 1, title: 'Upload', desc: 'Drag & drop your CSV file.' },
        { n: 2, title: 'Mapping', desc: 'Map columns to the matching feed fields.' },
        { n: 3, title: 'Required Fields', desc: 'All required fields are validated.' },
        { n: 4, title: 'Optional Fields', desc: 'Recommended fields for better visibility.' },
        { n: 5, title: 'Recommendations', desc: 'Download the error report and fix in Excel.' },
    ],
    warehouseDEsub: 'No HS Code required',
    warehouseNonDEsub: 'HS Code validated as required field',
    continueMappingBtn: 'Continue to Column Mapping',
    feedTemplateSub2: 'Excel file with all required fields',
};

export default function McAngebotsfeed() {
    const showQualityScore = false; // not public yet - re-enable when ready

    const [file, setFile] = useState(null);
    const [dragging, setDragging] = useState(false);
    const [showLeitfaden, setShowLeitfaden] = useState(false);
    const [showVorlage, setShowVorlage] = useState(false);
    const [vorlageSearch, setVorlageSearch] = useState('');
    const [storeLocation] = useState('germany');
    const [step, setStep] = useState(1);
    const [rows, setRows] = useState([]);
    const [headers, setHeaders] = useState([]);
    const [manualMapping, setManualMapping] = useState({});
    const [expandedRecs, setExpandedRecs] = useState(() => new Set());
    const [lang, setLang] = useState('de');
    const [langOpen, setLangOpen] = useState(false);
    const [alwaysAvailable, setAlwaysAvailable] = useState(false);
    const [optionalExpanded, setOptionalExpanded] = useState(false);
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
            if (c === 'availability') return !alwaysAvailable && !mcMapping['availability'] && !mcMapping['stock_amount'];
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
        const duplicateOfferIds = {};

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
                if (key === 'stock_amount') continue;
                if (key === 'availability') {
                    if (alwaysAvailable) {
                        // skip availability/stock_amount checks when alwaysAvailable is true
                        continue;
                    }
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
                        // Only flag stock_amount as invalid when it's the sole availability signal;
                        // if a valid avVal is already present, a non-numeric stVal is just a secondary field issue
                        const avOk = avVal && !isPlaceholder(avVal);
                        if (stVal && !/^\d+$/.test(stVal) && !avOk) {
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
                if (key === 'ean') {
                    if (/\d+\.?\d*[eE][+\-]?\d+/.test(val)) {
                        pflichtErrors.push({ row: rn, ean, field: 'ean', type: 'scientific', value: val });
                        pflichtOk = false;
                    } else if (!/^\d+$/.test(val)) {
                        pflichtErrors.push({ row: rn, ean, field: 'ean', type: 'invalid', value: val });
                        pflichtOk = false;
                    } else if (val.length !== 13 && val.length !== 14) {
                        pflichtErrors.push({ row: rn, ean, field: 'ean', type: 'wrong_length', value: val });
                        pflichtOk = false;
                    }
                }
                if (key === 'name') {
                    if (val.length < 10) {
                        pflichtErrors.push({ row: rn, ean, field: 'name', type: 'too_short', value: val });
                        pflichtOk = false;
                    } else if (val.trim().split(/\s+/).length < 2) {
                        pflichtErrors.push({ row: rn, ean, field: 'name', type: 'one_word', value: val });
                        pflichtOk = false;
                    } else if (/siehe oben/i.test(val)) {
                        pflichtErrors.push({ row: rn, ean, field: 'name', type: 'siehe_oben', value: val });
                        // warning only - does not block listing
                    }
                }
                if (key === 'brand' && val.length < 2) {
                    pflichtErrors.push({ row: rn, ean, field: 'brand', type: 'too_short', value: val });
                    pflichtOk = false;
                }
                if (key === 'description') {
                    if (TEMPLATE_DESC_RE.test(val)) {
                        pflichtErrors.push({ row: rn, ean, field: 'description', type: 'template', value: val });
                        pflichtOk = false;
                    } else if (val.length < 50 || val.trim().split(/\s+/).length <= 3) {
                        pflichtErrors.push({ row: rn, ean, field: 'description', type: 'too_short', value: val });
                        pflichtOk = false;
                    } else if (/b-?ware/i.test(val)) {
                        pflichtErrors.push({ row: rn, ean, field: 'description', type: 'bware', value: val });
                        pflichtOk = false;
                    } else if (EXTERNAL_LINK_RE.test(val)) {
                        pflichtErrors.push({ row: rn, ean, field: 'description', type: 'external_link', value: val });
                        pflichtOk = false;
                    } else {
                        // Non-blocking warnings
                        if (ADVERTISING_RE.test(val)) {
                            pflichtErrors.push({ row: rn, ean, field: 'description', type: 'advertising', value: val });
                        }
                        if (name && val.toLowerCase() === name.toLowerCase()) {
                            pflichtErrors.push({ row: rn, ean, field: 'description', type: 'identical_to_title', value: val });
                        }
                    }
                }
                if (key === 'price') {
                    const n = parseFloat(val.replace(',', '.'));
                    if (Number.isNaN(n) || n <= 0) {
                        pflichtErrors.push({ row: rn, ean, field: key, type: 'invalid', value: val });
                        pflichtOk = false;
                    }
                }
                if (key === 'shipping_mode') {
                    const normalized = SHIPPING_MODE_ALIASES[val.toLowerCase()] ?? val.toLowerCase();
                    if (normalized !== 'paket' && normalized !== 'spedition') {
                        pflichtErrors.push({ row: rn, ean, field: key, type: 'invalid', value: val });
                        pflichtOk = false;
                    }
                }
                if (key === 'delivery_time' && !/\d/.test(val)) {
                    pflichtErrors.push({ row: rn, ean, field: key, type: 'invalid', value: val });
                    pflichtOk = false;
                }
            }

            // Image count
            if (mcImageColumns.length > 0) {
                const imgCount = mcImageColumns.reduce((c, col) => c + (String(row[col] ?? '').trim() ? 1 : 0), 0);
                if (imgCount === 0) {
                    pflichtErrors.push({ row: rn, ean, field: 'image_url', type: 'missing' });
                    pflichtOk = false;
                } else if (imgCount === 1) {
                    pflichtErrors.push({ row: rn, ean, field: 'image_url', type: 'single' });
                    // warning but does not block listing
                } else if (imgCount < 3) {
                    optionalHints.push({ row: rn, ean, field: 'image_url' });
                }
            }

            // HS-Code
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

            // Delivery_includes format check
            if (mcMapping.delivery_includes) {
                const diVal = String(row[mcMapping.delivery_includes] ?? '').trim();
                if (diVal && !DELIVERY_INCLUDES_RE.test(diVal)) {
                    optionalHints.push({ row: rn, ean, field: 'delivery_includes' });
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
            const extraImageCols = mcImageColumns.slice(1, 10);
            optionalFieldsPresent += extraImageCols.filter((col) => String(row[col] ?? '').trim()).length;

            // Wrong category detection
            if (mcMapping.category_path) {
                const catVal = String(row[mcMapping.category_path] ?? '').trim();
                if (catVal && NON_FURNITURE_CAT_RE.test(catVal)) {
                    pflichtErrors.push({ row: rn, ean, field: 'category_path', type: 'wrong_category', value: catVal });
                    // warning only
                }
            }

            // Lighting/energy check
            if (name && LIGHTING_TITLE_RE.test(name) && !LIGHTING_NO_RE.test(name)) {
                const energyFilled = (mcMapping.energy_efficiency_category && String(row[mcMapping.energy_efficiency_category] ?? '').trim()) ||
                    (mcMapping.lighting_included && /^nein$/i.test(String(row[mcMapping.lighting_included] ?? '').trim()));
                if (!energyFilled) {
                    optionalHints.push({ row: rn, ean, field: 'energy_efficiency_category' });
                }
            }

            // EAN duplicate tracking
            if (ean) {
                if (!duplicateEans[ean]) duplicateEans[ean] = [];
                duplicateEans[ean].push(rn);
            }
            // Name duplicate tracking
            if (name) {
                if (!duplicateNames[name]) duplicateNames[name] = [];
                duplicateNames[name].push(rn);
            }
            // Name+EAN tracking
            if (name && ean) {
                const k = `${name}|||${ean}`;
                if (!duplicateNameEans[k]) duplicateNameEans[k] = [];
                duplicateNameEans[k].push(rn);
            }
            // Seller offer ID duplicate tracking
            const offerId = mcMapping.seller_offer_id ? String(row[mcMapping.seller_offer_id] ?? '').trim() : '';
            if (offerId) {
                if (!duplicateOfferIds[offerId]) duplicateOfferIds[offerId] = [];
                duplicateOfferIds[offerId].push(rn);
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
        const offerIdDupRows = new Set(
            Object.values(duplicateOfferIds)
                .filter((r) => r.length > 1)
                .flat(),
        );
        const dupOfferIdCount = Object.values(duplicateOfferIds)
            .filter((r) => r.length > 1)
            .reduce((s, r) => s + r.length, 0);
        // Stufe 1: live-fähig = no pflicht errors AND no EAN/Name/OfferID duplicate
        const livefaehigCount = rows.filter((_, i) => !pflichtErrorRowNums.has(i + 1) && !eanDupRows.has(i + 1) && !nameDupRows.has(i + 1) && !offerIdDupRows.has(i + 1)).length;

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

        // Scoring – Pflichtfelder-Score (0–100) + Optionale-Felder-Score (0–100) → Gesamt = Durchschnitt
        const pflichtScore = rows.length ? Math.round((livefaehigCount / rows.length) * 100) : 0;
        const optionalFillRatio =
            rows.length && optionalFieldCount > 0 ? totalOptionalFieldsPresent / (rows.length * optionalFieldCount) : 0;
        const optionalScore = Math.round(optionalFillRatio * 100);
        const totalScore = Math.max(0, Math.min(100, Math.round((pflichtScore + optionalScore) / 2)));

        // Optional field stats for step 4
        const OPT_FIELDS_TO_CHECK = ['color', 'material', 'brand', 'description', 'delivery_includes'];
        const OPT_FIELD_LABELS_DE = { color: 'Farbe', material: 'Material', brand: 'Marke', description: 'Beschreibung', delivery_includes: 'Lieferumfang' };
        const OPT_FIELD_LABELS_EN = { color: 'Color', material: 'Material', brand: 'Brand', description: 'Description', delivery_includes: 'Delivery Includes' };
        const optFields = OPT_FIELDS_TO_CHECK.map((field) => {
            const col = mcMapping[field];
            if (!col) return { field, labelDE: OPT_FIELD_LABELS_DE[field], labelEN: OPT_FIELD_LABELS_EN[field], covered: 0, missing: rows.length, total: rows.length, pct: 0, notMapped: true };
            let covered = 0;
            rows.forEach((row) => { if (String(row[col] ?? '').trim()) covered++; });
            const missing = rows.length - covered;
            return { field, labelDE: OPT_FIELD_LABELS_DE[field], labelEN: OPT_FIELD_LABELS_EN[field], covered, missing, total: rows.length, pct: rows.length ? Math.round((covered / rows.length) * 100) : 0, notMapped: false };
        });

        // Size: at least one size field filled
        const SIZE_FIELDS = ['size', 'size_height', 'size_depth', 'size_width', 'size_lying_surface', 'size_seat_height', 'size_seat_depth', 'size_diameter'];
        let sizeMissingCount = 0;
        rows.forEach((row) => {
            const hasAnySize = SIZE_FIELDS.some((sf) => {
                const col = mcMapping[sf];
                return col && String(row[col] ?? '').trim();
            });
            if (!hasAnySize) sizeMissingCount++;
        });

        // Lighting products: name contains leuchte/lampe/led
        const LIGHTING_OPT_RE = /leuchte|lampe|\bled\b/i;
        const eprelCol = mcMapping['eprel_registration_number'] || (() => {
            // fallback: check headers for eprel
            const h = headers.find((h) => h.toLowerCase().includes('eprel'));
            return h || null;
        })();
        const energyCol = mcMapping['energy_efficiency_category'];
        const nameColOpt = mcMapping['name'];
        let lightingCount = 0, lightingEnergyMissing = 0, lightingEprelMissing = 0;
        if (nameColOpt) {
            rows.forEach((row) => {
                const nm = String(row[nameColOpt] ?? '').trim();
                if (!LIGHTING_OPT_RE.test(nm)) return;
                lightingCount++;
                if (!energyCol || !String(row[energyCol] ?? '').trim()) lightingEnergyMissing++;
                if (!eprelCol || !String(row[eprelCol] ?? '').trim()) lightingEprelMissing++;
            });
        }

        const optFieldStats = { fields: optFields, sizeMissingCount, lightingCount, lightingEnergyMissing, lightingEprelMissing };

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
            offerIdDupRows,
            dupOfferIdCount,
            pflichtCategoryErrors,
            pflichtScore,
            optionalScore,
            optionalFillRatio,
            totalScore,
            optFieldStats,
        };
    }, [rows, headers, mcMapping, mcImageColumns, storeLocation, alwaysAvailable]);

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
        if (issues.offerIdDupRows) issues.offerIdDupRows.forEach((rn) => {
            if (!fieldErrorRows.seller_offer_id) fieldErrorRows.seller_offer_id = new Set();
            fieldErrorRows.seller_offer_id.add(rn);
        });
    }

    const errorRate = issues ? (issues.blockiertCount / issues.totalRows) * 100 : 0;
    const stufe1Passed = issues ? errorRate <= 5 : false;

    const allRequiredMapped = MC_PFLICHT_COLS.every(f => {
        if (f === 'image_url') return mcImageColumns.length > 0;
        if (f === 'stock_amount') return true; // handled with availability
        if (f === 'availability') return alwaysAvailable || !!(mcMapping.availability || mcMapping.stock_amount);
        return !!mcMapping[f];
    }) && (!outsideGermany || !!mcMapping['hs_code']);


    return (
        <div style={{ background: '#F3F4F6', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* ── HEADER ── */}
            <header style={{ background: MC_BLUE, padding: '10px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                <span onClick={resetToStart} style={{ color: '#FFF', fontWeight: 900, fontSize: 22, letterSpacing: '-0.5px', fontStyle: 'italic', whiteSpace: 'nowrap', flexShrink: 0, cursor: 'pointer' }}>
                    FEED CHECKER
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {/* Resource buttons */}
                    <button type="button" onClick={() => setShowLeitfaden(true)}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid rgba(255,255,255,0.3)', background: 'transparent', color: '#FFF', fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 6, cursor: 'pointer' }}>
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M2.5 1.5h8.5l3 3v10h-11.5v-13z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/><path d="M11 1.5v3h3" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/><path d="M5 8h6M5 10.5h6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                        {T.feedGuide}
                    </button>
                    <button type="button" onClick={() => setShowVorlage(true)}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid rgba(255,255,255,0.3)', background: 'transparent', color: '#FFF', fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 6, cursor: 'pointer' }}>
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M8 2v8M5 7l3 3 3-3M2 13h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        {T.feedTemplate}
                    </button>
                    <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.2)', margin: '0 2px' }} />
                    {/* Language dropdown */}
                    <div style={{ position: 'relative' }}>
                        <button type="button" onClick={() => setLangOpen((v) => !v)}
                            style={{ display: 'flex', alignItems: 'center', gap: 7, background: langOpen ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: langOpen ? '8px 8px 0 0' : 8, padding: '6px 12px', cursor: 'pointer', color: '#FFF', fontSize: 13, fontWeight: 600, transition: 'background 0.15s' }}>
                            {lang === 'de' ? (
                                <svg width="18" height="13" viewBox="0 0 18 13" style={{ borderRadius: 2, flexShrink: 0 }}>
                                    <rect width="18" height="4.33" y="0" fill="#000"/>
                                    <rect width="18" height="4.33" y="4.33" fill="#D00"/>
                                    <rect width="18" height="4.34" y="8.66" fill="#FFCE00"/>
                                </svg>
                            ) : (
                                <svg width="18" height="13" viewBox="0 0 18 13" style={{ borderRadius: 2, flexShrink: 0 }}>
                                    <rect width="18" height="13" fill="#012169"/>
                                    <path d="M0 0L18 13M18 0L0 13" stroke="#FFF" strokeWidth="2.6"/>
                                    <path d="M0 0L18 13M18 0L0 13" stroke="#C8102E" strokeWidth="1.4"/>
                                    <path d="M9 0v13M0 6.5h18" stroke="#FFF" strokeWidth="3.5"/>
                                    <path d="M9 0v13M0 6.5h18" stroke="#C8102E" strokeWidth="2"/>
                                </svg>
                            )}
                            <span>{lang === 'de' ? 'Deutsch' : 'English'}</span>
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ opacity: 0.8, transform: langOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}><path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </button>
                        {langOpen && (
                            <>
                                {/* Click-outside backdrop */}
                                <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setLangOpen(false)} />
                                <div style={{ position: 'absolute', top: '100%', right: 0, background: '#FFF', borderRadius: '0 0 8px 8px', border: '1px solid rgba(255,255,255,0.25)', boxShadow: '0 8px 24px rgba(0,0,0,0.18)', overflow: 'hidden', zIndex: 100, minWidth: '100%' }}>
                                    {[{ value: 'de', label: 'Deutsch' }, { value: 'en', label: 'English' }].map((opt) => (
                                        <button key={opt.value} type="button"
                                            onClick={() => { setLang(opt.value); setLangOpen(false); }}
                                            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', background: lang === opt.value ? '#EEF4FF' : '#FFF', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: lang === opt.value ? 700 : 400, color: lang === opt.value ? MC_BLUE : '#374151', whiteSpace: 'nowrap' }}>
                                            {opt.value === 'de' ? (
                                                <svg width="18" height="13" viewBox="0 0 18 13" style={{ borderRadius: 2, flexShrink: 0 }}>
                                                    <rect width="18" height="4.33" y="0" fill="#000"/>
                                                    <rect width="18" height="4.33" y="4.33" fill="#D00"/>
                                                    <rect width="18" height="4.34" y="8.66" fill="#FFCE00"/>
                                                </svg>
                                            ) : (
                                                <svg width="18" height="13" viewBox="0 0 18 13" style={{ borderRadius: 2, flexShrink: 0 }}>
                                                    <rect width="18" height="13" fill="#012169"/>
                                                    <path d="M0 0L18 13M18 0L0 13" stroke="#FFF" strokeWidth="2.6"/>
                                                    <path d="M0 0L18 13M18 0L0 13" stroke="#C8102E" strokeWidth="1.4"/>
                                                    <path d="M9 0v13M0 6.5h18" stroke="#FFF" strokeWidth="3.5"/>
                                                    <path d="M9 0v13M0 6.5h18" stroke="#C8102E" strokeWidth="2"/>
                                                </svg>
                                            )}
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
                        style={{ border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.08)', color: '#FFFFFF', fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
                    >
                        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ flexShrink: 0 }}><rect x="1" y="2.5" width="11" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M1 4l5.5 3.5L12 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
                        {T.helpContact}
                    </a>
                </div>
            </header>
        {/* ── MAIN BODY ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* Step tabs bar */}
            <div style={{ background: '#fff', borderBottom: '1px solid #E2E6EE', padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, flexShrink: 0, position: 'relative' }}>
                {[
                    { n: 1, label: T.stepUpload },
                    { n: 2, label: T.stepMapping },
                    { n: 3, label: T.stepResults },
                    { n: 4, label: T.stepOptional },
                    { n: 5, label: T.stepRecommendations },
                ].map((s) => {
                    const isActive = step === s.n;
                    const isDone = step > s.n;
                    const isClickable = s.n === 1 || (s.n === 2 && rows.length > 0) || ((s.n === 3 || s.n === 4 || s.n === 5) && issues);
                    const tabColor = isDone ? '#166534' : isActive ? MC_BLUE : TEXT_HINT;
                    return (
                        <button
                            key={s.n}
                            type="button"
                            onClick={() => {
                                if (s.n === 1) setStep(1);
                                else if (s.n === 2 && rows.length > 0) setStep(2);
                                else if ((s.n === 3 || s.n === 4 || s.n === 5) && issues) setStep(s.n);
                            }}
                            style={{ height: 50, display: 'flex', alignItems: 'center', gap: 8, padding: '0 24px', background: 'none', border: 'none', borderBottom: isActive ? `2px solid ${MC_BLUE}` : '2px solid transparent', cursor: isClickable ? 'pointer' : 'default', color: tabColor, opacity: isClickable ? 1 : 0.5, transition: 'all 0.15s', whiteSpace: 'nowrap', position: 'relative' }}
                        >
                            <div style={{ width: 22, height: 22, borderRadius: '50%', border: `1.5px solid ${tabColor}`, background: (isActive || isDone) ? tabColor : 'transparent', color: (isActive || isDone) ? '#fff' : tabColor, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
                                {isDone ? '✓' : s.n}
                            </div>
                            <span style={{ fontSize: 13, fontWeight: isActive ? 600 : 500, letterSpacing: 0.1 }}>{s.label}</span>
                            {s.n < 5 && (
                                <span style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', height: 18, width: 1, background: '#E5E7EB' }} />
                            )}
                        </button>
                    );
                })}
                {/* Start over link — absolutely positioned so tabs stay centered */}
                {rows.length > 0 && (
                    <button type="button" onClick={resetToStart}
                        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap' }}>
                        <svg width="11" height="11" viewBox="0 0 14 14" fill="none"><path d="M2 7a5 5 0 105-5H5m0 0l2-2M5 2L3 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        {lang === 'de' ? 'Neu starten' : 'Start over'}
                    </button>
                )}
            </div>

            {/* Scrollable area: step content + sticky bars */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>

            {/* Step content */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 32px', boxSizing: 'border-box' }}>

            {/* ══════════════════════════════════════════
                STEP 1 - Upload
            ══════════════════════════════════════════ */}
            {step === 1 && (
                <div style={{ width: '100%', maxWidth: 1100, display: 'grid', gridTemplateColumns: '1fr 420px', gap: 20, alignItems: 'start' }}>

                    {/* Left column: How-it-works + Resources */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                        {/* How it works card */}
                        <div style={{ background: '#FFF', borderRadius: 12, border: '1px solid #E2E6EE', overflow: 'hidden' }}>
                            <div style={{ padding: '14px 18px 10px', borderBottom: '1px solid #F3F4F6' }}>
                                <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 2 }}>{T.howTitle}</div>
                                <div style={{ fontSize: 11, color: '#6B7280', lineHeight: 1.45 }}>{T.howSummary}</div>
                            </div>
                            {T.howSteps.map((s, i) => (
                                <div key={s.n} style={{ padding: '8px 18px', borderBottom: i < T.howSteps.length - 1 ? '1px solid #F3F4F6' : 'none', display: 'flex', gap: 10, alignItems: 'center' }}>
                                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#EEF3FF', color: MC_BLUE, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{s.n}</div>
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                        <div style={{ fontSize: 12, fontWeight: 600, color: '#111827', display: 'inline' }}>{s.title}</div>
                                        <span style={{ fontSize: 11, color: '#6B7280', lineHeight: 1.4 }}> · {s.desc}</span>
                                    </div>
                                </div>
                            ))}
                            {/* Quality = reach banner - inside the how-it-works card */}
                            <div style={{ margin: '10px 18px 14px', background: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)', border: '1px solid #FDE68A', borderRadius: 8, padding: '8px 12px' }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: '#92400E', display: 'inline' }}>
                                    {lang === 'de' ? 'Besserer Feed = mehr Reichweite.' : 'Better feed = more reach.'}
                                </div>
                                <span style={{ fontSize: 11, color: '#78350F', lineHeight: 1.4 }}>
                                    {' '}
                                    {lang === 'de'
                                        ? 'Vollständige Daten = bessere Platzierung und schnellere Freischaltung.'
                                        : 'Complete data = better placement and faster activation.'}
                                </span>
                            </div>
                        </div>

                        {/* Resources card */}
                        <div style={{ background: '#FFF', borderRadius: 12, border: '1px solid #E2E6EE', padding: '18px 24px' }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 12 }}>{T.resourcesTitle}</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                {/* Feedleitfaden card */}
                                <button type="button" onClick={() => setShowLeitfaden(true)}
                                    style={{ display: 'flex', flexDirection: 'column', borderRadius: 8, border: '1px solid #E2E6EE', background: '#FAFAFA', cursor: 'pointer', textAlign: 'left', overflow: 'hidden', padding: 0 }}>
                                    <div style={{ width: '100%', height: 110, overflow: 'hidden', borderBottom: '1px solid #E2E6EE', background: '#F9FAFB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <img
                                            src="https://w9cedwr8emsi29qt.public.blob.vercel-storage.com/Bildschirmfoto%202026-05-04%20um%2014.43.56.png"
                                            alt="Checkliste Vorschau"
                                            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', display: 'block' }}
                                        />
                                    </div>
                                    <div style={{ padding: '8px 12px' }}>
                                        <div style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{lang === 'de' ? 'Checkliste für gute Produktdaten' : 'Checklist for good product data'}</div>
                                        <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2, lineHeight: 1.4 }}>{lang === 'de' ? 'Pflichtfelder, Bildvorgaben & Qualitätstipps · PDF' : 'Required fields, image specs & quality tips · PDF'}</div>
                                    </div>
                                </button>
                                {/* Feedvorlage card */}
                                <button type="button" onClick={() => setShowVorlage(true)}
                                    style={{ display: 'flex', flexDirection: 'column', borderRadius: 8, border: '1px solid #E2E6EE', background: '#FAFAFA', cursor: 'pointer', textAlign: 'left', overflow: 'hidden', padding: 0 }}>
                                    <div style={{ width: '100%', height: 110, borderBottom: '1px solid #E2E6EE', overflow: 'hidden', background: '#F0FDF4', display: 'flex', alignItems: 'stretch' }}>
                                        <svg viewBox="0 0 260 110" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
                                            {/* Background */}
                                            <rect width="260" height="110" fill="#F0FDF4"/>
                                            {/* Top header bar */}
                                            <rect width="260" height="26" fill="#16A34A"/>
                                            <text x="10" y="17" fontFamily="Arial,sans-serif" fontSize="9.5" fontWeight="700" fill="white">CHECK24 Feedvorlage 2026</text>
                                            {/* 92 Felder badge */}
                                            <rect x="194" y="5" width="56" height="16" rx="3" fill="rgba(255,255,255,0.18)"/>
                                            <text x="222" y="16.5" fontFamily="Arial,sans-serif" fontSize="8" fontWeight="700" fill="white" textAnchor="middle">92 Felder</text>
                                            {/* Column header row */}
                                            <rect y="26" width="260" height="15" fill="#DCFCE7"/>
                                            {/* Columns: EAN | offer_id | name | brand | price */}
                                            {[
                                                { label: 'EAN',      x: 0,   w: 46 },
                                                { label: 'offer_id', x: 46,  w: 58 },
                                                { label: 'name',     x: 104, w: 72 },
                                                { label: 'brand',    x: 176, w: 48 },
                                                { label: 'price',    x: 224, w: 36 },
                                            ].map(({ label, x, w }) => (
                                                <g key={label}>
                                                    <rect x={x} y="26" width={w} height="15" fill="none" stroke="#BBF7D0" strokeWidth="0.5"/>
                                                    <text x={x + 5} y="36.5" fontFamily="Arial,sans-serif" fontSize="7.5" fontWeight="600" fill="#166534">{label}</text>
                                                </g>
                                            ))}
                                            {/* Data rows */}
                                            {[41, 56, 71, 86].map((y, ri) => (
                                                <g key={ri}>
                                                    <rect y={y} width="260" height="15" fill={ri % 2 === 0 ? '#F0FDF4' : '#FFFFFF'}/>
                                                    {[
                                                        { x: 0,   w: 46, bw: 30 },
                                                        { x: 46,  w: 58, bw: 40 },
                                                        { x: 104, w: 72, bw: 55 },
                                                        { x: 176, w: 48, bw: 32 },
                                                        { x: 224, w: 36, bw: 22 },
                                                    ].map(({ x, w, bw }) => (
                                                        <g key={x}>
                                                            <rect x={x} y={y} width={w} height="15" fill="none" stroke="#BBF7D0" strokeWidth="0.5"/>
                                                            <rect x={x + 5} y={y + 5} width={bw} height="5" rx="1.5" fill="#D1FAE5"/>
                                                        </g>
                                                    ))}
                                                </g>
                                            ))}
                                            {/* Pflichtangaben footer row */}
                                            <rect y="101" width="260" height="9" fill="#FEF3C7"/>
                                            <text x="8" y="108.5" fontFamily="Arial,sans-serif" fontSize="6.5" fontWeight="700" fill="#92400E">Pflichtangaben</text>
                                        </svg>
                                    </div>
                                    <div style={{ padding: '8px 12px' }}>
                                        <div style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{lang === 'de' ? 'Feedvorlage herunterladen' : 'Download Feed Template'}</div>
                                        <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2, lineHeight: 1.4 }}>{T.feedTemplateSub2}</div>
                                    </div>
                                </button>
                            </div>
                        </div>


                    </div>

                    {/* Right column: Upload card */}
                    <div style={{ background: '#FFF', borderRadius: 12, border: '1px solid #E2E6EE', overflow: 'hidden', position: 'sticky', top: 20, alignSelf: 'flex-start' }}>
                        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #F3F4F6' }}>
                            <div style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 2 }}>{T.s1Heading}</div>
                            <div style={{ fontSize: 12, color: '#9CA3AF', lineHeight: 1.45 }}>{T.s1Sub}</div>
                        </div>

                        <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
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
                                    style={{ border: `2px dashed ${dragging ? MC_BLUE : '#D1D5DB'}`, background: dragging ? '#EEF4FF' : '#F9FAFB', borderRadius: 10, padding: '32px 20px', cursor: 'pointer', transition: 'all 0.15s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}
                                >
                                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#EEF3FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={{ color: MC_BLUE }}>
                                            <path d="M7 17A4.5 4.5 0 017 8h.1A6.5 6.5 0 0120 9.5a4 4 0 010 8H7z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                                            <path d="M12 17v-6m0 0l-2 2m2-2l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                        </svg>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 3 }}>{T.dropHeading}</div>
                                        <div style={{ fontSize: 12, color: '#9CA3AF' }}>{lang === 'de' ? 'Hierher ziehen oder klicken' : 'Drag here or click'}</div>
                                    </div>
                                    <div style={{ fontSize: 11, color: '#9CA3AF', background: '#F3F4F6', borderRadius: 20, padding: '3px 12px' }}>
                                        {lang === 'de' ? 'CSV · UTF-8' : 'CSV · UTF-8'}
                                    </div>
                                    <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={(e) => parseFile(e.target.files?.[0] || null)} />
                                </div>
                            )}

                            {/* Load example feed */}
                            {!file && (
                                <button type="button" onClick={() => {
                                    Papa.parse(EXAMPLE_FEED_CSV, {
                                        header: true,
                                        delimiter: ';',
                                        skipEmptyLines: true,
                                        complete: (res) => {
                                            const r = Array.isArray(res.data) ? res.data : [];
                                            const h = res.meta?.fields || Object.keys(r[0] || {});
                                            setHeaders(h);
                                            setRows(r);
                                            setManualMapping({});
                                            setFile({ name: lang === 'de' ? 'Beispiel-Feed.csv' : 'Example-Feed.csv', size: EXAMPLE_FEED_CSV.length });
                                        },
                                    });
                                }}
                                    style={{ width: '100%', padding: '9px', background: '#FFF', color: '#374151', border: '1px dashed #D1D5DB', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M8 2l1.5 3.5L13 6l-2.5 2.5.5 3.5L8 10.5 5 12l.5-3.5L3 6l3.5-.5L8 2z" stroke="#9CA3AF" strokeWidth="1.3" strokeLinejoin="round"/></svg>
                                    {lang === 'de' ? 'Beispiel-Feed laden (6 Artikel, inkl. Fehler)' : 'Load example feed (6 items, incl. errors)'}
                                </button>
                            )}

                            {/* Primary CTA */}
                            <button
                                type="button"
                                onClick={() => rows.length > 0 && setStep(2)}
                                disabled={rows.length === 0}
                                style={{ width: '100%', padding: '14px', background: rows.length > 0 ? MC_BLUE : '#D1D5DB', color: '#FFF', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: rows.length > 0 ? 'pointer' : 'default', transition: 'background 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                            >
                                {rows.length > 0 ? T.continueMappingBtn : T.uploadPrompt}
                                {rows.length > 0 && <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                            </button>
                        </div>
                    </div>{/* end upload card */}

                </div>
            )}

            {/* ══════════════════════════════════════════
                STEP 2 - Spalten-Zuordnung
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

                // Missing pflicht fields
                const missingPflicht2 = issues ? issues.missingPflichtCols : [];

                const langDE = lang === 'de';

                // Fields for left (Pflicht) column: MC_PFLICHT_COLS minus image_url, plus hs_code if outside germany
                // Hide stock_amount - merged into availability row
                const pflichtFieldsLeft = [
                    ...MC_PFLICHT_COLS.filter((f) => f !== 'image_url' && f !== 'stock_amount'),
                    ...(outsideGermany ? ['hs_code'] : []),
                ];

                // Fields for middle (Optional) column: MC_OPTIONAL_COLS
                const optionalFieldsMid = MC_OPTIONAL_COLS;

                // Compute used columns for dedup (across all fields including image)
                const usedCols = new Set(
                    Object.entries(mcMapping)
                        .filter(([, v]) => v)
                        .map(([, v]) => v)
                );

                const MappingRow = ({ fieldKey, label, isPflicht, isImageRow }) => {
                    if (isImageRow) {
                        return (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 0' }}>
                                <Tooltip text={(langDE ? FIELD_TOOLTIPS_DE : FIELD_TOOLTIPS_EN)['image_url'] || null}>
                                    <span style={{ fontSize: 11, color: '#374151', width: 120, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 3, cursor: 'help', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {T.mainImageLabel}<span style={{ color: '#DC2626', fontWeight: 700 }}>*</span>
                                        <span style={{ fontSize: 9, color: '#9CA3AF', borderRadius: '50%', border: '1px solid #D1D5DB', width: 12, height: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>?</span>
                                    </span>
                                </Tooltip>
                                <div style={{ flex: 1, minWidth: 0, fontSize: 11, padding: '4px 7px', borderRadius: 5, border: `1px solid ${mcImageColumns.length > 0 ? '#D1FAE5' : '#FCA5A5'}`, background: mcImageColumns.length > 0 ? '#F0FDF4' : '#FFF5F5', color: mcImageColumns.length > 0 ? '#166534' : '#DC2626', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {mcImageColumns.length > 0 ? mcImageColumns.join(', ') : T.notDetected}
                                </div>
                            </div>
                        );
                    }

                    const isAvailability = fieldKey === 'availability';
                    const col = mcMapping[fieldKey];
                    const missing = !col && isPflicht && !(isAvailability && alwaysAvailable);
                    const tooltipText = (langDE ? FIELD_TOOLTIPS_DE : FIELD_TOOLTIPS_EN)[fieldKey] || null;
                    // Options excluding columns used by other fields
                    const availableHeaders = headers.filter((h) => h === col || !usedCols.has(h));

                    const selectValue = (isAvailability && alwaysAvailable) ? '__always_available__' : (col || '');
                    return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '4px 0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Tooltip text={tooltipText}>
                                    <span style={{ fontSize: 11, color: '#374151', width: 120, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 3, cursor: tooltipText ? 'help' : 'default', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {label}
                                        {isPflicht && <span style={{ color: '#DC2626', fontWeight: 700, flexShrink: 0 }}>*</span>}
                                        {tooltipText && <span style={{ fontSize: 9, color: '#9CA3AF', borderRadius: '50%', border: '1px solid #D1D5DB', width: 12, height: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>?</span>}
                                    </span>
                                </Tooltip>
                                <select
                                    value={selectValue}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        if (isAvailability && val === '__always_available__') {
                                            setAlwaysAvailable(true);
                                            setManualMapping((prev) => { const next = { ...prev }; delete next[fieldKey]; return next; });
                                            return;
                                        }
                                        if (isAvailability) setAlwaysAvailable(false);
                                        setManualMapping((prev) => {
                                            const next = { ...prev };
                                            if (val === '') delete next[fieldKey];
                                            else next[fieldKey] = val;
                                            return next;
                                        });
                                    }}
                                    style={{ flex: 1, minWidth: 0, fontSize: 11, padding: '4px 5px', borderRadius: 5, border: `1px solid ${(isAvailability && alwaysAvailable) ? '#D1FAE5' : missing ? '#FCA5A5' : col ? '#D1FAE5' : '#D1D5DB'}`, background: (isAvailability && alwaysAvailable) ? '#F0FDF4' : missing ? '#FFF5F5' : col ? '#F0FDF4' : '#FFF', cursor: 'pointer' }}
                                >
                                    <option value="">{T.notAssigned}</option>
                                    {isAvailability && (
                                        <>
                                            <option value="__always_available__">{langDE ? 'Immer verfügbar' : 'Always available'}</option>
                                            <option value="" disabled>──────────────</option>
                                        </>
                                    )}
                                    {availableHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                                </select>
                                {col && !(isAvailability && alwaysAvailable) && (
                                    <button
                                        type="button"
                                        title={langDE ? 'Zuordnung entfernen' : 'Clear assignment'}
                                        onClick={() => setManualMapping((prev) => { const next = { ...prev }; next[fieldKey] = ''; return next; })}
                                        style={{ fontSize: 11, lineHeight: 1, padding: '3px 6px', borderRadius: 4, border: '1px solid #D1D5DB', background: '#F9FAFB', color: '#6B7280', cursor: 'pointer', flexShrink: 0 }}
                                    >×</button>
                                )}
                            </div>
                        </div>
                    );
                };

                return (
                    <div style={{ width: '100%', maxWidth: 1100, overflowX: 'hidden' }}>
                        {mcIsWrongFile ? (
                            <div style={{ padding: '20px', borderRadius: 12, border: '1px solid #FECACA', background: '#FEF2F2', display: 'flex', gap: 12 }}>
                                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0, color: '#DC2626' }}><path d="M10 3L2 17h16L10 3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M10 9v3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><circle cx="10" cy="14.5" r="0.75" fill="currentColor"/></svg>
                                <div>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: '#B91C1C', marginBottom: 4 }}>{T.wrongFileTitle}</div>
                                    <div style={{ fontSize: 11, color: '#7F1D1D', lineHeight: 1.6 }}>{T.wrongFileDesc}</div>
                                </div>
                            </div>
                        ) : (
                            <div style={{ background: '#FFF', borderRadius: 12, overflow: 'hidden' }}>

                                {/* Card header */}
                                <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid #F3F4F6' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: missingPflicht2.length > 0 ? 6 : 0 }}>
                                        <div style={{ fontSize: 16, fontWeight: 800, color: '#111827' }}>{T.mappingTitle}</div>
                                        {missingPflicht2.length > 0 && (
                                            <div style={{ fontSize: 12, color: '#DC2626', fontWeight: 600 }}>{T.mappingMissing(missingPflicht2.length)}</div>
                                        )}
                                    </div>
                                    {missingPflicht2.length > 0 && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#DC2626' }}>
                                            <span style={{ color: '#DC2626', fontWeight: 700 }}>*</span>
                                            <span>{langDE ? 'Rot markierte Felder sind Pflichtfelder und müssen zugeordnet werden.' : 'Fields marked red are required and must be mapped before continuing.'}</span>
                                        </div>
                                    )}
                                </div>


                                {/* 3-column mapping layout (always visible) */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 260px', gap: 0, borderTop: '1px solid #F3F4F6', minWidth: 0, overflowX: 'hidden' }}>

                                    {/* LEFT: Pflichtfelder */}
                                    <div style={{ padding: '12px 14px', borderRight: '1px solid #F3F4F6', minWidth: 0, overflowX: 'hidden' }}>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.06em', marginBottom: 8 }}>
                                            {langDE ? 'PFLICHTFELDER' : 'REQUIRED FIELDS'}
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                            {pflichtFieldsLeft.map((f) => (
                                                <MappingRow
                                                    key={f}
                                                    fieldKey={f}
                                                    label={FIELD_LABELS[f] || f}
                                                    isPflicht={true}
                                                />
                                            ))}
                                            {/* Image row */}
                                            <MappingRow isImageRow={true} fieldKey="image_url" label={T.mainImageLabel} isPflicht={true} />
                                        </div>
                                    </div>

                                    {/* MIDDLE: Optionale Felder */}
                                    {(() => {
                                        const matchedOpt = optionalFieldsMid.filter((f) => !!mcMapping[f]);
                                        const unmatchedOpt = optionalFieldsMid.filter((f) => !mcMapping[f]);
                                        return (
                                            <div style={{ padding: '12px 14px', borderRight: '1px solid #F3F4F6', minWidth: 0, overflowX: 'hidden' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                                    <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.06em' }}>
                                                        {langDE ? 'OPTIONALE FELDER' : 'OPTIONAL FIELDS'}
                                                    </div>
                                                    <div style={{ fontSize: 10, color: '#9CA3AF' }}>
                                                        {matchedOpt.length}/{optionalFieldsMid.length} {langDE ? 'zugeordnet' : 'mapped'}
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                                    {matchedOpt.length === 0 && !optionalExpanded && (
                                                        <div style={{ fontSize: 11, color: '#9CA3AF', padding: '6px 2px' }}>
                                                            {langDE ? 'Keine optionalen Felder erkannt.' : 'No optional fields detected.'}
                                                        </div>
                                                    )}
                                                    {matchedOpt.map((f) => (
                                                        <MappingRow key={f} fieldKey={f} label={FIELD_LABELS[f] || f} isPflicht={false} />
                                                    ))}
                                                    {optionalExpanded && unmatchedOpt.map((f) => (
                                                        <MappingRow key={f} fieldKey={f} label={FIELD_LABELS[f] || f} isPflicht={false} />
                                                    ))}
                                                </div>
                                                {unmatchedOpt.length > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setOptionalExpanded((v) => !v)}
                                                        style={{ marginTop: 8, width: '100%', padding: '5px 8px', background: 'none', border: '1px dashed #D1D5DB', borderRadius: 5, fontSize: 11, color: '#6B7280', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                                                    >
                                                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" style={{ transform: optionalExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}><path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                                        {optionalExpanded
                                                            ? (langDE ? 'Weniger anzeigen' : 'Show less')
                                                            : (langDE ? `${unmatchedOpt.length} weitere anzeigen` : `Show ${unmatchedOpt.length} more`)}
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })()}

                                    {/* RIGHT: Warnings / unassigned pflicht fields */}
                                    <div style={{ padding: '12px 14px', background: '#FFF', minWidth: 0, overflowX: 'hidden' }}>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.06em', marginBottom: 8 }}>
                                            {langDE ? 'FEHLER / HINWEISE' : 'ERRORS / HINTS'}
                                        </div>
                                        {missingPflicht2.length === 0 ? (
                                            <div style={{ fontSize: 12, color: '#16A34A', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                                                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8l4 4 6-6" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                                {langDE ? 'Alle Pflichtfelder zugeordnet' : 'All required fields mapped'}
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                                {missingPflicht2.map((f) => {
                                                    const label = f === 'image_url' ? (langDE ? 'Hauptbild' : 'Main Image') : (FIELD_LABELS[f] || f);
                                                    return (
                                                        <div key={f} style={{ fontSize: 11, display: 'flex', alignItems: 'flex-start', gap: 5, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 5, padding: '5px 8px' }}>
                                                            <span style={{ color: '#DC2626', fontWeight: 700, flexShrink: 0, marginTop: 1 }}>✕</span>
                                                            <div>
                                                                <div style={{ color: '#991B1B', fontWeight: 600 }}>{label}</div>
                                                                <div style={{ color: '#B91C1C', fontSize: 10 }}>{langDE ? 'nicht zugeordnet' : 'not assigned'}</div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                                <div style={{ fontSize: 10, color: '#B45309', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 5, padding: '6px 8px', marginTop: 4, lineHeight: 1.5 }}>
                                                    {T.mappingWarning}
                                                </div>
                                            </div>
                                        )}
                                        {/* Detected fields summary */}
                                        <div style={{ marginTop: 14 }}>
                                            <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.06em', marginBottom: 6 }}>
                                                {langDE ? 'ERKANNT' : 'DETECTED'}
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                                {MC_PFLICHT_COLS.filter((f) => f !== 'stock_amount' && (f === 'image_url' ? mcImageColumns.length > 0 : f === 'availability' ? (mcMapping.availability || mcMapping.stock_amount || alwaysAvailable) : mcMapping[f])).slice(0, 6).map((f) => {
                                                    const col = f === 'image_url' ? mcImageColumns[0] : mcMapping[f];
                                                    const lbl = f === 'image_url' ? (langDE ? 'Hauptbild' : 'Main Image') : (FIELD_LABELS[f] || f);
                                                    return (
                                                        <div key={f} style={{ fontSize: 10, color: '#166534', display: 'flex', alignItems: 'baseline', gap: 3 }}>
                                                            <span style={{ color: '#16A34A', fontWeight: 700, flexShrink: 0 }}>✓</span>
                                                            <span style={{ color: '#374151' }}>{lbl}</span>
                                                            {col && <span style={{ color: '#9CA3AF', fontSize: 9 }}>→ {col}</span>}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Bottom nav */}
                                <div style={{ padding: '10px 20px', borderTop: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                                    <div style={{ fontSize: 11, color: (issues?.missingPflichtCols?.length ?? 0) > 0 ? '#DC2626' : '#16A34A', fontWeight: 600 }}>
                                        {(issues?.missingPflichtCols?.length ?? 0) > 0
                                            ? (lang === 'de'
                                                ? `${issues.missingPflichtCols.length} Pflichtfeld${issues.missingPflichtCols.length > 1 ? 'er' : ''} fehlen noch`
                                                : `${issues.missingPflichtCols.length} required field${issues.missingPflichtCols.length > 1 ? 's' : ''} missing`)
                                            : (lang === 'de' ? '✓ Alle Pflichtfelder zugeordnet' : '✓ All required fields mapped')
                                        }
                                    </div>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button type="button" onClick={() => setStep(1)}
                                            style={{ padding: '10px 16px', background: '#fff', border: '1px solid #D0D5E0', borderRadius: 8, color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                                            {T.back}
                                        </button>
                                        <button type="button" onClick={() => setStep(3)}
                                            style={{ padding: '10px 16px', background: MC_BLUE, border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                                            {T.startAnalysis}
                                        </button>
                                    </div>
                                </div>

                            </div>
                        )}
                    </div>
                );
            })()}

            {/* ══════════════════════════════════════════
                STEP 3 - Ergebnis
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
                const eanCol3 = mcMapping.ean;
                const getEansFromRowSet = (rowNumSet, max = 5) => {
                    if (!eanCol3 || !rowNumSet) return [];
                    const result = [];
                    for (const rn of rowNumSet) {
                        const ean = String(rows[rn - 1]?.[eanCol3] ?? '').trim();
                        if (ean && !result.includes(ean)) result.push(ean);
                        if (result.length >= max) break;
                    }
                    return result;
                };
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
                    else if (e.type === 'scientific') label = T.csvErrScientific(fieldLabel);
                    else if (e.type === 'siehe_oben') label = T.csvErrSieheOben(fieldLabel);
                    else if (e.type === 'external_link') label = T.csvErrExternalLink(fieldLabel);
                    else if (e.type === 'template') label = T.csvErrTemplate(fieldLabel);
                    else if (e.type === 'advertising') label = T.csvErrAdvertising(fieldLabel);
                    else if (e.type === 'identical_to_title') label = T.csvErrIdentical(fieldLabel);
                    else if (e.type === 'single' && e.field === 'image_url') label = T.csvErrSingleImage;
                    else if (e.type === 'wrong_category') label = T.csvWrongCategory;
                    else label = T.csvErrFallback(fieldLabel);
                    const key = `${e.field}::${e.type}`;
                    if (!errorsByType[key]) errorsByType[key] = { label, count: 0, sampleEans: [] };
                    errorsByType[key].count++;
                    if (e.ean && errorsByType[key].sampleEans.length < 5 && !errorsByType[key].sampleEans.includes(e.ean)) {
                        errorsByType[key].sampleEans.push(e.ean);
                    }
                });
                if (issues.eanDupRows.size > 0) errorsByType['ean::dup'] = { label: T.csvEanDup, count: issues.eanDupRows.size, sampleEans: getEansFromRowSet(issues.eanDupRows) };
                if (issues.nameDupRows.size > 0) errorsByType['name::dup'] = { label: T.csvNameDup, count: issues.nameDupRows.size, sampleEans: getEansFromRowSet(issues.nameDupRows) };
                if (issues.offerIdDupRows && issues.offerIdDupRows.size > 0) errorsByType['seller_offer_id::dup'] = { label: T.csvOfferIdDup, count: issues.offerIdDupRows.size, sampleEans: getEansFromRowSet(issues.offerIdDupRows) };
                const detailedErrors = Object.values(errorsByType)
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 7);

                // Description length distribution
                const descCol = mcMapping['description'];
                const descStats = descCol ? (() => {
                    const buckets = { short: 0, ok: 0, good: 0, great: 0 };
                    let total = 0, totalChars = 0;
                    rows.forEach((r) => {
                        const d = String(r[descCol] ?? '').trim();
                        if (!d) return;
                        total++;
                        totalChars += d.length;
                        if (d.length < 50) buckets.short++;
                        else if (d.length < 150) buckets.ok++;
                        else if (d.length < 500) buckets.good++;
                        else buckets.great++;
                    });
                    return { total, avg: total ? Math.round(totalChars / total) : 0, buckets };
                })() : null;

                // Title structure analysis
                const nameCol = mcMapping['name'];
                const brandCol = mcMapping['brand'];
                const colorWords = lang === 'de' ? COLOR_WORDS_DE : COLOR_WORDS_EN;
                const materialWords = lang === 'de' ? MATERIAL_WORDS_DE : MATERIAL_WORDS_EN;
                const titleAnalysis = nameCol ? (() => {
                    let missingColor = 0, missingMaterial = 0, missingDimension = 0, missingBrand = 0;
                    const sampleBad = [];
                    rows.forEach((r) => {
                        const title = String(r[nameCol] ?? '').trim().toLowerCase();
                        const brand = brandCol ? String(r[brandCol] ?? '').trim().toLowerCase() : '';
                        if (!title) return;
                        const hasColor = colorWords.some(w => title.includes(w));
                        const hasMaterial = materialWords.some(w => title.includes(w));
                        const hasDimension = DIMENSION_RE.test(title);
                        const hasBrand = brand && title.includes(brand);
                        if (!hasColor) missingColor++;
                        if (!hasMaterial) missingMaterial++;
                        if (!hasDimension) missingDimension++;
                        if (brandCol && !hasBrand) missingBrand++;
                        if ((!hasColor || !hasMaterial || !hasDimension) && sampleBad.length < 2) {
                            sampleBad.push({ title: String(r[nameCol] ?? ''), hasColor, hasMaterial, hasDimension });
                        }
                    });
                    return { total: rows.length, missingColor, missingMaterial, missingDimension, missingBrand: brandCol ? missingBrand : null, sampleBad };
                })() : null;

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
                        if (e.type === 'scientific') return T.csvErrScientific(label);
                        if (e.type === 'siehe_oben') return T.csvErrSieheOben(label);
                        if (e.type === 'external_link') return T.csvErrExternalLink(label);
                        if (e.type === 'template') return T.csvErrTemplate(label);
                        if (e.type === 'advertising') return T.csvErrAdvertising(label);
                        if (e.type === 'identical_to_title') return T.csvErrIdentical(label);
                        if (e.type === 'single' && e.field === 'image_url') return T.csvErrSingleImage;
                        if (e.type === 'wrong_category') return T.csvWrongCategory;
                        return T.csvErrFallback(label);
                    };
                    issues.pflichtErrors.forEach((e) => { if (!pflichtByRow[e.row]) pflichtByRow[e.row] = []; pflichtByRow[e.row].push(errorMsg(e)); });
                    issues.eanDupRows.forEach((rn) => { if (!pflichtByRow[rn]) pflichtByRow[rn] = []; pflichtByRow[rn].push(T.csvEanDup); });
                    issues.nameDupRows.forEach((rn) => { if (!pflichtByRow[rn]) pflichtByRow[rn] = []; pflichtByRow[rn].push(T.csvNameDup); });
                    if (issues.offerIdDupRows) issues.offerIdDupRows.forEach((rn) => { if (!pflichtByRow[rn]) pflichtByRow[rn] = []; pflichtByRow[rn].push(T.csvOfferIdDup); });
                    issues.optionalHints.forEach((e) => { if (!optionalByRow[e.row]) optionalByRow[e.row] = []; optionalByRow[e.row].push(T.csvErrMissing(T.csvFieldLabels[e.field] || e.field)); });
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
                                        { svg: <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M2.5 1.5h8.5l3 3v10h-11.5v-13z" stroke="#6B7280" strokeWidth="1.3" strokeLinejoin="round"/><path d="M11 1.5v3h3" stroke="#6B7280" strokeWidth="1.3" strokeLinejoin="round"/><path d="M5 8h6M5 10.5h4" stroke="#6B7280" strokeWidth="1.2" strokeLinecap="round"/></svg>, label: T.feedGuide, sub: lang === 'de' ? 'PDF · 24 Seiten' : 'PDF · 24 pages', onClick: () => setShowLeitfaden(true) },
                                        { svg: <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="1.5" width="13" height="13" rx="1.5" stroke="#6B7280" strokeWidth="1.3"/><path d="M5 5.5h6M5 8h6M5 10.5h4" stroke="#6B7280" strokeWidth="1.2" strokeLinecap="round"/></svg>, label: T.feedTemplate, sub: lang === 'de' ? 'XLSX · Alle Pflichtfelder' : 'XLSX · All required fields', onClick: () => downloadFeedvorlage() },
                                    ].map((r) => (
                                        <button key={r.label} type="button" onClick={r.onClick}
                                            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6, border: '1px solid #E5E7EB', background: '#F9FAFB', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                                            <span style={{ flexShrink: 0 }}>{r.svg}</span>
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

                const score = issues.totalScore;
                const scoreColor = score >= 85 ? '#16A34A' : score >= 60 ? '#D97706' : '#DC2626';
                const scoreBg = score >= 85 ? '#DCFCE7' : score >= 60 ? '#FEF3C7' : '#FEE2E2';

                return (
                    <div style={{ width: '100%', maxWidth: 1100, display: 'flex', flexDirection: 'column', gap: 12 }}>

                        {/* 2-column: table | action panel */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, alignItems: 'start' }}>

                        {/* Field analysis table */}
                        <div style={{ background: '#FFF', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'auto', maxHeight: 'calc(100vh - 200px)' }}>
                            <div style={{ padding: '12px 16px 10px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'sticky', top: 0, background: '#FFF', zIndex: 1, gap: 12 }}>
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{T.analysisTitle}</div>
                                    <div style={{ fontSize: 11, color: '#6B7280', marginTop: 1 }}>{T.analysisSubtitle}</div>
                                </div>
                                <div style={{ fontSize: 10, color: '#6B7280', textAlign: 'right', flexShrink: 0, marginTop: 2 }}>
                                    {T.analysisSummary(totalPflichtFields, vollstaendigFields, totalPflichtFields - vollstaendigFields)}
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 120px', padding: '5px 16px', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.05em' }}>{T.colField}</div>
                                <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.05em', textAlign: 'right' }}>{T.colStatus}</div>
                                <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.05em', paddingLeft: 12 }}>{T.colCoverage}</div>
                            </div>
                            {PFLICHT_TABLE_FIELDS.map(({ key, label }) => {
                                const isMapped = key === 'availability'
                                    ? (alwaysAvailable || !!(mcMapping.availability || mcMapping.stock_amount))
                                    : key === 'image_url' ? mcImageColumns.length > 0
                                    : !!mcMapping[key];
                                const errs = (key === 'availability' && alwaysAvailable) ? 0 : (fieldErrorRows[key]?.size || 0);
                                const pct = isMapped ? Math.max(0, Math.round((1 - errs / issues.totalRows) * 100)) : null;
                                const hasError = pct !== null && errs > 0;
                                const barColor = pct === null ? '#E5E7EB' : pct === 100 ? '#16A34A' : pct >= 70 ? '#D97706' : '#DC2626';
                                const mappedCol = key === 'availability'
                                    ? (mcMapping.availability || mcMapping.stock_amount)
                                    : key === 'image_url' ? mcImageColumns[0]
                                    : mcMapping[key];
                                const errorEans3 = hasError ? getEansFromRowSet(fieldErrorRows[key]) : [];
                                const exampleVals = !hasError && mappedCol
                                    ? [...new Set(rows.slice(0, 30).map(r => String(r[mappedCol] ?? '').trim()).filter(Boolean))].slice(0, 3)
                                    : [];
                                const totalErrCount = fieldErrorRows[key]?.size || 0;
                                return (
                                    <div key={key} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 120px', padding: '5px 16px', borderBottom: '1px solid #F9FAFB', alignItems: 'start', background: hasError ? (barColor === '#DC2626' ? '#FEF2F2' : '#FFFBF5') : 'transparent', borderLeft: hasError ? `3px solid ${barColor}` : '3px solid transparent' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, paddingTop: 2, paddingBottom: hasError && errorEans3.length > 0 ? 4 : 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <div style={{ fontSize: 11, color: hasError ? '#92400E' : '#374151', fontWeight: hasError ? 600 : 500, flexShrink: 0 }}>{label}</div>
                                                {exampleVals.length > 0 && (
                                                    <div style={{ display: 'flex', gap: 4, flexWrap: 'nowrap', overflow: 'hidden', maxWidth: 220 }}>
                                                        {exampleVals.slice(0, 2).map((v, i) => (
                                                            <span key={i} style={{ fontSize: 9, color: '#6B7280', background: '#F3F4F6', borderRadius: 3, padding: '1px 5px', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block', flexShrink: 0 }}>{v}</span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            {hasError && errorEans3.length > 0 && (
                                                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 3 }}>
                                                    <span style={{ fontSize: 9, color: '#9CA3AF', fontWeight: 600 }}>EAN:</span>
                                                    {errorEans3.map((ean) => (
                                                        <span key={ean} style={{ fontSize: 9, color: '#374151', background: '#F3F4F6', borderRadius: 3, padding: '1px 5px', fontFamily: 'monospace', flexShrink: 0 }}>{ean}</span>
                                                    ))}
                                                    {totalErrCount > errorEans3.length && (
                                                        <span style={{ fontSize: 9, color: '#9CA3AF' }}>+{totalErrCount - errorEans3.length} {lang === 'de' ? 'weitere' : 'more'}</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ textAlign: 'right', fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap', paddingTop: 2 }}>
                                            {pct === null ? <span style={{ color: '#9CA3AF' }}>{T.notInFeed}</span>
                                                : errs === 0 ? <span style={{ color: '#16A34A' }}>{T.complete}</span>
                                                : <span style={{ color: barColor }}>{T.missingCount(errs.toLocaleString(numLocale))}</span>}
                                        </div>
                                        <div style={{ paddingLeft: 12, paddingTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
                                            {pct !== null ? (
                                                <>
                                                    <div style={{ flex: 1, height: 4, background: '#F3F4F6', borderRadius: 2, overflow: 'hidden' }}>
                                                        <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 2, transition: 'width 0.4s' }} />
                                                    </div>
                                                    <span style={{ fontSize: 9, color: '#9CA3AF', width: 26, textAlign: 'right', flexShrink: 0 }}>{pct}%</span>
                                                </>
                                            ) : <span style={{ fontSize: 9, color: '#D1D5DB' }}>-</span>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Right action panel */}
                        <div style={{ background: '#FFF', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'sticky', top: 20, alignSelf: 'flex-start' }}>

                            {/* Sidebar heading */}
                            <div style={{ padding: '14px 16px', borderBottom: '1px solid #F3F4F6' }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>
                                    {lang === 'de' ? 'Ergebnis' : 'Result'}
                                </div>
                                <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 1 }}>
                                    {lang === 'de' ? 'Pflichtfeld-Score & Status' : 'Required field score & status'}
                                </div>
                            </div>

                            {/* Score donut - Pflichtfelder only */}
                            {(() => {
                                const s = issues.pflichtScore;
                                const c3 = s >= 90 ? '#16A34A' : s >= 60 ? '#D97706' : '#DC2626';
                                const r3 = 16, circ3 = 2 * Math.PI * r3;
                                return (
                                    <div style={{ padding: '12px 16px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <svg width="40" height="40" viewBox="0 0 40 40" style={{ flexShrink: 0 }}>
                                            <circle cx="20" cy="20" r={r3} fill="none" stroke="#F3F4F6" strokeWidth="4"/>
                                            <circle cx="20" cy="20" r={r3} fill="none" stroke={c3} strokeWidth="4"
                                                strokeDasharray={`${(s / 100) * circ3} ${circ3}`}
                                                strokeLinecap="round"
                                                transform="rotate(-90 20 20)"
                                            />
                                            <text x="20" y="24" textAnchor="middle" fontSize="11" fontWeight="900" fill={c3}>{s}</text>
                                        </svg>
                                        <div>
                                            <div style={{ fontSize: 11, fontWeight: 700, color: '#111827' }}>{lang === 'de' ? 'Pflichtfelder' : 'Required Fields'}</div>
                                            <div style={{ fontSize: 9, color: '#9CA3AF' }}>{lang === 'de' ? 'von 100 Punkten' : 'out of 100 pts'}</div>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Stats strip */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: '1px solid #F3F4F6' }}>
                                {[
                                    { val: issues.livefaehigCount, label: T.statComplete, color: '#16A34A', tip: T.tipComplete },
                                    { val: issues.blockiertCount, label: T.statErrors, color: '#DC2626', tip: T.tipErrors },
                                    { val: issues.totalRows, label: T.statTotal, color: '#111827', tip: T.tipTotal },
                                ].map(({ val, label, color, tip }, i) => (
                                    <Tooltip key={label} text={tip}>
                                        <div style={{ padding: '10px 10px', borderRight: i < 2 ? '1px solid #F3F4F6' : 'none', cursor: 'help', textAlign: 'center' }}>
                                            <div style={{ fontSize: 18, fontWeight: 900, color, lineHeight: 1, marginBottom: 2 }}>{val.toLocaleString(numLocale)}</div>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                                                <span style={{ fontSize: 10, color: '#6B7280' }}>{label}</span>
                                                <svg width="10" height="10" viewBox="0 0 16 16" fill="none" style={{ color: '#9CA3AF', flexShrink: 0 }}><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3"/><path d="M8 7v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><circle cx="8" cy="5" r="0.75" fill="currentColor"/></svg>
                                            </div>
                                        </div>
                                    </Tooltip>
                                ))}
                            </div>

                            {/* Status state */}
                            {detailedErrors.length === 0 ? (
                                <div style={{ padding: '16px', borderBottom: '1px solid #F3F4F6', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center' }}>
                                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8l4 4 6-6" stroke="#16A34A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                    </div>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: '#166534' }}>{lang === 'de' ? 'Feed ist listingfähig' : 'Feed is ready to list'}</div>
                                    <div style={{ fontSize: 10, color: '#4B7A5A', lineHeight: 1.5 }}>{lang === 'de' ? 'Alle Pflichtfelder sind vollständig und fehlerfrei.' : 'All required fields are complete and error-free.'}</div>
                                </div>
                            ) : (
                                <div style={{ padding: '12px 16px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: stufe1Passed ? '#FEF3C7' : '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M8 2L1 14h14L8 2z" stroke={stufe1Passed ? '#92400E' : '#DC2626'} strokeWidth="1.5" strokeLinejoin="round"/><path d="M8 7v3" stroke={stufe1Passed ? '#92400E' : '#DC2626'} strokeWidth="1.5" strokeLinecap="round"/><circle cx="8" cy="12" r=".6" fill={stufe1Passed ? '#92400E' : '#DC2626'}/></svg>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: stufe1Passed ? '#92400E' : '#991B1B' }}>
                                            {stufe1Passed
                                                ? (lang === 'de' ? 'Listingfähig mit Hinweisen' : 'Listable with minor issues')
                                                : (lang === 'de' ? 'Fehler gefunden' : 'Errors found')}
                                        </div>
                                        <div style={{ fontSize: 10, color: '#6B7280', marginTop: 1 }}>
                                            {lang === 'de' ? `${issues.blockiertCount} Artikel betroffen` : `${issues.blockiertCount} items affected`}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Top errors list */}
                            {detailedErrors.length > 0 && (
                                <div style={{ borderBottom: '1px solid #F3F4F6' }}>
                                    <div style={{ padding: '8px 16px 6px', fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                        {lang === 'de' ? 'Häufigste Fehler' : 'Top Errors'}
                                    </div>
                                    <div style={{ padding: '0 16px 10px', display: 'grid', gap: 4, maxHeight: 220, overflowY: 'auto' }}>
                                        {detailedErrors.map((err, i) => (
                                            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 8px', borderRadius: 6, background: '#FEF2F2', border: '1px solid #FEE2E2' }}>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontSize: 10, fontWeight: 600, color: '#991B1B', lineHeight: 1.35 }}>{err.label}</div>
                                                    {err.sampleEans.length > 0 && (
                                                        <div style={{ marginTop: 3, display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                                                            {err.sampleEans.slice(0, 3).map((ean) => (
                                                                <span key={ean} style={{ fontSize: 8, color: '#374151', background: '#F3F4F6', borderRadius: 2, padding: '1px 4px', fontFamily: 'monospace' }}>{ean}</span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                <span style={{ fontSize: 11, fontWeight: 800, color: '#DC2626', flexShrink: 0 }}>{err.count.toLocaleString(numLocale)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Nav buttons */}
                            <div style={{ padding: '10px 16px', borderTop: '1px solid #F3F4F6', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <button type="button" onClick={csvOnClick}
                                    style={{ width: '100%', padding: '7px 12px', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8, color: '#374151', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M8 3v7M5 7l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                                    {T.csvBtn}
                                </button>
                                <div style={{ display: 'flex', gap: 6 }}>
                                    <button type="button" onClick={() => setStep(2)}
                                        style={{ flex: 1, padding: '10px 16px', background: '#fff', border: '1px solid #D0D5E0', borderRadius: 8, color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                                        {T.back}
                                    </button>
                                    <button type="button" onClick={() => setStep(4)}
                                        style={{ flex: 2, padding: '10px 16px', background: MC_BLUE, border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                                        {T.recNextStep}
                                    </button>
                                </div>
                            </div>

                        </div>{/* end right panel */}

                        </div>{/* end grid */}

                        {/* Insight cards row — description quality + title structure */}
                        {(descStats || titleAnalysis) && (
                            <div style={{ display: 'grid', gridTemplateColumns: descStats && titleAnalysis ? '1fr 1fr' : '1fr', gap: 12 }}>

                                {/* Description quality */}
                                {descStats && (() => {
                                    const { total, avg, buckets } = descStats;
                                    const items = [
                                        { label: lang === 'de' ? 'Zu kurz (<50)' : 'Too short (<50)', count: buckets.short, color: '#DC2626', bg: '#FEE2E2' },
                                        { label: lang === 'de' ? 'OK (50–149)' : 'OK (50–149)', count: buckets.ok, color: '#D97706', bg: '#FEF3C7' },
                                        { label: lang === 'de' ? 'Gut (150–499)' : 'Good (150–499)', count: buckets.good, color: '#2563EB', bg: '#DBEAFE' },
                                        { label: lang === 'de' ? 'Sehr gut (500+)' : 'Great (500+)', count: buckets.great, color: '#16A34A', bg: '#DCFCE7' },
                                    ];
                                    return (
                                        <div style={{ background: '#FFF', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
                                            <div style={{ padding: '10px 14px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                                <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>{lang === 'de' ? 'Beschreibungslänge' : 'Description Length'}</span>
                                                <span style={{ fontSize: 10, color: '#9CA3AF' }}>{lang === 'de' ? `Ø ${avg} Zeichen` : `avg ${avg} chars`}</span>
                                            </div>
                                            <div style={{ padding: '10px 14px', display: 'grid', gap: 6 }}>
                                                {items.map(({ label, count, color, bg }) => {
                                                    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                                                    return (
                                                        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                            <span style={{ fontSize: 10, color: '#374151', width: 110, flexShrink: 0 }}>{label}</span>
                                                            <div style={{ flex: 1, height: 6, background: '#F3F4F6', borderRadius: 3, overflow: 'hidden' }}>
                                                                <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.4s' }} />
                                                            </div>
                                                            <span style={{ fontSize: 10, fontWeight: 700, color, width: 30, textAlign: 'right', flexShrink: 0 }}>{pct}%</span>
                                                            <span style={{ fontSize: 9, color: '#9CA3AF', width: 28, textAlign: 'right', flexShrink: 0 }}>{count.toLocaleString(numLocale)}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Title structure */}
                                {titleAnalysis && (() => {
                                    const { total, missingColor, missingMaterial, missingDimension, missingBrand } = titleAnalysis;
                                    const items = [
                                        { label: lang === 'de' ? 'Farbe fehlt' : 'No color', count: missingColor },
                                        { label: lang === 'de' ? 'Material fehlt' : 'No material', count: missingMaterial },
                                        { label: lang === 'de' ? 'Maße fehlen' : 'No dimensions', count: missingDimension },
                                        ...(missingBrand !== null ? [{ label: lang === 'de' ? 'Marke fehlt im Titel' : 'Brand missing', count: missingBrand }] : []),
                                    ];
                                    return (
                                        <div style={{ background: '#FFF', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
                                            <div style={{ padding: '10px 14px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                                <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>{lang === 'de' ? 'Titelstruktur' : 'Title Structure'}</span>
                                                <span style={{ fontSize: 10, color: '#9CA3AF' }}>{total.toLocaleString(numLocale)} {lang === 'de' ? 'Artikel' : 'items'}</span>
                                            </div>
                                            <div style={{ padding: '10px 14px', display: 'grid', gap: 6 }}>
                                                {items.map(({ label, count }) => {
                                                    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                                                    const color = pct > 60 ? '#DC2626' : pct > 30 ? '#D97706' : '#16A34A';
                                                    return (
                                                        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                            <span style={{ fontSize: 10, color: '#374151', width: 110, flexShrink: 0 }}>{label}</span>
                                                            <div style={{ flex: 1, height: 6, background: '#F3F4F6', borderRadius: 3, overflow: 'hidden' }}>
                                                                <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.4s' }} />
                                                            </div>
                                                            <span style={{ fontSize: 10, fontWeight: 700, color, width: 30, textAlign: 'right', flexShrink: 0 }}>{pct}%</span>
                                                            <span style={{ fontSize: 9, color: '#9CA3AF', width: 28, textAlign: 'right', flexShrink: 0 }}>{count.toLocaleString(numLocale)}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })()}

                            </div>
                        )}

                    </div>
                );
            })()}

            {/* ══════════════════════════════════════════
                STEP 4 - Optionale Felder
            ══════════════════════════════════════════ */}
            {step === 4 && issues && (() => {
                const { optFieldStats } = issues;
                const numLocale = lang === 'de' ? 'de-DE' : 'en-US';
                const overallPct = issues.optionalScore;
                const overallColor = overallPct >= 70 ? '#16A34A' : overallPct >= 40 ? '#D97706' : '#DC2626';

                // Image count distribution (moved from step 3)
                const imgStats = mcImageColumns.length > 0 ? (() => {
                    const buckets = { none: 0, one: 0, two: 0, good: 0 };
                    let total = 0, totalImgs = 0;
                    rows.forEach((r) => {
                        total++;
                        const cnt = mcImageColumns.reduce((s, col) => s + (String(r[col] ?? '').trim() ? 1 : 0), 0);
                        totalImgs += cnt;
                        if (cnt === 0) buckets.none++;
                        else if (cnt === 1) buckets.one++;
                        else if (cnt === 2) buckets.two++;
                        else buckets.good++;
                    });
                    return { total, avg: total ? +(totalImgs / total).toFixed(1) : 0, buckets };
                })() : null;

                // Description length distribution
                const descCol = mcMapping['description'];
                const descStats = descCol ? (() => {
                    const buckets = { none: 0, short: 0, ok: 0, good: 0 };
                    let total = 0;
                    rows.forEach((r) => {
                        total++;
                        const len = String(r[descCol] ?? '').trim().length;
                        if (len === 0) buckets.none++;
                        else if (len < 100) buckets.short++;
                        else if (len < 300) buckets.ok++;
                        else buckets.good++;
                    });
                    return { total, buckets };
                })() : null;

                const totalOptionalFields = optFieldStats.fields.length;
                const completeOptionalFields = optFieldStats.fields.filter(f => !f.notMapped && f.pct === 100).length;
                const errorOptionalFields = optFieldStats.fields.filter(f => !f.notMapped && f.pct < 100).length;

                // Build EAN lookup per optional field from optionalHints
                const optHintsByField = {};
                issues.optionalHints.forEach(({ field, ean }) => {
                    if (!optHintsByField[field]) optHintsByField[field] = [];
                    if (ean && optHintsByField[field].length < 5 && !optHintsByField[field].includes(ean)) {
                        optHintsByField[field].push(ean);
                    }
                });

                return (
                    <div style={{ width: '100%', maxWidth: 1100, display: 'flex', flexDirection: 'column', gap: 12 }}>

                        {/* Two-column layout */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, alignItems: 'start' }}>

                            {/* Left: optional fields table */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                                {/* Field analysis table - matches step 3 layout */}
                                <div style={{ background: '#FFF', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
                                    <div style={{ padding: '12px 16px 10px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: '#FFF', gap: 12 }}>
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{T.optFieldsTitle}</div>
                                            <div style={{ fontSize: 11, color: '#6B7280', marginTop: 1 }}>{T.optFieldsSubtitle}</div>
                                        </div>
                                        <div style={{ fontSize: 10, color: '#6B7280', textAlign: 'right', flexShrink: 0, marginTop: 2 }}>
                                            {T.analysisSummary(totalOptionalFields, completeOptionalFields, errorOptionalFields)}
                                        </div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 120px', padding: '5px 16px', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.05em' }}>{T.colField}</div>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.05em', textAlign: 'right' }}>{T.colStatus}</div>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.05em', paddingLeft: 12 }}>{T.colCoverage}</div>
                                    </div>
                                    {optFieldStats.fields.map((f) => {
                                        const label = lang === 'de' ? f.labelDE : f.labelEN;
                                        const isMapped = !f.notMapped;
                                        const pct = isMapped ? f.pct : null;
                                        const errs = isMapped ? Math.max(0, f.total - f.covered) : 0;
                                        const hasError = pct !== null && errs > 0;
                                        const barColor = pct === null ? '#E5E7EB' : pct === 100 ? '#16A34A' : pct >= 70 ? '#D97706' : '#DC2626';
                                        const mappedCol = mcMapping[f.field];
                                        const exampleVals = !hasError && mappedCol
                                            ? [...new Set(rows.slice(0, 30).map(r => String(r[mappedCol] ?? '').trim()).filter(Boolean))].slice(0, 3)
                                            : [];
                                        const errorEans4 = hasError ? (optHintsByField[f.field] || []) : [];
                                        return (
                                            <div key={f.field} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 120px', padding: '5px 16px', borderBottom: '1px solid #F9FAFB', alignItems: 'start', background: hasError ? (barColor === '#DC2626' ? '#FEF2F2' : '#FFFBF5') : 'transparent', borderLeft: hasError ? `3px solid ${barColor}` : '3px solid transparent' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, paddingTop: 2, paddingBottom: hasError && errorEans4.length > 0 ? 4 : 0 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        <div style={{ fontSize: 11, color: hasError ? '#92400E' : '#374151', fontWeight: hasError ? 600 : 500, flexShrink: 0 }}>{label}</div>
                                                        {exampleVals.length > 0 && (
                                                            <div style={{ display: 'flex', gap: 4, flexWrap: 'nowrap', overflow: 'hidden', maxWidth: 220 }}>
                                                                {exampleVals.slice(0, 2).map((v, i) => (
                                                                    <span key={i} style={{ fontSize: 9, color: '#6B7280', background: '#F3F4F6', borderRadius: 3, padding: '1px 5px', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block', flexShrink: 0 }}>{v}</span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                    {hasError && errorEans4.length > 0 && (
                                                        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 3 }}>
                                                            <span style={{ fontSize: 9, color: '#9CA3AF', fontWeight: 600 }}>EAN:</span>
                                                            {errorEans4.map((ean) => (
                                                                <span key={ean} style={{ fontSize: 9, color: '#374151', background: '#F3F4F6', borderRadius: 3, padding: '1px 5px', fontFamily: 'monospace', flexShrink: 0 }}>{ean}</span>
                                                            ))}
                                                            {errs > errorEans4.length && (
                                                                <span style={{ fontSize: 9, color: '#9CA3AF' }}>+{errs - errorEans4.length} {lang === 'de' ? 'weitere' : 'more'}</span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                                <div style={{ textAlign: 'right', fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap', paddingTop: 2 }}>
                                                    {pct === null ? <span style={{ color: '#9CA3AF' }}>{T.notInFeed}</span>
                                                        : errs === 0 ? <span style={{ color: '#16A34A' }}>{T.complete}</span>
                                                        : <span style={{ color: barColor }}>{T.missingCount(errs.toLocaleString(numLocale))}</span>}
                                                </div>
                                                <div style={{ paddingLeft: 12, paddingTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
                                                    {pct !== null ? (
                                                        <>
                                                            <div style={{ flex: 1, height: 4, background: '#F3F4F6', borderRadius: 2, overflow: 'hidden' }}>
                                                                <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 2, transition: 'width 0.4s' }} />
                                                            </div>
                                                            <span style={{ fontSize: 9, color: '#9CA3AF', width: 26, textAlign: 'right', flexShrink: 0 }}>{pct}%</span>
                                                        </>
                                                    ) : <span style={{ fontSize: 9, color: '#D1D5DB' }}>-</span>}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                {optFieldStats.sizeMissingCount > 0 && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 4px' }}>
                                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, color: '#9CA3AF' }}><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4"/><path d="M8 7v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><circle cx="8" cy="5.5" r=".6" fill="currentColor"/></svg>
                                        <span style={{ fontSize: 10, color: '#9CA3AF' }}>{T.sizeHintDesc(optFieldStats.sizeMissingCount.toLocaleString(numLocale))}</span>
                                    </div>
                                )}

                                {/* Image count + description length charts side by side */}
                                {(imgStats?.total > 0 || descStats?.total > 0) && (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                        {/* Image count distribution */}
                                        {imgStats && imgStats.total > 0 && (
                                            <div style={{ background: '#FFF', borderRadius: 12, border: '1px solid #E5E7EB', padding: '14px 16px' }}>
                                                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
                                                    <div style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>
                                                        {lang === 'de' ? 'Bildanzahl: Verteilung' : 'Image Count: Distribution'}
                                                    </div>
                                                    <div style={{ display: 'flex', gap: 8 }}>
                                                        <div style={{ fontSize: 10, color: '#16A34A', fontWeight: 600 }}>{lang === 'de' ? 'Ziel: 3+' : 'Target: 3+'}</div>
                                                        <div style={{ fontSize: 10, color: '#9CA3AF' }}>
                                                            {lang === 'de' ? `Ø ${imgStats.avg.toLocaleString(numLocale)}` : `Avg. ${imgStats.avg.toLocaleString(numLocale)}`}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                                                    {[
                                                        { key: 'none', label: lang === 'de' ? '0 Bilder' : '0 images', color: '#EF4444' },
                                                        { key: 'one',  label: lang === 'de' ? '1 Bild' : '1 image',   color: '#F59E0B' },
                                                        { key: 'two',  label: lang === 'de' ? '2 Bilder' : '2 images', color: '#D97706' },
                                                        { key: 'good', label: lang === 'de' ? '3+ Bilder' : '3+ images', color: '#16A34A' },
                                                    ].map(({ key, label, color }) => {
                                                        const cnt = imgStats.buckets[key];
                                                        const pct = imgStats.total ? Math.round((cnt / imgStats.total) * 100) : 0;
                                                        return (
                                                            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                                                <div style={{ width: 56, fontSize: 10, color: '#374151', fontWeight: 500, textAlign: 'right', flexShrink: 0 }}>{label}</div>
                                                                <div style={{ flex: 1, height: 10, background: '#F3F4F6', borderRadius: 5, overflow: 'hidden' }}>
                                                                    <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 5, transition: 'width 0.4s' }} />
                                                                </div>
                                                                <div style={{ width: 30, fontSize: 10, fontWeight: 700, color, textAlign: 'left', flexShrink: 0 }}>{pct}%</div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                {imgStats.avg < 3 && (
                                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 5, background: '#FFFBEB', borderRadius: 6, padding: '6px 8px' }}>
                                                        <svg width="11" height="11" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="8" cy="8" r="6.5" stroke="#D97706" strokeWidth="1.4"/><path d="M8 7v4" stroke="#D97706" strokeWidth="1.4" strokeLinecap="round"/><circle cx="8" cy="5.5" r=".6" fill="#D97706"/></svg>
                                                        <span style={{ fontSize: 10, color: '#92400E', lineHeight: 1.4 }}>
                                                            {lang === 'de' ? 'Mehr Bilder erhöhen Klickrate und Conversion.' : 'More images improve CTR and conversion.'}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        {/* Description length distribution */}
                                        {descStats && descStats.total > 0 && (
                                            <div style={{ background: '#FFF', borderRadius: 12, border: '1px solid #E5E7EB', padding: '14px 16px' }}>
                                                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
                                                    <div style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>
                                                        {lang === 'de' ? 'Beschreibungslänge: Verteilung' : 'Description Length: Distribution'}
                                                    </div>
                                                    <div style={{ fontSize: 10, color: '#16A34A', fontWeight: 600 }}>
                                                        {lang === 'de' ? 'Ziel: 300+ Zeichen' : 'Target: 300+ chars'}
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                                                    {[
                                                        { key: 'none',  label: lang === 'de' ? 'Leer (0)' : 'Empty (0)',       color: '#EF4444' },
                                                        { key: 'short', label: lang === 'de' ? 'Kurz (<100)' : 'Short (<100)', color: '#F59E0B' },
                                                        { key: 'ok',    label: lang === 'de' ? 'OK (100–299)' : 'OK (100–299)', color: '#60A5FA' },
                                                        { key: 'good',  label: lang === 'de' ? 'Gut (300+)' : 'Good (300+)',   color: '#16A34A' },
                                                    ].map(({ key, label, color }) => {
                                                        const cnt = descStats.buckets[key];
                                                        const pct = descStats.total ? Math.round((cnt / descStats.total) * 100) : 0;
                                                        return (
                                                            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                                                <div style={{ width: 68, fontSize: 10, color: '#374151', fontWeight: 500, textAlign: 'right', flexShrink: 0 }}>{label}</div>
                                                                <div style={{ flex: 1, height: 10, background: '#F3F4F6', borderRadius: 5, overflow: 'hidden' }}>
                                                                    <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 5, transition: 'width 0.4s' }} />
                                                                </div>
                                                                <div style={{ width: 30, fontSize: 10, fontWeight: 700, color, textAlign: 'left', flexShrink: 0 }}>{pct}%</div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                {(descStats.buckets.none + descStats.buckets.short) / descStats.total > 0.2 && (
                                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 5, background: '#FFFBEB', borderRadius: 6, padding: '6px 8px' }}>
                                                        <svg width="11" height="11" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="8" cy="8" r="6.5" stroke="#D97706" strokeWidth="1.4"/><path d="M8 7v4" stroke="#D97706" strokeWidth="1.4" strokeLinecap="round"/><circle cx="8" cy="5.5" r=".6" fill="#D97706"/></svg>
                                                        <span style={{ fontSize: 10, color: '#92400E', lineHeight: 1.4 }}>
                                                            {lang === 'de' ? 'Kurze Beschreibungen senken die Conversion. Ziel: 300+ Zeichen.' : 'Short descriptions hurt conversion. Target: 300+ characters.'}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Lighting hint */}
                                {optFieldStats.lightingCount > 0 && (
                                    <div style={{ background: '#EEF4FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 2 }}><path d="M6 1h4l-1 5h3l-5 9 1-6H5l1-8z" stroke={MC_BLUE} strokeWidth="1.3" strokeLinejoin="round"/></svg>
                                        <div>
                                            <div style={{ fontSize: 11, fontWeight: 700, color: '#1e3a8a', marginBottom: 2 }}>{T.lightingHintTitle}</div>
                                            <div style={{ fontSize: 10, color: '#1e40af', lineHeight: 1.45 }}>{T.lightingHintDesc(optFieldStats.lightingCount, optFieldStats.lightingEnergyMissing, optFieldStats.lightingEprelMissing)}</div>
                                        </div>
                                    </div>
                                )}

                                {/* Qualitätstipps - unified card with Title and Description side-by-side */}
                                <div style={{ background: '#FFF', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
                                    <div style={{ padding: '12px 18px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'baseline', gap: 8 }}>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>
                                            {lang === 'de' ? 'Qualitätstipps für Titel & Beschreibung' : 'Quality Tips for Title & Description'}
                                        </div>
                                        <div style={{ fontSize: 11, color: '#9CA3AF' }}>
                                            {lang === 'de' ? 'Beispiele aus der Möbelbranche' : 'Furniture industry examples'}
                                        </div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                                        {[
                                            {
                                                icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 4h10M3 8h10M3 12h6" stroke={MC_BLUE} strokeWidth="1.5" strokeLinecap="round"/></svg>,
                                                title: lang === 'de' ? 'Titel' : 'Title',
                                                bad: '"Sofa schwarz"',
                                                good: lang === 'de' ? '"Dreammöbel Ecksofa 3-Sitzer, Kunstleder schwarz, 180 × 90 cm"' : '"Dreammöbel Corner Sofa 3-seater, faux leather black, 180 × 90 cm"',
                                                dos: lang === 'de'
                                                    ? ['Marke voranstellen', 'Produktart + Farbe + Maße', 'Mind. 2 Wörter']
                                                    : ['Brand first', 'Product type + Color + Dimensions', 'Min. 2 words'],
                                                donts: lang === 'de'
                                                    ? ['"B-Ware" / "gebraucht"', 'Nur ein Wort', 'Werbephrasen']
                                                    : ['"used" / "B-stock"', 'Single word only', 'Advertising phrases'],
                                            },
                                            {
                                                icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="1.5" stroke={MC_BLUE} strokeWidth="1.4"/><path d="M5 6h6M5 9h6M5 12h4" stroke={MC_BLUE} strokeWidth="1.3" strokeLinecap="round"/></svg>,
                                                title: lang === 'de' ? 'Beschreibung' : 'Description',
                                                bad: '"Schönes Sofa."',
                                                good: lang === 'de' ? '"Elegantes Ecksofa aus Kunstleder in Schwarz. Maße: 200 × 80 × 120 cm."' : '"Elegant corner sofa made of faux leather in black. Dimensions: 200 × 80 × 120 cm."',
                                                dos: lang === 'de'
                                                    ? ['100-500 Zeichen', 'Material, Farbe, Maße', 'Konkrete Produktdetails']
                                                    : ['100-500 characters', 'Material, color, dimensions', 'Concrete product details'],
                                                donts: lang === 'de'
                                                    ? ['"günstig", "Top-Qualität"', 'Externe Links', 'Identisch zum Titel']
                                                    : ['"cheap", "top quality"', 'External links', 'Identical to title'],
                                            },
                                        ].map((c, i) => (
                                            <div key={c.title} style={{ padding: '14px 18px', borderRight: i === 0 ? '1px solid #F3F4F6' : 'none' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                                                    <div style={{ width: 26, height: 26, borderRadius: 6, background: '#EEF4FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{c.icon}</div>
                                                    <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{c.title}</div>
                                                </div>
                                                {/* Examples */}
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px', background: '#FEF2F2', borderRadius: 6, borderLeft: '3px solid #DC2626' }}>
                                                        <span style={{ color: '#DC2626', fontSize: 12, fontWeight: 800, lineHeight: 1.2, flexShrink: 0 }}>✗</span>
                                                        <span style={{ fontSize: 11, color: '#7F1D1D', lineHeight: 1.4, fontStyle: 'italic' }}>{c.bad}</span>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px', background: '#F0FDF4', borderRadius: 6, borderLeft: '3px solid #16A34A' }}>
                                                        <span style={{ color: '#16A34A', fontSize: 12, fontWeight: 800, lineHeight: 1.2, flexShrink: 0 }}>✓</span>
                                                        <span style={{ fontSize: 11, color: '#166534', lineHeight: 1.4, fontStyle: 'italic' }}>{c.good}</span>
                                                    </div>
                                                </div>
                                                {/* DOs and DON'Ts side by side */}
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                                    <div>
                                                        <div style={{ fontSize: 9, fontWeight: 800, color: '#16A34A', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                                            {lang === 'de' ? 'So geht es' : 'Do'}
                                                        </div>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                                            {c.dos.map((d, j) => (
                                                                <div key={j} style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                                                                    <span style={{ color: '#16A34A', fontSize: 10, fontWeight: 800, flexShrink: 0 }}>+</span>
                                                                    <span style={{ fontSize: 10, color: '#374151', lineHeight: 1.4 }}>{d}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: 9, fontWeight: 800, color: '#DC2626', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                                            {lang === 'de' ? 'Vermeiden' : 'Avoid'}
                                                        </div>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                                            {c.donts.map((d, j) => (
                                                                <div key={j} style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                                                                    <span style={{ color: '#DC2626', fontSize: 10, fontWeight: 800, flexShrink: 0 }}>−</span>
                                                                    <span style={{ fontSize: 10, color: '#374151', lineHeight: 1.4 }}>{d}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Right: score + nav (matches step 3 layout) */}
                            <div style={{ background: '#FFF', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'sticky', top: 20, alignSelf: 'flex-start' }}>

                                {/* Sidebar heading */}
                                <div style={{ padding: '14px 16px', borderBottom: '1px solid #F3F4F6' }}>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>
                                        {lang === 'de' ? 'Ergebnis' : 'Result'}
                                    </div>
                                    <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 1 }}>
                                        {lang === 'de' ? 'Score & Vollständigkeit' : 'Score & completeness'}
                                    </div>
                                </div>

                                {/* Score donut */}
                                <div style={{ padding: '12px 16px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <svg width="40" height="40" viewBox="0 0 40 40" style={{ flexShrink: 0 }}>
                                        <circle cx="20" cy="20" r={16} fill="none" stroke="#F3F4F6" strokeWidth="4"/>
                                        <circle cx="20" cy="20" r={16} fill="none" stroke={overallColor} strokeWidth="4"
                                            strokeDasharray={`${(overallPct / 100) * (2 * Math.PI * 16)} ${2 * Math.PI * 16}`}
                                            strokeLinecap="round"
                                            transform="rotate(-90 20 20)"
                                        />
                                        <text x="20" y="24" textAnchor="middle" fontSize="11" fontWeight="900" fill={overallColor}>{overallPct}</text>
                                    </svg>
                                    <div>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: '#111827' }}>{lang === 'de' ? 'Optionale Felder' : 'Optional Fields'}</div>
                                        <div style={{ fontSize: 9, color: '#9CA3AF' }}>{lang === 'de' ? 'von 100 Punkten' : 'out of 100 pts'}</div>
                                    </div>
                                </div>

                                {/* Stats strip */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: '1px solid #F3F4F6' }}>
                                    {[
                                        { val: completeOptionalFields, label: lang === 'de' ? 'Vollständig' : 'Complete', color: '#16A34A' },
                                        { val: errorOptionalFields, label: lang === 'de' ? 'Lücken' : 'Gaps', color: '#D97706' },
                                        { val: totalOptionalFields, label: lang === 'de' ? 'Gesamt' : 'Total', color: '#111827' },
                                    ].map(({ val, label, color }, i) => (
                                        <div key={label} style={{ padding: '10px 10px', borderRight: i < 2 ? '1px solid #F3F4F6' : 'none', textAlign: 'center' }}>
                                            <div style={{ fontSize: 18, fontWeight: 900, color, lineHeight: 1, marginBottom: 2 }}>{val.toLocaleString(numLocale)}</div>
                                            <div style={{ fontSize: 10, color: '#6B7280' }}>{label}</div>
                                        </div>
                                    ))}
                                </div>

                                {/* Nav buttons */}
                                <div style={{ padding: '10px 16px', borderTop: '1px solid #F3F4F6', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <button type="button" onClick={() => setStep(3)}
                                            style={{ flex: 1, padding: '10px 16px', background: '#FFF', color: '#374151', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                                            {T.back}
                                        </button>
                                        <button type="button" onClick={() => setStep(5)}
                                            style={{ flex: 2, padding: '10px 16px', background: MC_BLUE, border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                                            {T.recNextStepFinal}
                                        </button>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                );
            })()}

            {/* ══════════════════════════════════════════
                STEP 5 - Empfehlungen & Download
            ══════════════════════════════════════════ */}
            {step === 5 && issues && (() => {
                // Build grouped recommendations from errors
                const errorsByType = {};
                issues.pflichtErrors.forEach((e) => {
                    const key = `${e.field}::${e.type}`;
                    if (!errorsByType[key]) errorsByType[key] = { field: e.field, type: e.type, count: 0, sampleEans: [] };
                    errorsByType[key].count++;
                    if (e.ean && errorsByType[key].sampleEans.length < 5 && !errorsByType[key].sampleEans.includes(e.ean)) {
                        errorsByType[key].sampleEans.push(e.ean);
                    }
                });
                if (issues.eanDupRows.size > 0) errorsByType['ean::dup'] = { field: 'ean', type: 'dup', count: issues.eanDupRows.size };
                if (issues.nameDupRows.size > 0) errorsByType['name::dup'] = { field: 'name', type: 'dup', count: issues.nameDupRows.size };
                if (issues.offerIdDupRows && issues.offerIdDupRows.size > 0) errorsByType['seller_offer_id::dup'] = { field: 'seller_offer_id', type: 'dup', count: issues.offerIdDupRows.size };

                const fieldIcon = (field) => {
                    const color = '#6B7280';
                    const s = { flexShrink: 0 };
                    if (field === 'name') return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={s}><path d="M3 12V4l5-2 5 2v8l-5 2-5-2z" stroke={color} strokeWidth="1.3" strokeLinejoin="round"/><path d="M8 2v12" stroke={color} strokeWidth="1.3"/></svg>;
                    if (field === 'ean') return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={s}><rect x="2" y="3" width="1.5" height="10" fill={color}/><rect x="5" y="3" width="1" height="10" fill={color}/><rect x="7.5" y="3" width="2" height="10" fill={color}/><rect x="11" y="3" width="1" height="10" fill={color}/><rect x="13" y="3" width="1" height="10" fill={color}/></svg>;
                    if (field === 'description') return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={s}><rect x="2" y="1.5" width="12" height="13" rx="1.5" stroke={color} strokeWidth="1.3"/><path d="M5 5.5h6M5 8h6M5 10.5h4" stroke={color} strokeWidth="1.3" strokeLinecap="round"/></svg>;
                    if (field === 'price') return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={s}><circle cx="8" cy="8" r="6" stroke={color} strokeWidth="1.3"/><path d="M8 4.5v7M6 6.5c0-.8.9-1.5 2-1.5s2 .7 2 1.5-1 1.3-2 1.5-2 .7-2 1.5.9 1.5 2 1.5 2-.7 2-1.5" stroke={color} strokeWidth="1.2" strokeLinecap="round"/></svg>;
                    if (field === 'shipping_mode') return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={s}><path d="M1 9h9V3H1v6zM10 5h2.5l2 3v1H10V5z" stroke={color} strokeWidth="1.3" strokeLinejoin="round"/><circle cx="3.5" cy="11.5" r="1.5" stroke={color} strokeWidth="1.3"/><circle cx="12" cy="11.5" r="1.5" stroke={color} strokeWidth="1.3"/></svg>;
                    if (field === 'image_url') return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={s}><rect x="1.5" y="2" width="13" height="12" rx="1.5" stroke={color} strokeWidth="1.3"/><circle cx="5.5" cy="6" r="1.5" stroke={color} strokeWidth="1.2"/><path d="M1.5 11l3.5-3 3 3 2-2 3.5 3" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>;
                    if (field === 'availability' || field === 'stock_amount') return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={s}><path d="M8 1L1.5 4.5v3L8 11l6.5-3.5v-3L8 1z" stroke={color} strokeWidth="1.3" strokeLinejoin="round"/><path d="M1.5 7.5L8 11l6.5-3.5" stroke={color} strokeWidth="1.3"/><path d="M8 11v4" stroke={color} strokeWidth="1.3"/></svg>;
                    if (field === 'brand') return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={s}><path d="M8 2l1.5 3.5L13 6l-2.5 2.5.5 3.5L8 10.5 5 12l.5-3.5L3 6l3.5-.5L8 2z" stroke={color} strokeWidth="1.3" strokeLinejoin="round"/></svg>;
                    if (field === 'delivery_time') return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={s}><circle cx="8" cy="8" r="6" stroke={color} strokeWidth="1.3"/><path d="M8 5v3.5L10.5 10" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>;
                    if (field === 'seller_offer_id') return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={s}><rect x="1.5" y="3" width="13" height="10" rx="1.5" stroke={color} strokeWidth="1.3"/><path d="M5 8h6M5 10.5h3" stroke={color} strokeWidth="1.2" strokeLinecap="round"/><circle cx="4" cy="6" r="1" fill={color}/></svg>;
                    return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={s}><circle cx="8" cy="8" r="6" stroke={color} strokeWidth="1.3"/><path d="M5 8a3 3 0 006 0" stroke={color} strokeWidth="1.2"/><path d="M2 8h12" stroke={color} strokeWidth="1.2"/></svg>;
                };
                const recRules = lang === 'de' ? {
                    'name::missing':       { title: 'Artikelname fehlt',               action: 'Tragen Sie für jeden betroffenen Artikel einen vollständigen Namen ein. Format: Marke + Produkttyp + Hauptattribut, z. B. „BRAND Sofa 3-Sitzer grau 180 cm".',         tip: 'Mind. 2 Wörter und 10 Zeichen. Ein guter Name erhöht die Auffindbarkeit deutlich.' },
                    'name::too_short':     { title: 'Artikelname zu kurz',              action: 'Verlängern Sie den Artikelnamen auf mindestens 10 Zeichen.',                     tip: 'Ergänzen Sie Produkttyp, Farbe oder Material für einen aussagekräftigen Namen.' },
                    'name::one_word':      { title: 'Artikelname: nur ein Wort',        action: 'Der Name muss aus mindestens 2 Wörtern bestehen.',                              tip: 'Kombinieren Sie Marke + Produktname, z. B. „BRAND Tisch" oder „Hersteller Sofa grau".' },
                    'name::placeholder':   { title: 'Artikelname: Platzhalterwert',     action: 'Ersetzen Sie Platzhalter wie „n/a" oder „test" durch echte Artikelnamen.',       tip: 'Verwenden Sie produktspezifische, eindeutige Namen.' },
                    'name::dup':           { title: 'Artikelname: Duplikate',           action: 'Jeder Artikel muss einen eindeutigen Namen haben. Korrigieren oder entfernen Sie Duplikate.', tip: 'Unterscheiden Sie Varianten durch Farbe, Größe oder Modellbezeichnung.' },
                    'ean::missing':        { title: 'EAN fehlt',                        action: 'Ergänzen Sie die EAN (GTIN14) für alle betroffenen Artikel.',                   tip: 'Verwenden Sie die offizielle GTIN aus der GS1-Datenbank.' },
                    'ean::wrong_length':   { title: 'EAN: falsche Länge',               action: 'Die EAN muss 13 oder 14 Stellen haben (EAN-13 oder GTIN-14).',                   tip: 'Beispiel: EAN-13 „4012345678901" (13-stellig) oder GTIN-14 „04012345678901" (14-stellig).' },
                    'ean::invalid':        { title: 'EAN: ungültiger Wert',             action: 'Entfernen Sie Sonderzeichen, die EAN darf nur Ziffern enthalten.',              tip: 'Keine Buchstaben, Leerzeichen oder Bindestriche erlaubt.' },
                    'ean::placeholder':    { title: 'EAN: Platzhalterwert',             action: 'Ersetzen Sie Test-EANs durch gültige GTIN14-Nummern.',                          tip: 'Erfundene oder Test-EANs werden blockiert.' },
                    'ean::dup':            { title: 'EAN: Duplikate',                   action: 'Jede EAN darf nur einmal vorkommen. Korrigieren Sie die doppelten Einträge.',   tip: 'Prüfen Sie, ob Artikel versehentlich mehrfach exportiert wurden.' },
                    'description::missing':    { title: 'Beschreibung fehlt',               action: 'Ergänzen Sie eine Produktbeschreibung für alle betroffenen Artikel.',           tip: 'Mindestens 20 Zeichen, empfohlen 100–500 Zeichen mit Material, Maßen und Features.' },
                    'description::too_short':  { title: 'Beschreibung zu kurz',             action: 'Verlängern Sie die Beschreibung auf mindestens 20 Zeichen.',                     tip: 'Nennen Sie Material, Farbe, Maße und besondere Produkteigenschaften.' },
                    'description::bware':      { title: 'Beschreibung: B-Ware-Hinweis',     action: 'Entfernen Sie die Kennzeichnung „B-Ware" aus der Beschreibung.',                tip: 'B-Ware-Artikel können nicht als Neuware gelistet werden.' },
                    'description::placeholder':{ title: 'Beschreibung: Platzhalterwert',    action: 'Ersetzen Sie Platzhalter durch echte Produktbeschreibungen.',                   tip: 'Beschreiben Sie Material, Farbe und Besonderheiten des Produkts.' },
                    'price::missing':      { title: 'Preis fehlt',                      action: 'Ergänzen Sie den Preis für alle betroffenen Artikel.',                          tip: 'Format: 19.99 (Punkt als Dezimaltrennzeichen, ohne €-Zeichen).' },
                    'price::invalid':      { title: 'Preis: ungültiges Format',         action: 'Korrigieren Sie das Preisformat auf 19.99.',                                    tip: 'Nur positive Zahlen mit Punkt als Dezimaltrennzeichen, z. B. 29.99.' },
                    'price::placeholder':  { title: 'Preis: Platzhalterwert',           action: 'Ersetzen Sie Platzhalterwerte durch den korrekten Artikelpreis.',               tip: 'Der Preis muss eine positive Zahl größer als 0 sein.' },
                    'shipping_mode::missing':  { title: 'Versandart fehlt',              action: 'Tragen Sie die Versandart ein: „paket" für normale Paketlieferung oder „spedition" für Speditionsversand.',                   tip: 'Schwere oder sperrige Möbel zählen in der Regel als „spedition".' },
                    'shipping_mode::invalid':  { title: 'Versandart: ungültiger Wert',   action: 'Ersetzen Sie den Wert durch „paket" oder „spedition" – diese sind die einzigen gültigen Optionen.',                  tip: 'Prüfen Sie auf Leerzeichen, Groß-/Kleinschreibung oder Tippfehler.' },
                    'shipping_mode::placeholder': { title: 'Versandart: Platzhalterwert', action: 'Ersetzen Sie Platzhalterwerte durch „paket" (Paketversand) oder „spedition" (Speditionslieferung).',              tip: 'Wählen Sie anhand von Gewicht und Größe: Pakete bis ca. 30 kg → „paket", größer/schwerer → „spedition".' },
                    'image_url::missing':  { title: 'Bild-URL fehlt',                  action: 'Fügen Sie für jeden Artikel eine öffentlich erreichbare Bild-URL ein.',         tip: 'Freigestelltes Bild auf weißem Hintergrund, mind. 600×600 px, kein Login nötig.' },
                    'image_url::invalid':  { title: 'Bild-URL: ungültiger Wert',       action: 'Prüfen Sie, ob die Bild-URL korrekt und öffentlich erreichbar ist.',            tip: 'URL muss mit http:// oder https:// beginnen und direkt auf eine Bilddatei zeigen.' },
                    'availability::missing':   { title: 'Bestand / Verfügbarkeit fehlt', action: 'Geben Sie Lagerbestand oder Verfügbarkeitsstatus für alle Artikel an.',        tip: 'Entweder numerischer Bestand (z. B. 10) oder einen Verfügbarkeitsstatus.' },
                    'stock_amount::missing':   { title: 'Bestand fehlt',                 action: 'Ergänzen Sie den numerischen Lagerbestand.',                                   tip: 'Tragen Sie den aktuellen Bestand als Zahl ein, z. B. 5 oder 100.' },
                    'brand::missing':      { title: 'Marke fehlt',                      action: 'Ergänzen Sie den Markennamen für alle betroffenen Artikel.',                   tip: 'Verwenden Sie den offiziellen Markennamen, mind. 2 Zeichen.' },
                    'brand::too_short':    { title: 'Marke: zu kurz',                   action: 'Ergänzen Sie den vollständigen Markennamen (mind. 2 Zeichen).',                              tip: 'Abkürzungen vermeiden – verwenden Sie den offiziellen Namen, z. B. „Müller Möbel" statt „MM".' },
                    'brand::placeholder':  { title: 'Marke: Platzhalterwert',           action: 'Ersetzen Sie Platzhalter durch den echten Markennamen.',                       tip: 'Der Markenname muss für jeden Artikel ausgefüllt sein.' },
                    'delivery_time::missing':  { title: 'Lieferzeit fehlt',              action: 'Tragen Sie die Lieferzeit ein, z. B. „3-5 Werktage" oder „2 Tage". Kunden erwarten diese Angabe vor dem Kauf.',                   tip: 'Format: Zahl + Einheit. Werktage-Angaben (z. B. „3-5 Werktage") werden bevorzugt.' },
                    'delivery_time::invalid':  { title: 'Lieferzeit: ungültiges Format', action: 'Schreiben Sie die Lieferzeit im Format „Zahl + Einheit", z. B. „3-5 Werktage", „1 Woche" oder „2 Tage".',                                   tip: 'Die Einheit (Tage/Werktage/Woche) muss lesbar sein. Nur eine Zahl ohne Einheit wird abgelehnt.' },
                    'delivery_time::placeholder': { title: 'Lieferzeit: Platzhalterwert', action: 'Ersetzen Sie Platzhalter durch reale Lieferzeitangaben.',                   tip: 'Geben Sie die tatsächliche Lieferzeit an, z. B. „3-5 Werktage".' },
                    'seller_offer_id::missing':{ title: 'Eigene Artikel-ID fehlt',       action: 'Ergänzen Sie Ihre interne Artikel-ID für alle betroffenen Zeilen.',            tip: 'Die Artikel-ID muss eindeutig pro Artikel sein.' },
                    'seller_offer_id::placeholder':{ title: 'Artikel-ID: Platzhalterwert', action: 'Ersetzen Sie Platzhalter durch echte, eindeutige Artikel-IDs.',            tip: 'Verwenden Sie Ihre internen SKU oder Artikelnummern.' },
                    'hs_code::missing':    { title: 'HS-Code fehlt',                    action: 'Da Ihr Lager außerhalb Deutschlands liegt, ist der HS-Code Pflichtfeld.',      tip: 'Den passenden HS-Code finden Sie im EU-Zolltarifverzeichnis (customs.ec.europa.eu).' },
                    'ean::scientific':     { title: 'EAN in wissenschaftlicher Notation', action: 'Speichern Sie die Spalte in Excel als „Text", um die wissenschaftliche Notation zu verhindern.', tip: 'Excel wandelt lange Zahlen automatisch um. Spalte als Text formatieren, dann erneut speichern.' },
                    'name::siehe_oben':    { title: 'Artikelname: „siehe oben"',          action: 'Tragen Sie für jeden Artikel einen eigenen, vollständigen Namen ein.',           tip: '"Siehe oben" ist kein gültiger Artikelname und wird von CHECK24 abgelehnt.' },
                    'description::external_link': { title: 'Beschreibung: externe URL',   action: 'Entfernen Sie alle externen Links aus der Produktbeschreibung.',                tip: 'Keine www.- oder http(s)-Links in der Beschreibung erlaubt.' },
                    'description::template': { title: 'Beschreibung: Vorlagentext',       action: 'Ersetzen Sie Mustertexte wie „Lorem Ipsum" durch echte Produktbeschreibungen.', tip: 'Jedes Produkt braucht eine einzigartige, informative Beschreibung.' },
                    'description::advertising': { title: 'Beschreibung: Werbephrasen',    action: 'Entfernen Sie Werbephrasen wie „Jetzt kaufen" oder „Rabatt" aus der Beschreibung.', tip: 'Die Beschreibung soll Produkteigenschaften darstellen, keine Werbetexte.' },
                    'description::identical_to_title': { title: 'Beschreibung = Artikelname', action: 'Verfassen Sie eine eigenständige Beschreibung mit Material, Maßen und Besonderheiten – nicht einfach den Artikelnamen wiederholen.', tip: 'Beispiel: Statt „BRAND Sofa grau" → „Gepolstertes 3-Sitzer-Sofa aus Strukturstoff, 230 cm breit, mit Kaltschaum-Polsterung und abnehmbaren Bezügen."' },
                    'image_url::single':   { title: 'Nur 1 Produktbild',                  action: 'Fügen Sie mindestens 3 Bilder pro Artikel hinzu (Hauptbild + 2 Zusatzbilder).', tip: 'Mehr Bilder erhöhen die Klickrate und Conversion deutlich.' },
                    'seller_offer_id::dup':{ title: 'Eigene Artikel-ID: Duplikate',       action: 'Jede Artikel-ID (seller_offer_id) muss eindeutig sein. Korrigieren Sie Duplikate.', tip: 'Verwenden Sie Ihre interne SKU oder eine eindeutige Bestellnummer.' },
                    'category_path::wrong_category': { title: 'Kategoriepfad: falsche Kategorie', action: 'Ersetzen Sie die Kategorie durch eine gültige Möbelkategorie, z. B. „Sofa", „Boxspringbett", „Esstisch" oder „Kleiderschrank".', tip: 'CHECK24 Möbel akzeptiert nur Kategorien aus dem Möbel-Sortiment. Allgemeine Kategorien wie „Haushalt" oder „Sonstiges" werden abgelehnt.' },
                } : {
                    'name::missing':       { title: 'Item name missing',              action: 'Add a full product name for every affected item. Format: Brand + Product type + Key attribute, e.g. "BRAND Sofa 3-seater grey 180 cm".',                              tip: 'Min. 2 words and 10 characters. A descriptive name significantly improves search visibility.' },
                    'name::too_short':     { title: 'Item name too short',            action: 'Extend the item name to at least 10 characters.',                               tip: 'Add product type, color, or material to create a descriptive name.' },
                    'name::one_word':      { title: 'Item name: single word only',   action: 'The name must consist of at least 2 words.',                                    tip: 'Combine brand + product name, e.g. "BRAND Table" or "Brand Sofa grey".' },
                    'name::placeholder':   { title: 'Item name: placeholder value',  action: 'Replace placeholders like "n/a" or "test" with real item names.',               tip: 'Use product-specific, unique names.' },
                    'name::dup':           { title: 'Item name: duplicates',         action: 'Every item must have a unique name. Fix or remove duplicates.',                  tip: 'Differentiate variants by color, size, or model designation.' },
                    'ean::missing':        { title: 'EAN missing',                   action: 'Add the EAN (GTIN14) for all affected items.',                                  tip: 'Use the official GTIN from the GS1 database.' },
                    'ean::wrong_length':   { title: 'EAN: wrong length',             action: 'EAN must be 13 or 14 digits (EAN-13 or GTIN-14).',                              tip: 'Example: EAN-13 "4012345678901" (13 digits) or GTIN-14 "04012345678901" (14 digits).' },
                    'ean::invalid':        { title: 'EAN: invalid value',            action: 'Remove special characters; EAN must contain digits only.',                     tip: 'No letters, spaces, or hyphens allowed.' },
                    'ean::placeholder':    { title: 'EAN: placeholder value',        action: 'Replace test EANs with valid GTIN14 numbers.',                                  tip: 'Invented or test EANs will be blocked.' },
                    'ean::dup':            { title: 'EAN: duplicates',               action: 'Each EAN may only appear once. Fix the duplicate entries.',                     tip: 'Check whether items were accidentally exported multiple times.' },
                    'description::missing':    { title: 'Description missing',           action: 'Add a product description for all affected items.',                             tip: 'Min. 20 characters, ideally 100–500 with material, dimensions, and features.' },
                    'description::too_short':  { title: 'Description too short',         action: 'Extend the description to at least 20 characters.',                             tip: 'Mention material, color, dimensions, and key product features.' },
                    'description::bware':      { title: 'Description: used-goods label', action: 'Remove the "B-Ware" label from the description.',                               tip: 'Used goods items cannot be listed as new.' },
                    'description::placeholder':{ title: 'Description: placeholder value', action: 'Replace placeholder values with real product descriptions.',                  tip: 'Describe material, color, and special features of the product.' },
                    'price::missing':      { title: 'Price missing',                  action: 'Add the price for all affected items.',                                         tip: 'Format: 19.99 (dot as decimal separator, no currency symbol).' },
                    'price::invalid':      { title: 'Price: invalid format',          action: 'Correct the price format to 19.99.',                                            tip: 'Only positive numbers with dot as decimal separator, e.g. 29.99.' },
                    'price::placeholder':  { title: 'Price: placeholder value',       action: 'Replace placeholder values with the correct item price.',                       tip: 'The price must be a positive number greater than 0.' },
                    'shipping_mode::missing':  { title: 'Shipping mode missing',      action: 'Set the shipping mode to "paket" (parcel delivery) or "spedition" (freight delivery) for every affected item.',                                 tip: 'Heavy or bulky furniture typically qualifies as "spedition".' },
                    'shipping_mode::invalid':  { title: 'Shipping mode: invalid value', action: 'Replace the value with "paket" or "spedition" — these are the only accepted options.',                           tip: 'Check for extra spaces, capitalisation, or typos.' },
                    'shipping_mode::placeholder':{ title: 'Shipping mode: placeholder', action: 'Replace placeholder values with "paket" (parcel) or "spedition" (freight delivery).',                          tip: 'Choose based on weight and size: items up to ~30 kg → "paket", larger/heavier → "spedition".' },
                    'image_url::missing':  { title: 'Image URL missing',             action: 'Add a publicly accessible image URL for every item.',                           tip: 'Cut-out on white background, min. 600×600 px, no login required.' },
                    'image_url::invalid':  { title: 'Image URL: invalid value',      action: 'Check that the image URL is correct and publicly accessible.',                  tip: 'URL must start with http:// or https:// and point directly to an image file.' },
                    'availability::missing':   { title: 'Stock / Availability missing', action: 'Provide stock count or availability status for every item.',                   tip: 'Either a numeric stock count (e.g. 10) or an availability status.' },
                    'stock_amount::missing':   { title: 'Stock missing',              action: 'Add the numeric stock count.',                                                  tip: 'Enter the current stock as a number, e.g. 5 or 100.' },
                    'brand::missing':      { title: 'Brand missing',                 action: 'Add the brand name for all affected items.',                                   tip: 'Use the official brand name, min. 2 characters.' },
                    'brand::too_short':    { title: 'Brand: too short',              action: 'Enter the full brand name (at least 2 characters).',                                    tip: 'Avoid abbreviations — use the official name, e.g. "Müller Möbel" instead of "MM".' },
                    'brand::placeholder':  { title: 'Brand: placeholder value',      action: 'Replace placeholders with the real brand name.',                               tip: 'Brand name must be filled in for every item.' },
                    'delivery_time::missing':  { title: 'Delivery time missing',     action: 'Enter the delivery time, e.g. "3-5 working days" or "2 days". Customers check this before purchasing.',                                 tip: 'Format: number + unit. Working-day ranges (e.g. "3-5 working days") are preferred.' },
                    'delivery_time::invalid':  { title: 'Delivery time: invalid format', action: 'Write the delivery time as "number + unit", e.g. "3-5 working days", "1 week", or "2 days".',                                              tip: 'The unit (days / working days / week) must be present. A number alone without a unit will be rejected.' },
                    'delivery_time::placeholder':{ title: 'Delivery time: placeholder', action: 'Replace placeholders with actual delivery time information.',                 tip: 'Enter the real delivery time, e.g. "3-5 working days".' },
                    'seller_offer_id::missing':{ title: 'Own item ID missing',        action: 'Add your internal item ID for all affected rows.',                              tip: 'The item ID must be unique per item.' },
                    'seller_offer_id::placeholder':{ title: 'Item ID: placeholder value', action: 'Replace placeholders with real, unique item IDs.',                         tip: 'Use your internal SKUs or item numbers.' },
                    'hs_code::missing':    { title: 'HS Code missing',                action: 'Since your warehouse is outside Germany, HS Code is required.',                 tip: 'Find the correct HS Code in the EU customs tariff directory.' },
                    'ean::scientific':     { title: 'EAN in scientific notation',      action: 'Format the EAN column as "Text" in Excel to prevent scientific notation.',       tip: 'Excel converts long numbers automatically. Format the column as text before saving.' },
                    'name::siehe_oben':    { title: 'Item name: "siehe oben"',         action: 'Enter a unique, complete name for every item.',                                  tip: '"Siehe oben" is not a valid item name and will be rejected by CHECK24.' },
                    'description::external_link': { title: 'Description: external URL', action: 'Remove all external links from the product description.',                      tip: 'www. or http(s) links are not allowed in the description.' },
                    'description::template': { title: 'Description: template text',    action: 'Replace template text (Lorem Ipsum etc.) with real product descriptions.',       tip: 'Every product needs a unique, informative description.' },
                    'description::advertising': { title: 'Description: advertising phrases', action: 'Remove advertising phrases like "Buy now" or "Discount" from the description.', tip: 'Descriptions should present product features, not advertising copy.' },
                    'description::identical_to_title': { title: 'Description = Item name', action: 'Write a proper description covering material, dimensions, and features — do not just copy the item name.',      tip: 'Example: instead of "BRAND Sofa grey" → "Upholstered 3-seater sofa in structured fabric, 230 cm wide, cold-foam padding, removable covers."' },
                    'image_url::single':   { title: 'Only 1 product image',            action: 'Add at least 3 images per item (main image + 2 additional images).',            tip: 'More images significantly increase click-through rate and conversion.' },
                    'seller_offer_id::dup':{ title: 'Own item ID: duplicates',         action: 'Each seller_offer_id must be unique. Fix the duplicate entries.',               tip: 'Use your internal SKU or a unique order number.' },
                    'category_path::wrong_category': { title: 'Category path: wrong category', action: 'Replace the category with a valid furniture category, e.g. "Sofa", "Boxspringbett", "Esstisch", or "Kleiderschrank".', tip: 'CHECK24 Furniture only accepts categories from the furniture assortment. Generic categories like "Household" or "Other" will be rejected.' },
                };

                // Hinweise: quality issues that don't block listing
                const HINWEIS_TYPES = new Set(['too_short', 'one_word', 'single', 'identical_to_title', 'advertising', 'external_link', 'template']);

                const allRecommendations = Object.entries(errorsByType)
                    .sort((a, b) => b[1].count - a[1].count)
                    .map(([key, { count, type, sampleEans }]) => ({ key, count, type, sampleEans: sampleEans || [], rule: recRules[key] || null }))
                    .filter(({ rule }) => rule !== null);

                const criticalRecs = allRecommendations.filter(({ type }) => !HINWEIS_TYPES.has(type));
                const hinweisRecs = allRecommendations.filter(({ type }) => HINWEIS_TYPES.has(type));
                const recommendations = allRecommendations;

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
                        if (e.type === 'scientific') return T.csvErrScientific(label);
                        if (e.type === 'siehe_oben') return T.csvErrSieheOben(label);
                        if (e.type === 'external_link') return T.csvErrExternalLink(label);
                        if (e.type === 'template') return T.csvErrTemplate(label);
                        if (e.type === 'advertising') return T.csvErrAdvertising(label);
                        if (e.type === 'identical_to_title') return T.csvErrIdentical(label);
                        if (e.type === 'single' && e.field === 'image_url') return T.csvErrSingleImage;
                        if (e.type === 'wrong_category') return T.csvWrongCategory;
                        return T.csvErrFallback(label);
                    };
                    issues.pflichtErrors.forEach((e) => { if (!pflichtByRow[e.row]) pflichtByRow[e.row] = []; pflichtByRow[e.row].push(errorMsg(e)); });
                    issues.eanDupRows.forEach((rn) => { if (!pflichtByRow[rn]) pflichtByRow[rn] = []; pflichtByRow[rn].push(T.csvEanDup); });
                    issues.nameDupRows.forEach((rn) => { if (!pflichtByRow[rn]) pflichtByRow[rn] = []; pflichtByRow[rn].push(T.csvNameDup); });
                    if (issues.offerIdDupRows) issues.offerIdDupRows.forEach((rn) => { if (!pflichtByRow[rn]) pflichtByRow[rn] = []; pflichtByRow[rn].push(T.csvOfferIdDup); });
                    issues.optionalHints.forEach((e) => { if (!optionalByRow[e.row]) optionalByRow[e.row] = []; optionalByRow[e.row].push(T.csvErrMissing(T.csvFieldLabels[e.field] || e.field)); });
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
                    <div style={{ width: '100%', maxWidth: 1100 }}>

                        {/* Two-column layout: recommendations left, download panel right */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, alignItems: 'start' }}>

                            {/* Left: recommendations */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                {/* Page header */}
                                <div>
                                    <div style={{ fontSize: 18, fontWeight: 800, color: '#111827', marginBottom: 4 }}>
                                        {recommendations.length > 0
                                            ? (lang === 'de' ? 'Handlungsempfehlungen' : 'Recommendations')
                                            : T.recNoErrorsTitle}
                                    </div>
                                    {recommendations.length > 0 && (
                                        <div style={{ fontSize: 12, color: '#6B7280' }}>
                                            {lang === 'de'
                                                ? `${criticalRecs.length} kritische Fehler${hinweisRecs.length > 0 ? ` · ${hinweisRecs.length} Hinweise` : ''}`
                                                : `${criticalRecs.length} critical error${criticalRecs.length === 1 ? '' : 's'}${hinweisRecs.length > 0 ? ` · ${hinweisRecs.length} hint${hinweisRecs.length === 1 ? '' : 's'}` : ''}`}
                                        </div>
                                    )}
                                    {recommendations.length === 0 && (
                                        <div style={{ fontSize: 13, color: '#6B7280' }}>{T.recNoErrorsSub}</div>
                                    )}
                                </div>
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

                                {/* Recommendation cards - split into critical + hints */}
                                {recommendations.length > 0 && (() => {
                                    const toggleRec = (key) => setExpandedRecs((prev) => {
                                        const next = new Set(prev);
                                        if (next.has(key)) next.delete(key); else next.add(key);
                                        return next;
                                    });
                                    const renderCard = ({ key, count, rule, sampleEans }, severity) => {
                                        const isCritical = severity === 'critical';
                                        const collapsible = true;
                                        const isOpen = collapsible ? expandedRecs.has(key) : true;
                                        const accent = isCritical ? '#DC2626' : '#D97706';
                                        const bgChip = isCritical ? '#FEE2E2' : '#FEF3C7';
                                        const labelText = isCritical
                                            ? (lang === 'de' ? 'KRITISCH' : 'CRITICAL')
                                            : (lang === 'de' ? 'HINWEIS' : 'HINT');
                                        return (
                                            <div key={key} style={{ background: '#FFF', border: '1px solid #E5E7EB', borderLeft: `4px solid ${accent}`, borderRadius: 12, padding: isCritical ? (isOpen ? '16px 20px' : '12px 20px') : '12px 16px', transition: 'padding 0.15s' }}>
                                                <div
                                                    onClick={collapsible ? () => toggleRec(key) : undefined}
                                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: isOpen ? 6 : 0, cursor: collapsible ? 'pointer' : 'default', userSelect: collapsible ? 'none' : 'auto' }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                                                        <div style={{ width: isCritical ? 28 : 24, height: isCritical ? 28 : 24, borderRadius: 6, background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                            {fieldIcon(key.split('::')[0])}
                                                        </div>
                                                        <div style={{ minWidth: 0 }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                                                <span style={{ fontSize: isCritical ? 14 : 13, fontWeight: 700, color: '#111827' }}>{rule.title}</span>
                                                                <span style={{ fontSize: 9, fontWeight: 700, color: accent, background: bgChip, padding: '2px 7px', borderRadius: 4, letterSpacing: '0.04em' }}>
                                                                    {labelText}
                                                                </span>
                                                                <span style={{ fontSize: 11, color: accent, fontWeight: 600 }}>
                                                                    {T.recAffected(count.toLocaleString(numLocale))}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {collapsible && (
                                                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, color: '#9CA3AF', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
                                                            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                                                        </svg>
                                                    )}
                                                </div>
                                                {isOpen && (
                                                    <>
                                                        <div style={{ fontSize: isCritical ? 13 : 12, color: '#374151', lineHeight: 1.6, marginTop: 8, marginBottom: 6 }}>
                                                            {rule.action}
                                                        </div>
                                                        {sampleEans && sampleEans.length > 0 && (
                                                            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                                                                <span style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600, marginRight: 2 }}>EAN:</span>
                                                                {sampleEans.map((ean) => (
                                                                    <span key={ean} style={{ fontSize: 10, color: '#374151', background: '#F3F4F6', borderRadius: 4, padding: '1px 6px', fontFamily: 'monospace' }}>{ean}</span>
                                                                ))}
                                                                {count > sampleEans.length && (
                                                                    <span style={{ fontSize: 10, color: '#9CA3AF' }}>+{count - sampleEans.length} {lang === 'de' ? 'weitere' : 'more'}</span>
                                                                )}
                                                            </div>
                                                        )}
                                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, background: '#F9FAFB', borderRadius: 6, padding: '7px 11px' }}>
                                                            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="8" cy="8" r="6.5" stroke={MC_BLUE} strokeWidth="1.4"/><path d="M8 7v4" stroke={MC_BLUE} strokeWidth="1.4" strokeLinecap="round"/><circle cx="8" cy="5.5" r=".6" fill={MC_BLUE}/></svg>
                                                            <span style={{ fontSize: 11, color: '#6B7280', lineHeight: 1.5 }}>{rule.tip}</span>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        );
                                    };

                                    return (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                            {criticalRecs.length > 0 && (
                                                <div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                                                        <span style={{ fontSize: 11, fontWeight: 700, color: '#DC2626', letterSpacing: '0.04em' }}>
                                                            {lang === 'de' ? 'KRITISCHE FEHLER' : 'CRITICAL ERRORS'}
                                                        </span>
                                                        <span style={{ fontSize: 11, color: '#9CA3AF' }}>·</span>
                                                        <span style={{ fontSize: 11, color: '#6B7280' }}>
                                                            {lang === 'de' ? 'verhindern das Listing' : 'block listing'}
                                                        </span>
                                                    </div>
                                                    <div style={{ display: 'grid', gap: 10 }}>
                                                        {criticalRecs.map((r) => renderCard(r, 'critical'))}
                                                    </div>
                                                </div>
                                            )}
                                            {hinweisRecs.length > 0 && (
                                                <div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                                                        <span style={{ fontSize: 11, fontWeight: 700, color: '#D97706', letterSpacing: '0.04em' }}>
                                                            {lang === 'de' ? 'HINWEISE' : 'HINTS'}
                                                        </span>
                                                        <span style={{ fontSize: 11, color: '#9CA3AF' }}>·</span>
                                                        <span style={{ fontSize: 11, color: '#6B7280' }}>
                                                            {lang === 'de' ? 'Qualitätsverbesserungen, optional' : 'quality improvements, optional'}
                                                        </span>
                                                    </div>
                                                    <div style={{ display: 'grid', gap: 8 }}>
                                                        {hinweisRecs.map((r) => renderCard(r, 'hint'))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* Right: download + reset panel */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, position: 'sticky', top: 20, alignSelf: 'flex-start', maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' }}>

                                {/* Feed summary stats */}
                                <div style={{ background: '#FFF', border: '1px solid #E5E7EB', borderRadius: 12, padding: '14px 16px' }}>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.06em', marginBottom: 12, textTransform: 'uppercase' }}>
                                        {lang === 'de' ? 'Feed-Übersicht' : 'Feed Overview'}
                                    </div>
                                    {(() => {
                                        const s = issues.pflichtScore;
                                        const sc = s >= 90 ? '#16A34A' : s >= 60 ? '#D97706' : '#DC2626';
                                        const r = 16, circ = 2 * Math.PI * r;
                                        const lc = issues.livefaehigCount;
                                        const tc = issues.totalRows;
                                        const lColor = lc === tc ? '#16A34A' : lc > 0 ? '#D97706' : '#DC2626';
                                        return (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 12 }}>
                                                    <svg width="40" height="40" viewBox="0 0 40 40" style={{ flexShrink: 0 }}>
                                                        <circle cx="20" cy="20" r={r} fill="none" stroke="#F3F4F6" strokeWidth="4"/>
                                                        <circle cx="20" cy="20" r={r} fill="none" stroke={sc} strokeWidth="4"
                                                            strokeDasharray={`${(s / 100) * circ} ${circ}`}
                                                            strokeLinecap="round" transform="rotate(-90 20 20)"
                                                        />
                                                        <text x="20" y="25" textAnchor="middle" fontSize="10" fontWeight="900" fill={sc}>{s}</text>
                                                    </svg>
                                                    <div>
                                                        <div style={{ fontSize: 13, fontWeight: 700, color: sc }}>{s} <span style={{ fontSize: 10, fontWeight: 500, color: '#9CA3AF' }}>{lang === 'de' ? '/ 100 Punkte' : '/ 100 pts'}</span></div>
                                                        <div style={{ fontSize: 11, color: '#374151', marginTop: 1 }}>{lang === 'de' ? 'Pflichtfeld-Score' : 'Required field score'}</div>
                                                    </div>
                                                </div>
                                                <div style={{ height: 1, background: '#F3F4F6', marginBottom: 12 }} />
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                    <div style={{ width: 40, textAlign: 'center', flexShrink: 0 }}>
                                                        <span style={{ fontSize: 26, fontWeight: 900, color: lColor, lineHeight: 1 }}>{lc.toLocaleString(numLocale)}</span>
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: 13, fontWeight: 700, color: lColor }}>{lang === 'de' ? 'Listbar' : 'Listable'}</div>
                                                        <div style={{ fontSize: 11, color: '#374151', marginTop: 1 }}>
                                                            {lang === 'de' ? `von ${tc.toLocaleString(numLocale)} Artikeln` : `of ${tc.toLocaleString(numLocale)} items`}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>

                                {/* Download Fehlerbericht — primary CTA, shown first */}
                                <div style={{ background: '#EEF4FF', border: `2px solid ${MC_BLUE}`, borderRadius: 12, padding: '16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                        <svg width="16" height="16" viewBox="0 0 18 18" fill="none"><path d="M9 2v10M6 9l3 3 3-3M2 15h14" stroke={MC_BLUE} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                        <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{T.recDownloadTitle}</span>
                                    </div>
                                    <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 12, lineHeight: 1.5 }}>{T.recDownloadDesc}</div>
                                    <button type="button" onClick={csvOnClick}
                                        style={{ width: '100%', padding: '11px', background: MC_BLUE, color: '#FFF', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                                        <svg width="13" height="13" viewBox="0 0 15 15" fill="none"><path d="M7.5 2v8M5 7l2.5 2.5L10 7M2 13h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                        {T.recDownloadBtn}
                                    </button>
                                </div>

                                {/* Next steps workflow */}
                                <div style={{ background: '#FFF', border: '1px solid #E5E7EB', borderRadius: 12, padding: '14px 16px' }}>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                        {lang === 'de' ? 'So geht es weiter' : 'What to do next'}
                                    </div>
                                    {[
                                        {
                                            n: 1,
                                            title: lang === 'de' ? 'Fehlerbericht herunterladen' : 'Download error report',
                                            desc: lang === 'de' ? 'CSV-Datei mit allen Fehlern je Zeile für Excel' : 'CSV file with all errors per row for Excel',
                                        },
                                        {
                                            n: 2,
                                            title: lang === 'de' ? 'Fehler in Excel korrigieren' : 'Fix errors in Excel',
                                            desc: lang === 'de' ? 'Betroffene Artikel anhand der Fehlerspalte bearbeiten' : 'Edit affected items using the error column',
                                        },
                                        {
                                            n: 3,
                                            title: lang === 'de' ? 'Korrigierten Feed hochladen' : 'Re-upload corrected feed',
                                            desc: lang === 'de' ? 'Direkt im Händlerportal unter Einstellungen → Feed' : 'In the merchant portal under Settings → Feed',
                                        },
                                    ].map(({ n, title, desc }) => (
                                        <div key={n} style={{ display: 'flex', gap: 10, marginBottom: n < 3 ? 10 : 0 }}>
                                            <div style={{ width: 20, height: 20, borderRadius: '50%', background: MC_BLUE, color: '#FFF', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{n}</div>
                                            <div>
                                                <div style={{ fontSize: 11, fontWeight: 600, color: '#111827' }}>{title}</div>
                                                <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 1, lineHeight: 1.4 }}>{desc}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Nav */}
                                <div style={{ display: 'flex', gap: 6 }}>
                                    <button type="button" onClick={() => setStep(4)}
                                        style={{ flex: 1, padding: '10px 16px', background: '#FFF', color: '#374151', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                                        {T.back}
                                    </button>
                                    <button type="button" onClick={resetToStart}
                                        style={{ flex: 1, padding: '10px 16px', background: '#FFF', color: '#374151', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                        <svg width="11" height="11" viewBox="0 0 15 15" fill="none"><path d="M2 7.5h11M7 2.5l-5 5 5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                        {lang === 'de' ? 'Neu hochladen' : 'Upload new'}
                                    </button>
                                </div>
                            </div>

                        </div>

                    </div>
                );
            })()}

            </div>

            {/* Footer scrolls with content */}
            <footer style={{ background: '#FFF', borderTop: '1px solid #E5E7EB', padding: '5px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, marginTop: 'auto' }}>
                <span style={{ fontSize: 10, color: '#9CA3AF' }}>{T.footerLeft}</span>
                <span style={{ fontSize: 10, color: '#9CA3AF' }}>{T.footerRight}</span>
            </footer>

            </div>{/* end scrollable area */}
        </div>{/* end main body */}

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
        {/* Feedvorlage Column Reference Modal */}
        {showVorlage && (() => {
            const exMap = Object.fromEntries(VORLAGE_HEADERS.map((h, i) => [h, VORLAGE_EXAMPLE[i]]));
            const PFLICHT_SET = new Set(['EAN (GTIN14)', 'name']);
            const VG = [
                { label: lang === 'de' ? 'Identifikation' : 'Identification', color: '#1553B6', cols: ['EAN (GTIN14)', 'offer_id', 'name', 'brand', 'series', 'model', 'category_path', 'deeplink'] },
                { label: lang === 'de' ? 'Beschreibung & Merkmale' : 'Description & Features', color: '#7C3AED', cols: ['description', 'color', 'material', 'surface_treatment', 'material_wood_quality', 'frame_material', 'orientation', 'cover', 'removable_cover', 'washable_cover', 'care_instructions', 'suitable_for_allergic', 'certificate', 'temper', 'density', 'filling', 'filling_weight', 'filling_quantity', 'quilt_type', 'quilt_zones', 'number_lying_zones'] },
                { label: lang === 'de' ? 'Maße & Gewicht' : 'Dimensions & Weight', color: '#059669', cols: ['size', 'size_height', 'size_width', 'size_depth', 'size_diameter', 'size_lying_surface', 'size_seat_height', 'size_seat_depth', 'size_seat_width', 'weight', 'weight_capacity'] },
                { label: lang === 'de' ? 'Ausstattung & Lieferumfang' : 'Features & Included', color: '#D97706', cols: ['with_drawer', 'numbers_doors', 'numbers_drawers', 'numbers_shelf', 'softclose', 'set_includes', 'delivery_includes', 'incl_mattress', 'incl_slatted_frame', 'lighting_included', 'illuminant_included', 'socket', 'two_men_handling'] },
                { label: lang === 'de' ? 'Energie & Zertifikate' : 'Energy & Certificates', color: '#10B981', cols: ['energy_efficiency_label', 'energy_efficiency_category', 'EPREL_registration_number', 'ce_label_declaration_confirmation', 'ce_label_instruction_manual', 'ce_label_safety_instructions', 'disposal_old_packaging', 'disposal_old_furniture'] },
                { label: lang === 'de' ? 'Bilder (1–10)' : 'Images (1–10)', color: '#EC4899', cols: ['Bildlink_1', 'Bildlink_2', 'Bildlink_3', 'Bildlink_4', 'Bildlink_5', 'Bildlink_6', 'Bildlink_7', 'Bildlink_8', 'Bildlink_9', 'Bildlink_10'] },
                { label: lang === 'de' ? 'Preis & Versand' : 'Price & Shipping', color: '#0891B2', cols: ['price', 'stock_amount', 'availability', 'delivery_time', 'shipping_mode', 'shipping_cost', 'shipping_no_of_items', 'shipping_size_pack1', 'shipping_weight_in_kg', 'delivery_condition', 'delivery_place_use', 'assembly_service', 'HS-Code'] },
                { label: lang === 'de' ? 'Hersteller' : 'Manufacturer', color: '#B45309', cols: ['manufacturer_name', 'manufacturer_street', 'manufacturer_postcode', 'manufacturer_city', 'manufacturer_country', 'manufacturer_email', 'manufacturer_phone_number'] },
                { label: lang === 'de' ? 'Dokumente & Service' : 'Documents & Service', color: '#6B7280', cols: ['assembly_instructions', 'product_data_sheet', 'automatic_return_label'] },
            ];
            const assignedSet = new Set(VG.flatMap(g => g.cols));
            const remaining = VORLAGE_HEADERS.filter(h => !assignedSet.has(h));
            const allGroups = remaining.length > 0 ? [...VG, { label: 'Sonstiges', color: '#9CA3AF', cols: remaining }] : VG;
            const q = vorlageSearch.trim().toLowerCase();
            const filteredGroups = q
                ? allGroups.map(g => ({ ...g, cols: g.cols.filter(c => c.toLowerCase().includes(q) || (exMap[c] || '').toLowerCase().includes(q)) })).filter(g => g.cols.length > 0)
                : allGroups;
            const totalShown = filteredGroups.reduce((s, g) => s + g.cols.length, 0);
            return (
                <div onClick={() => { setShowVorlage(false); setVorlageSearch(''); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
                    <div onClick={(e) => e.stopPropagation()} style={{ background: '#FFF', borderRadius: 12, width: '100%', maxWidth: 'min(860px, 95vw)', height: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
                        {/* Header */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid #E5E7EB', flexShrink: 0 }}>
                            <div>
                                <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{lang === 'de' ? 'Feedvorlage 2026: Spaltenübersicht' : 'Feed Template 2026: Column Reference'}</span>
                                <span style={{ fontSize: 12, color: '#9CA3AF', marginLeft: 10 }}>{totalShown} {lang === 'de' ? 'Spalten' : 'columns'}</span>
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button type="button" onClick={downloadFeedvorlage} style={{ fontSize: 12, fontWeight: 600, color: '#111827', padding: '6px 14px', borderRadius: 6, border: '1px solid #E5E7EB', background: '#F9FAFB', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 1.5v7M4 6l2.5 2.5L9 6M1.5 11h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                    {lang === 'de' ? 'Als XLSX herunterladen' : 'Download as XLSX'}
                                </button>
                                <button type="button" onClick={() => { setShowVorlage(false); setVorlageSearch(''); }} style={{ fontSize: 18, lineHeight: 1, color: '#6B7280', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 4 }}>✕</button>
                            </div>
                        </div>
                        {/* Search + legend */}
                        <div style={{ padding: '10px 20px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, background: '#FAFAFA' }}>
                            <div style={{ position: 'relative', flex: 1 }}>
                                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }}><circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.3"/><path d="M10 10l3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
                                <input type="text" value={vorlageSearch} onChange={e => setVorlageSearch(e.target.value)} placeholder={lang === 'de' ? 'Spaltenname oder Beispielwert suchen…' : 'Search column name or example value…'} style={{ width: '100%', paddingLeft: 28, paddingRight: 10, paddingTop: 6, paddingBottom: 6, border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 12, outline: 'none', boxSizing: 'border-box', background: '#fff' }} />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                <div style={{ width: 12, height: 12, background: '#FEF08A', border: '1px solid #EAB308', borderRadius: 2 }} />
                                <span style={{ fontSize: 11, color: '#6B7280' }}>{lang === 'de' ? '= Pflichtfeld' : '= Required field'}</span>
                            </div>
                        </div>
                        {/* Grouped cards */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                            {filteredGroups.length === 0 && (
                                <div style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 13, padding: '40px 0' }}>{lang === 'de' ? 'Keine Spalten gefunden.' : 'No columns found.'}</div>
                            )}
                            {filteredGroups.map((grp) => (
                                <div key={grp.label}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                                        <div style={{ width: 4, height: 16, borderRadius: 2, background: grp.color, flexShrink: 0 }} />
                                        <span style={{ fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{grp.label}</span>
                                        <span style={{ fontSize: 11, color: '#9CA3AF' }}>({grp.cols.length})</span>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, minWidth: 0 }}>
                                        {grp.cols.filter(c => VORLAGE_HEADERS.includes(c)).map((col) => {
                                            const isPflicht = PFLICHT_SET.has(col);
                                            const ex = exMap[col] || '';
                                            const idx = VORLAGE_HEADERS.indexOf(col) + 1;
                                            return (
                                                <div key={col} style={{ border: `1px solid ${isPflicht ? '#FDE68A' : '#E5E7EB'}`, borderRadius: 7, padding: '8px 10px', background: isPflicht ? '#FFFBEB' : '#FAFAFA', display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, overflow: 'hidden' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                                                        <span style={{ fontSize: 10, color: '#9CA3AF', minWidth: 18, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{idx}</span>
                                                        <span style={{ fontSize: 12, fontWeight: 600, color: isPflicht ? '#92400E' : '#111827', fontFamily: 'monospace', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={col}>{col}</span>
                                                        {isPflicht && <span style={{ fontSize: 9, fontWeight: 700, color: '#92400E', background: '#FEF08A', border: '1px solid #EAB308', borderRadius: 3, padding: '1px 4px', flexShrink: 0 }}>P</span>}
                                                    </div>
                                                    <div style={{ fontSize: 11, color: '#6B7280', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingLeft: 23 }} title={ex}>{ex || '-'}</div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            );
        })()}
        </div>
    );
}
