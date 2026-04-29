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
                    if (val.length !== 14) {
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

    function resetToStart() {
        setFile(null);
        setRows([]);
        setHeaders([]);
        setManualMapping({});
        setStep(1);
    }

    // ── Field labels (shared across steps) ──
    const FIELD_LABELS = {
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
    };

    // ── Pflicht fields for step-3 table (ordered, availability combined) ──
    const PFLICHT_TABLE_FIELDS = [
        { key: 'name', label: 'Artikelname' },
        { key: 'price', label: 'Preis' },
        { key: 'seller_offer_id', label: 'Eigene Artikel-ID' },
        { key: 'brand', label: 'Marke' },
        { key: 'ean', label: 'EAN (GTIN14)' },
        { key: 'delivery_time', label: 'Lieferzeit' },
        { key: 'shipping_mode', label: 'Versandart' },
        { key: 'availability', label: 'Bestand / Verfügbarkeit' },
        { key: 'description', label: 'Beschreibung' },
        { key: 'image_url', label: 'Hauptbild' },
        ...(outsideGermany ? [{ key: 'hs_code', label: 'HS-Code' }] : []),
    ];

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
        <div style={{ background: '#F3F4F6', minHeight: '100vh' }}>
            {/* ── HEADER ── */}
            <header style={{ background: MC_BLUE, padding: '10px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                <span style={{ color: '#FFF', fontWeight: 900, fontSize: 18, letterSpacing: '-0.5px', fontStyle: 'italic', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    FEED CHECKER
                </span>

                {/* Step indicator */}
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    {[
                        { n: 1, label: 'Hochladen' },
                        { n: 2, label: 'Zuordnung' },
                        { n: 3, label: 'Ergebnis' },
                    ].map((s, i) => (
                        <React.Fragment key={s.n}>
                            {i > 0 && (
                                <div style={{ width: 28, height: 1, background: step >= s.n ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.2)', margin: '0 2px', marginBottom: 14 }} />
                            )}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                                <div style={{
                                    width: 24, height: 24, borderRadius: '50%',
                                    background: step === s.n ? '#FFF' : step > s.n ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.15)',
                                    color: step === s.n ? MC_BLUE : '#FFF',
                                    fontSize: 10, fontWeight: 800,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    transition: 'all 0.2s',
                                }}>
                                    {step > s.n ? '✓' : s.n}
                                </div>
                                <span style={{ fontSize: 9, color: step === s.n ? '#FFF' : 'rgba(255,255,255,0.55)', fontWeight: step === s.n ? 700 : 400, whiteSpace: 'nowrap' }}>
                                    {s.label}
                                </span>
                            </div>
                        </React.Fragment>
                    ))}
                </div>

                <a
                    href="mailto:contentmanagement.moebel@check24.de?subject=Feed%20Checker%20-%20Hilfe"
                    style={{ border: '1px solid rgba(255,255,255,0.3)', background: 'transparent', color: '#FFFFFF', fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none', flexShrink: 0 }}
                >
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ flexShrink: 0 }}><rect x="1" y="2.5" width="11" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M1 4l5.5 3.5L12 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
                    Hilfe & Kontakt
                </a>
            </header>
        {/* ── FUNNEL BODY ── */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 24px', minHeight: 'calc(100vh - 58px)', alignItems: step === 1 ? 'center' : 'flex-start' }}>
            <div style={{ display: 'contents' }}>

            {/* ══════════════════════════════════════════
                STEP 1 — Upload
            ══════════════════════════════════════════ */}
            {step === 1 && (
                <div style={{ width: '100%', maxWidth: 520 }}>
                    <div style={{ background: '#FFF', borderRadius: 16, padding: '36px 40px', boxShadow: '0 2px 16px rgba(0,0,0,0.08)' }}>
                        {/* Heading */}
                        <div style={{ marginBottom: 28, textAlign: 'center' }}>
                            <div style={{ fontSize: 22, fontWeight: 800, color: '#111827', marginBottom: 8 }}>Feed hochladen</div>
                            <div style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6 }}>
                                Laden Sie Ihren Angebotsfeed als CSV hoch. Wir prüfen alle Pflichtfelder und zeigen genau, welche Artikel Fehler haben.
                            </div>
                        </div>

                        {/* Drop zone */}
                        {file ? (
                            <div style={{ borderRadius: 10, border: '2px solid #BBF7D0', background: '#F0FDF4', padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2.5 1.5h8.5l3 3v10h-11.5v-13z" stroke="#16A34A" strokeWidth="1.4" strokeLinejoin="round"/><path d="M11 1.5v3h3" stroke="#16A34A" strokeWidth="1.4" strokeLinejoin="round"/><path d="M5 8.5l2 2 4-3" stroke="#16A34A" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: '#166534', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
                                    <div style={{ fontSize: 11, color: '#4B7A5A', marginTop: 2 }}>{(file.size / 1024).toFixed(1)} KB · {rows.length > 0 ? `${rows.length.toLocaleString('de-DE')} Artikel erkannt` : 'Wird gelesen…'}</div>
                                </div>
                                <button type="button" onClick={() => { setFile(null); setRows([]); setHeaders([]); setManualMapping({}); }}
                                    style={{ fontSize: 11, color: '#6B7280', background: 'none', border: '1px solid #D1D5DB', borderRadius: 5, padding: '4px 10px', cursor: 'pointer' }}>
                                    Ändern
                                </button>
                            </div>
                        ) : (
                            <div
                                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                                onDragLeave={() => setDragging(false)}
                                onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) parseFile(f); }}
                                onClick={() => fileRef.current?.click()}
                                style={{ border: `2px dashed ${dragging ? MC_BLUE : '#D1D5DB'}`, background: dragging ? '#EEF4FF' : '#F9FAFB', borderRadius: 10, padding: '36px 20px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s' }}
                            >
                                <div style={{ marginBottom: 10 }}>
                                    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={{ color: dragging ? MC_BLUE : '#9CA3AF' }}><rect x="4" y="6" width="18" height="22" rx="2" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M22 6l6 6v16a2 2 0 01-2 2H10" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M22 6v6h6" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M10 20l3 3 6-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                </div>
                                <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 4 }}>CSV-Datei hochladen</div>
                                <div style={{ fontSize: 12, color: '#6B7280' }}>Hierher ziehen oder klicken · max. 64 MB</div>
                                <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={(e) => parseFile(e.target.files?.[0] || null)} />
                            </div>
                        )}

                        {/* Lagerstandort toggle */}
                        <div style={{ marginTop: 24 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Lagerstandort des Händlers</div>
                            <div style={{ display: 'flex', background: '#F3F4F6', borderRadius: 8, padding: 3, gap: 3 }}>
                                {[{ value: 'germany', label: 'Deutschland' }, { value: 'outside_germany', label: 'Außerhalb Deutschland' }].map((opt) => (
                                    <button key={opt.value} type="button" onClick={() => setStoreLocation(opt.value)}
                                        style={{ flex: 1, padding: '8px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: storeLocation === opt.value ? 600 : 400, background: storeLocation === opt.value ? '#FFF' : 'transparent', color: storeLocation === opt.value ? MC_BLUE : '#6B7280', boxShadow: storeLocation === opt.value ? '0 1px 3px rgba(0,0,0,0.10)' : 'none', transition: 'all 0.15s' }}>
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                            {outsideGermany && (
                                <div style={{ marginTop: 6, fontSize: 11, color: '#6B7280' }}>HS-Code wird als Pflichtfeld geprüft.</div>
                            )}
                        </div>

                        {/* Primary CTA */}
                        <button
                            type="button"
                            onClick={() => rows.length > 0 && setStep(2)}
                            disabled={rows.length === 0}
                            style={{ width: '100%', marginTop: 28, padding: '14px', background: rows.length > 0 ? MC_BLUE : '#D1D5DB', color: '#FFF', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: rows.length > 0 ? 'pointer' : 'default', transition: 'background 0.2s' }}
                        >
                            {rows.length > 0 ? `Weiter · ${rows.length.toLocaleString('de-DE')} Artikel geladen →` : 'Bitte Datei hochladen'}
                        </button>
                    </div>

                    {/* Downloads below card */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
                        <button type="button" onClick={() => setShowLeitfaden(true)}
                            style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, color: MC_BLUE }}><path d="M2.5 1.5h8.5l3 3v10h-11.5v-13z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/><path d="M11 1.5v3h3" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/><path d="M5 8h6M5 10.5h6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                            <div style={{ textAlign: 'left' }}>
                                <div style={{ fontSize: 11, fontWeight: 600, color: '#111827' }}>Feedleitfaden</div>
                                <div style={{ fontSize: 10, color: '#6B7280' }}>PDF · Vorschau & Download</div>
                            </div>
                        </button>
                        <button type="button" onClick={() => { const a = document.createElement('a'); a.href = 'http://media-partner.moebel.check24.de/feedvorlagen/Feedleitfaden_Anhang_2026/CHECK24_Feedvorlage_V2025.xlsx'; a.download = 'CHECK24_Feedvorlage_V2025.xlsx'; a.click(); }}
                            style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, color: MC_BLUE }}><path d="M8 2v8M5 7l3 3 3-3M2 13h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            <div style={{ textAlign: 'left' }}>
                                <div style={{ fontSize: 11, fontWeight: 600, color: '#111827' }}>Feedvorlage</div>
                                <div style={{ fontSize: 10, color: '#6B7280' }}>XLSX · sofort herunterladen</div>
                            </div>
                        </button>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════
                STEP 2 — Spalten-Zuordnung
            ══════════════════════════════════════════ */}
            {step === 2 && (() => {
                const allMcFields2 = [
                    ...MC_PFLICHT_COLS.filter((f) => f !== 'image_url'),
                    ...(outsideGermany ? ['hs_code'] : []),
                    ...MC_OPTIONAL_COLS,
                ];
                const totalFields2 = allMcFields2.length + 1;
                const foundFields2 = allMcFields2.filter((f) => mcMapping[f]).length + (mcImageColumns.length > 0 ? 1 : 0);
                const manufacturerEnd = allMcFields2.indexOf('manufacturer_email');
                const displayFields2 = [
                    ...allMcFields2.slice(0, manufacturerEnd + 1),
                    'manufacturer_phone_number',
                    ...allMcFields2.filter((f) => f !== 'manufacturer_phone_number' && allMcFields2.indexOf(f) > manufacturerEnd),
                ].filter((f) => mcMapping[f] || MC_PFLICHT_COLS.includes(f) || (outsideGermany && f === 'hs_code'));
                const hiddenCount2 = allMcFields2.filter((f) => !mcMapping[f] && !MC_PFLICHT_COLS.includes(f) && !(outsideGermany && f === 'hs_code') && f !== 'manufacturer_phone_number').length;
                const missingPflicht2 = issues ? issues.missingPflichtCols.length : 0;

                return (
                    <div style={{ width: '100%', maxWidth: 680 }}>
                        {/* Back */}
                        <button type="button" onClick={() => setStep(1)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#6B7280', fontWeight: 600, padding: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            Zurück
                        </button>

                        {mcIsWrongFile ? (
                            <div style={{ padding: '20px', borderRadius: 12, border: '1px solid #FECACA', background: '#FEF2F2', display: 'flex', gap: 12 }}>
                                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0, color: '#DC2626' }}><path d="M10 3L2 17h16L10 3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M10 9v3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><circle cx="10" cy="14.5" r="0.75" fill="currentColor"/></svg>
                                <div>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: '#B91C1C', marginBottom: 4 }}>Diese Datei sieht nicht wie ein gültiger Produkt-Feed aus.</div>
                                    <div style={{ fontSize: 11, color: '#7F1D1D', lineHeight: 1.6 }}>Es konnten keine bekannten Spalten erkannt werden. Erwartete Spalten: <code>ean</code>, <code>name</code>, <code>price</code>, <code>shipping_mode</code> o.&nbsp;ä.</div>
                                </div>
                            </div>
                        ) : (
                            <div style={{ background: '#FFF', borderRadius: 16, boxShadow: '0 2px 16px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
                                {/* Card header */}
                                <div style={{ padding: '24px 28px 20px', borderBottom: '1px solid #F3F4F6' }}>
                                    <div style={{ fontSize: 20, fontWeight: 800, color: '#111827', marginBottom: 6 }}>Spalten-Zuordnung prüfen</div>
                                    <div style={{ fontSize: 13, color: '#6B7280' }}>
                                        {foundFields2} von {totalFields2} Feldern automatisch erkannt.
                                        {missingPflicht2 > 0 && <span style={{ color: '#B91C1C', fontWeight: 600 }}> {missingPflicht2} Pflichtfeld{missingPflicht2 > 1 ? 'er' : ''} nicht gefunden.</span>}
                                    </div>
                                </div>

                                {/* Missing pflicht warning */}
                                {missingPflicht2 > 0 && (
                                    <div style={{ margin: '16px 28px 0', padding: '10px 14px', borderRadius: 8, background: '#FEF2F2', border: '1px solid #FECACA', fontSize: 12, color: '#991B1B', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1 }}><path d="M8 2L1 14h14L8 2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/><path d="M8 7v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><circle cx="8" cy="12" r=".6" fill="currentColor"/></svg>
                                        Bitte ordnen Sie die rot markierten Pflichtfelder manuell zu, bevor Sie fortfahren.
                                    </div>
                                )}

                                {/* Mapping rows */}
                                <div style={{ padding: '16px 28px', display: 'grid', gap: 5 }}>
                                    {displayFields2.map((f) => {
                                        const isManual = f in manualMapping;
                                        const col = mcMapping[f];
                                        const isPflicht = MC_PFLICHT_COLS.includes(f) || (outsideGermany && f === 'hs_code');
                                        const missing = !col && isPflicht;
                                        return (
                                            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <span style={{ fontSize: 11, color: '#374151', width: 170, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    {FIELD_LABELS[f] || f}
                                                    {isPflicht && <span style={{ color: '#DC2626', fontWeight: 700 }}>*</span>}
                                                </span>
                                                <select
                                                    value={col || ''}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setManualMapping((prev) => { const next = { ...prev }; if (val === '') delete next[f]; else next[f] = val; return next; });
                                                    }}
                                                    style={{ flex: 1, fontSize: 11, padding: '4px 7px', borderRadius: 6, border: `1px solid ${missing ? '#FCA5A5' : col ? '#D1FAE5' : '#D1D5DB'}`, background: missing ? '#FFF5F5' : col ? '#F0FDF4' : '#FFF', cursor: 'pointer' }}
                                                >
                                                    <option value="">-- Nicht zugeordnet --</option>
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
                                        <span style={{ fontSize: 11, color: '#374151', width: 170, flexShrink: 0 }}>
                                            Hauptbild (+ Zusatzb.)<span style={{ color: '#DC2626', fontWeight: 700 }}>*</span>
                                        </span>
                                        <div style={{ flex: 1, fontSize: 11, padding: '5px 8px', borderRadius: 6, border: `1px solid ${mcImageColumns.length > 0 ? '#D1FAE5' : '#FCA5A5'}`, background: mcImageColumns.length > 0 ? '#F0FDF4' : '#FFF5F5', color: mcImageColumns.length > 0 ? '#166534' : '#DC2626', fontWeight: 600 }}>
                                            {mcImageColumns.length > 0 ? mcImageColumns.join(', ') : '– nicht erkannt –'}
                                        </div>
                                    </div>
                                    {hiddenCount2 > 0 && (
                                        <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>{hiddenCount2} weitere optionale Felder nicht im Feed erkannt</div>
                                    )}
                                </div>

                                {/* CTA */}
                                <div style={{ padding: '0 28px 28px' }}>
                                    <button type="button" onClick={() => setStep(3)}
                                        style={{ width: '100%', padding: '14px', background: MC_BLUE, color: '#FFF', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                                        Analyse starten →
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
                // Per-field coverage for table
                const totalPflichtFields = PFLICHT_TABLE_FIELDS.length;
                const vollstaendigFields = PFLICHT_TABLE_FIELDS.filter(({ key }) => {
                    const isMapped = key === 'availability'
                        ? (mcMapping.availability || mcMapping.stock_amount)
                        : key === 'image_url' ? mcImageColumns.length > 0
                        : mcMapping[key];
                    const errs = fieldErrorRows[key]?.size || 0;
                    return isMapped && errs === 0;
                }).length;

                return (
                    <div style={{ width: '100%', maxWidth: 820 }}>
                        {/* Top nav */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                            <button type="button" onClick={resetToStart}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#6B7280', fontWeight: 600, padding: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                Neuen Feed prüfen
                            </button>
                            {file && <span style={{ fontSize: 11, color: '#9CA3AF' }}>{file.name}</span>}
                        </div>

                        {/* Status banner */}
                        <div style={{ padding: '14px 20px', borderRadius: 12, background: stufe1Passed ? '#F0FDF4' : '#FEF2F2', border: `1px solid ${stufe1Passed ? '#BBF7D0' : '#FECACA'}`, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: stufe1Passed ? '#DCFCE7' : '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                {stufe1Passed
                                    ? <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8l4 4 6-6" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                    : <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2L1 14h14L8 2z" stroke="#DC2626" strokeWidth="1.5" strokeLinejoin="round"/><path d="M8 7v3" stroke="#DC2626" strokeWidth="1.5" strokeLinecap="round"/><circle cx="8" cy="12" r=".6" fill="#DC2626"/></svg>}
                            </div>
                            <div>
                                <div style={{ fontSize: 14, fontWeight: 700, color: stufe1Passed ? '#166534' : '#991B1B' }}>
                                    {stufe1Passed ? 'Feed fehlerfrei — alle Artikel können gelistet werden.' : 'Fehler gefunden — bitte beheben und Feed erneut hochladen.'}
                                </div>
                                <div style={{ fontSize: 12, color: stufe1Passed ? '#4B7A5A' : '#B91C1C', marginTop: 2 }}>
                                    Fehlerquote: {errorRate.toFixed(1).replace('.', ',')}% (Grenzwert: 5% für APA)
                                </div>
                            </div>
                        </div>

                        {/* Two-column grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, alignItems: 'start' }}>

                            {/* Left: Pflichtfeldanalyse table */}
                            <div style={{ background: '#FFF', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
                                <div style={{ padding: '14px 20px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Pflichtfeldanalyse</div>
                                    <div style={{ fontSize: 11, color: '#6B7280' }}>
                                        {totalPflichtFields} Felder · <span style={{ color: '#16A34A', fontWeight: 600 }}>{vollstaendigFields} vollständig</span> · <span style={{ color: '#DC2626', fontWeight: 600 }}>{totalPflichtFields - vollstaendigFields} fehlerhaft</span>
                                    </div>
                                </div>
                                {/* Table header */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 120px', padding: '8px 20px', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.05em' }}>FELD</div>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.05em', textAlign: 'right' }}>STATUS</div>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.05em', paddingLeft: 16 }}>ABDECKUNG</div>
                                </div>
                                {/* Table rows */}
                                {PFLICHT_TABLE_FIELDS.map(({ key, label }) => {
                                    const isMapped = key === 'availability'
                                        ? !!(mcMapping.availability || mcMapping.stock_amount)
                                        : key === 'image_url' ? mcImageColumns.length > 0
                                        : !!mcMapping[key];
                                    const errs = fieldErrorRows[key]?.size || 0;
                                    const pct = isMapped ? Math.max(0, Math.round((1 - errs / issues.totalRows) * 100)) : null;
                                    const barColor = pct === null ? '#E5E7EB' : pct === 100 ? '#16A34A' : pct >= 70 ? '#D97706' : '#DC2626';
                                    return (
                                        <div key={key} style={{ display: 'grid', gridTemplateColumns: '1fr 130px 120px', padding: '10px 20px', borderBottom: '1px solid #F9FAFB', alignItems: 'center' }}>
                                            <div style={{ fontSize: 12, color: '#374151', fontWeight: 500 }}>{label}</div>
                                            <div style={{ textAlign: 'right', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
                                                {pct === null ? (
                                                    <span style={{ color: '#9CA3AF' }}>Nicht im Feed</span>
                                                ) : errs === 0 ? (
                                                    <span style={{ color: '#16A34A' }}>✓ Vollständig</span>
                                                ) : (
                                                    <span style={{ color: pct < 30 ? '#DC2626' : '#D97706' }}>
                                                        {errs.toLocaleString('de-DE')} fehlend
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ paddingLeft: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                {pct !== null ? (
                                                    <>
                                                        <div style={{ flex: 1, height: 6, background: '#F3F4F6', borderRadius: 3, overflow: 'hidden' }}>
                                                            <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 3, transition: 'width 0.4s' }} />
                                                        </div>
                                                        <span style={{ fontSize: 10, color: '#9CA3AF', width: 26, textAlign: 'right', flexShrink: 0 }}>{pct}%</span>
                                                    </>
                                                ) : (
                                                    <span style={{ fontSize: 10, color: '#D1D5DB' }}>—</span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Right: Stats + CSV + errors */}
                            <div style={{ display: 'grid', gap: 12 }}>
                                {/* 3 stats */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                                    {[
                                        { val: issues.livefaehigCount, label: 'Vollständig', color: '#16A34A', tip: 'Artikel ohne Fehler in Pflichtfeldern' },
                                        { val: issues.blockiertCount, label: 'Fehler', color: '#DC2626', tip: 'Artikel mit mindestens einem Pflichtfeld-Fehler' },
                                        { val: issues.totalRows, label: 'Gesamt', color: '#111827', tip: 'Gesamtzahl Artikel im Feed' },
                                    ].map(({ val, label, color, tip }) => (
                                        <Tooltip key={label} text={tip}>
                                            <div style={{ background: '#FFF', borderRadius: 10, padding: '12px 8px', textAlign: 'center', border: '1px solid #E5E7EB', cursor: 'help', width: '100%' }}>
                                                <div style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1.1 }}>{val.toLocaleString('de-DE')}</div>
                                                <div style={{ fontSize: 10, color: '#6B7280', marginTop: 3 }}>{label}</div>
                                            </div>
                                        </Tooltip>
                                    ))}
                                </div>

                                {/* CSV download */}
                                <div style={{ background: '#EEF4FF', borderRadius: 12, border: `2px solid ${MC_BLUE}`, padding: '16px' }}>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Fehlerbericht herunterladen</div>
                                    <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 12, lineHeight: 1.5 }}>
                                        CSV mit allen Fehlern pro Zeile. Importieren Sie die Datei in Excel, um die Fehler zu beheben.
                                    </div>
                                    <button type="button"
                                        onClick={() => {
                                            const pflichtByRow = {}, optionalByRow = {};
                                            const errorMsg = (e) => {
                                                const labels = { name: 'Artikelname', brand: 'Marke', description: 'Beschreibung', ean: 'EAN', price: 'Preis', availability: 'Verfügbarkeit', stock_amount: 'Bestand', shipping_mode: 'Versandart', delivery_time: 'Lieferzeit', image_url: 'Bild', hs_code: 'HS-Code', seller_offer_id: 'Seller-ID' };
                                                const label = labels[e.field] || e.field;
                                                if (e.type === 'missing') return `${label} fehlt`;
                                                if (e.type === 'placeholder') return `${label}: Platzhalter-Wert`;
                                                if (e.type === 'too_short') return `${label}: zu kurz`;
                                                if (e.type === 'one_word') return `${label}: mind. 2 Wörter`;
                                                if (e.type === 'bware') return `${label}: enthält "B-Ware"`;
                                                if (e.type === 'wrong_length') return `${label}: muss 14 Zeichen haben`;
                                                if (e.type === 'invalid') return `${label}: ungültiger Wert`;
                                                return `${label} fehlerhaft`;
                                            };
                                            issues.pflichtErrors.forEach((e) => { if (!pflichtByRow[e.row]) pflichtByRow[e.row] = []; pflichtByRow[e.row].push(errorMsg(e)); });
                                            issues.eanDupRows.forEach((rn) => { if (!pflichtByRow[rn]) pflichtByRow[rn] = []; pflichtByRow[rn].push('EAN: doppelt vorhanden'); });
                                            issues.nameDupRows.forEach((rn) => { if (!pflichtByRow[rn]) pflichtByRow[rn] = []; pflichtByRow[rn].push('Artikelname: doppelt vorhanden'); });
                                            issues.optionalHints.forEach((e) => { if (!optionalByRow[e.row]) optionalByRow[e.row] = []; optionalByRow[e.row].push(`${e.field} fehlt`); });
                                            const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
                                            const sep = ';';
                                            const headerRow = ['Fehler Pflichtfelder', 'Fehler Optionale Felder', ...headers].map(esc).join(sep);
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
                                        }}
                                        style={{ width: '100%', padding: '11px', background: MC_BLUE, color: '#FFF', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                                        CSV herunterladen
                                    </button>
                                </div>

                                {/* Top error groups */}
                                {!stufe1Passed && (() => {
                                    const rowsByGroup2 = { desc: new Set(), size: new Set(), mfr: new Set(), img: new Set(), price: new Set(), name: new Set(), brand: new Set(), ean: new Set(), hs_code: new Set() };
                                    issues.pflichtErrors.forEach((e) => {
                                        if (e.field === 'description') rowsByGroup2.desc.add(e.row);
                                        else if (['size','size_height','size_depth','size_diameter'].includes(e.field)) rowsByGroup2.size.add(e.row);
                                        else if (e.field.startsWith('manufacturer_')) rowsByGroup2.mfr.add(e.row);
                                        else if (e.field === 'image_url') rowsByGroup2.img.add(e.row);
                                        else if (['price','availability','stock_amount','delivery_time','delivery_includes','shipping_mode'].includes(e.field)) rowsByGroup2.price.add(e.row);
                                        else if (e.field === 'name') rowsByGroup2.name.add(e.row);
                                        else if (e.field === 'brand') rowsByGroup2.brand.add(e.row);
                                        else if (e.field === 'ean') rowsByGroup2.ean.add(e.row);
                                        else if (e.field === 'hs_code') rowsByGroup2.hs_code.add(e.row);
                                    });
                                    issues.eanDupRows.forEach((rn) => rowsByGroup2.ean.add(rn));
                                    issues.nameDupRows.forEach((rn) => rowsByGroup2.name.add(rn));
                                    const topGroups2 = [
                                        { key: 'name', label: 'Artikelname', hint: 'Fehlt, zu kurz, ein Wort oder doppelt' },
                                        { key: 'ean', label: 'EAN', hint: 'Nicht 14 Zeichen oder doppelt' },
                                        { key: 'desc', label: 'Beschreibung', hint: 'Fehlt, unter 20 Zeichen oder B-Ware' },
                                        { key: 'img', label: 'Hauptbild', hint: 'Bild-URL fehlt' },
                                        { key: 'price', label: 'Preis / Lieferung', hint: 'Fehlt oder ungültig' },
                                        { key: 'brand', label: 'Marke', hint: 'Fehlt oder unter 2 Zeichen' },
                                        { key: 'mfr', label: 'Herstellerangaben', hint: 'Name, PLZ, Ort oder E-Mail fehlt' },
                                        { key: 'size', label: 'Maße', hint: 'Ungültiger Zahlenwert' },
                                        { key: 'hs_code', label: 'HS-Code', hint: 'Pflicht bei Lager außerhalb DE' },
                                    ].map((g) => ({ ...g, count: rowsByGroup2[g.key].size }))
                                     .filter((g) => g.count > 0)
                                     .sort((a, b) => b.count - a.count)
                                     .slice(0, 4);

                                    if (!topGroups2.length) return null;
                                    return (
                                        <div style={{ background: '#FFF', borderRadius: 12, border: '1px solid #E5E7EB', padding: '14px 16px' }}>
                                            <div style={{ fontSize: 12, fontWeight: 700, color: '#111827', marginBottom: 10 }}>Häufigste Fehler</div>
                                            <div style={{ display: 'grid', gap: 8 }}>
                                                {topGroups2.map((g) => (
                                                    <div key={g.key}>
                                                        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 2 }}>
                                                            <span style={{ fontSize: 11, fontWeight: 600, color: '#111827' }}>{g.label}</span>
                                                            <span style={{ fontSize: 10, fontWeight: 700, color: '#DC2626' }}>{g.count.toLocaleString('de-DE')} Artikel</span>
                                                        </div>
                                                        <div style={{ fontSize: 10, color: '#6B7280' }}>{g.hint}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })()}
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
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>Feedleitfaden 2026</span>
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
                                Herunterladen
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
        </div>
    );
}
