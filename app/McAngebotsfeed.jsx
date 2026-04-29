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
    // Kern-Identifikation (am wichtigsten)
    'name',
    'description',
    'brand',
    'category_path',
    'seller_offer_id',
    'ean',
    // Preis & Verfügbarkeit
    'price',
    'availability',
    'stock_amount',
    'delivery_time',
    'delivery_includes',
    'shipping_mode',
    // Hauptbild
    'image_url',
    // Produktmerkmale
    'color',
    'material',
    'size',
    'size_height',
    'size_depth',
    'size_diameter',
    // Herstellerangaben
    'manufacturer_name',
    'manufacturer_street',
    'manufacturer_postcode',
    'manufacturer_city',
    'manufacturer_country',
    'manufacturer_email',
];
// Stufe 2: Feed-Qualitätsscore – empfohlene Attribute (Score-relevant, 27 + Bildlink_2–10)
const MC_OPTIONAL_COLS = [
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
    const showQualityScore = false; // not public yet — re-enable when ready

    const [file, setFile] = useState(null);
    const [dragging, setDragging] = useState(false);
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

    // Reactive analysis — re-runs whenever mapping or rows change
    // Implements Zwei-Stufen-Modell: Stufe 1 (Hard Gate) + Stufe 2 (Soft Score)
    const issues = useMemo(() => {
        if (!rows.length || !headers.length) return null;

        const missingPflichtCols = MC_PFLICHT_COLS.filter((c) => {
            if (c === 'image_url') return mcImageColumns.length === 0;
            return !mcMapping[c];
        });
        const missingOptionalCols = MC_OPTIONAL_COLS.filter((c) => !mcMapping[c]);

        const pflichtErrors = [];
        const optionalHints = [];
        const duplicateEans = {};
        const duplicateNameEans = {};
        let pflichtOkCount = 0;
        let totalOptionalFieldsPresent = 0;
        // Stufe 2: 27 recommended cols + 9 extra image slots (Bildlink_2–10)
        const optionalFieldCount = MC_OPTIONAL_COLS.length + 9;

        const pflichtErrorRowNums = new Set();

        rows.forEach((row, i) => {
            const rn = i + 1;
            const ean = mcMapping.ean ? String(row[mcMapping.ean] ?? '').trim() : '';
            const name = mcMapping.name ? String(row[mcMapping.name] ?? '').trim() : '';
            let pflichtOk = true;
            let optionalFieldsPresent = 0;

            for (const key of MC_PFLICHT_COLS) {
                if (key === 'image_url') continue;
                const col = mcMapping[key];
                if (!col) continue;
                const val = String(row[col] ?? '').trim();
                if (!val) {
                    pflichtErrors.push({ row: rn, ean, field: key, type: 'missing' });
                    pflichtOk = false;
                    continue;
                }
                if (key === 'price') {
                    const n = parseFloat(val.replace(',', '.'));
                    if (Number.isNaN(n) || n <= 0) {
                        pflichtErrors.push({ row: rn, ean, field: key, type: 'invalid', value: val });
                        pflichtOk = false;
                    }
                }
                if (key === 'stock_amount' && !/^\d+$/.test(val)) {
                    pflichtErrors.push({ row: rn, ean, field: key, type: 'invalid', value: val });
                    pflichtOk = false;
                }
                if (key === 'shipping_mode' && val.toLowerCase() !== 'paket' && val.toLowerCase() !== 'spedition') {
                    pflichtErrors.push({ row: rn, ean, field: key, type: 'invalid', value: val });
                    pflichtOk = false;
                }
            }
            if (mcImageColumns.length > 0) {
                const imgCount = mcImageColumns.reduce((c, col) => c + (String(row[col] ?? '').trim() ? 1 : 0), 0);
                if (imgCount === 0) {
                    pflichtErrors.push({ row: rn, ean, field: 'image_url', type: 'missing' });
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
        // Stufe 1: live-fähig = no pflicht errors AND no EAN duplicate
        const livefaehigCount = rows.filter((_, i) => !pflichtErrorRowNums.has(i + 1) && !eanDupRows.has(i + 1)).length;

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
            dupNameEanCount,
            pflichtCategoryErrors,
            pflichtScore,
            optionalScore,
            optionalFillRatio,
            totalScore,
        };
    }, [rows, headers, mcMapping, mcImageColumns]);

    const mcIsWrongFile =
        rows.length > 0 && Object.values(mcMapping).filter(Boolean).length === 0 && mcImageColumns.length === 0;

    return (
        <div style={{ background: '#F3F4F6', minHeight: '100vh' }}>
            <header style={{ background: MC_BLUE, padding: '12px 24px', display: 'flex', alignItems: 'center' }}>
                <button
                    type="button"
                    onClick={() => { window.location.hash = "#/checker"; }}
                    style={{ border: "none", background: "transparent", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}
                    aria-label="Feed Checker Startseite"
                >
                    <span style={{ color: "#FFFFFF", fontWeight: 900, fontSize: 20, letterSpacing: "-0.5px", fontFamily: "ui-sans-serif, system-ui", fontStyle: "italic" }}>FEED CHECKER</span>
                    <span style={{ color: "#A8C4E0", fontSize: 10, fontWeight: 400, marginLeft: 6 }}>v1.0.1</span>
                </button>
            </header>
        <div style={{ maxWidth: 1500, margin: '0 auto', padding: '24px 48px' }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: '0 0 12px 0' }}>Ihr Angebotsfeed</h2>
            <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
                {/* ── LEFT: Upload & Settings ── */}
                <div style={{ flex: '0 1 50%', minWidth: 0, display: 'grid', gap: 12, alignContent: 'start' }}>
                    {/* Upload Method Toggle */}
                    <div
                        style={{
                            background: '#FFF',
                            borderRadius: 12,
                            padding: '16px 20px',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)',
                        }}
                    >
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 10 }}>
                            Datei hochladen
                        </div>
                        <div style={{ marginTop: 0 }}>
                            {file && (
                                <div
                                    style={{
                                        marginBottom: 8,
                                        padding: '6px 10px',
                                        borderRadius: 6,
                                        border: '1px solid #E5E7EB',
                                        background: '#F9FAFB',
                                        fontSize: 11,
                                        color: '#111827',
                                    }}
                                >
                                    {file.name} | {(file.size / 1024).toFixed(1)} KB
                                </div>
                            )}
                            <div
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    setDragging(true);
                                }}
                                onDragLeave={() => setDragging(false)}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    setDragging(false);
                                    const f = e.dataTransfer.files?.[0];
                                    if (f) parseFile(f);
                                }}
                                onClick={() => fileRef.current?.click()}
                                style={{
                                    background: dragging ? '#EEF4FF' : '#F9FAFB',
                                    border: `2px dashed ${dragging ? MC_BLUE : '#D1D5DB'}`,
                                    borderRadius: 8,
                                    padding: '20px 16px',
                                    textAlign: 'center',
                                    cursor: 'pointer',
                                }}
                            >
                                <div style={{ fontSize: 12, fontWeight: 600, color: '#111827', marginBottom: 2 }}>
                                    Datei hierher ziehen oder anklicken
                                </div>
                                <div style={{ fontSize: 10, color: '#6B7280' }}>CSV, max. 64 MB</div>
                                <input
                                    ref={fileRef}
                                    type="file"
                                    accept=".csv,text/csv"
                                    style={{ display: 'none' }}
                                    onChange={(e) => parseFile(e.target.files?.[0] || null)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Workflow hint */}
                    {issues && (
                        <div
                            style={{
                                background: '#EEF4FF',
                                borderLeft: `3px solid ${MC_BLUE}`,
                                borderRadius: 6,
                                padding: '10px 14px',
                            }}
                        >
                            <div style={{ fontSize: 12, fontWeight: 600, color: MC_BLUE, marginBottom: 4 }}>
                                So verbessern Sie Ihren Feed
                            </div>
                            <div style={{ fontSize: 11, color: '#374151', lineHeight: '17px' }}>
                                1. Fehlerliste herunterladen
                                <br />
                                2. Fehler in Ihrer Datei korrigieren
                                <br />
                                3. Korrigierte Datei neu hochladen
                                <br />
                                4. Erneut prüfen lassen
                            </div>
                        </div>
                    )}


                    {/* Spalten-Zuordnung */}
                    {issues &&
                        !mcIsWrongFile &&
                        (() => {
                            const LEFT_FL = {
                                name: 'Artikelname',
                                description: 'Beschreibung',
                                brand: 'Marke',
                                category_path: 'Kategoriepfad',
                                seller_offer_id: 'Eigene Artikel-ID',
                                ean: 'EAN (GTIN14)',
                                price: 'Preis',
                                availability: 'Verfügbarkeit',
                                stock_amount: 'Bestand',
                                delivery_time: 'Lieferzeit',
                                delivery_includes: 'Lieferumfang',
                                shipping_mode: 'Versandart',
                                image_url: 'Hauptbild',
                                color: 'Farbe',
                                material: 'Material',
                                size: 'Maße (Gesamt)',
                                size_height: 'Höhe',
                                size_depth: 'Tiefe',
                                size_diameter: 'Durchmesser',
                                manufacturer_name: 'Herstellername',
                                manufacturer_street: 'Herstellerstraße',
                                manufacturer_postcode: 'Herstellerpostleitzahl',
                                manufacturer_city: 'Herstellerstadt',
                                manufacturer_country: 'Herstellerland',
                                manufacturer_email: 'Hersteller-E-Mail',
                                deeplink: 'Deeplink',
                                model: 'Modellbezeichnung',
                                size_lying_surface: 'Liegefläche',
                                size_seat_height: 'Sitzhöhe',
                                ausrichtung: 'Ausrichtung',
                                style: 'Stil',
                                temper: 'Härtegrad',
                                weight: 'Gewicht',
                                weight_capacity: 'Belastbarkeit',
                                youtube_link: 'Youtube-Video',
                                bild_3d_glb: '3D-Ansicht (GLB)',
                                bild_3d_usdz: '3D-Ansicht (USDZ)',
                                assembly_instructions: 'Montageanleitung',
                                illuminant_included: 'Leuchtmittel inklusive',
                                incl_mattress: 'Matratze inklusive',
                                incl_slatted_frame: 'Lattenrost inklusive',
                                led_verbaut: 'LED verbaut',
                                lighting_included: 'Beleuchtung inklusive',
                                set_includes: 'Set-Inhalt',
                                socket: 'Steckdose/Anschluss',
                                care_instructions: 'Pflegehinweise',
                                filling: 'Füllung',
                                removable_cover: 'Bezug abnehmbar',
                                suitable_for_allergic: 'Allergikergeeignet',
                                energy_efficiency_category: 'Energieeffizienzklasse',
                                product_data_sheet: 'Produktdatenblatt',
                                manufacturer_phone_number: 'Herstellertelefonnummer',
                            };
                            const allMcFields = [
                                ...MC_PFLICHT_COLS.filter((f) => f !== 'image_url'),
                                ...MC_OPTIONAL_COLS,
                            ];
                            const totalFields = allMcFields.length + 1;
                            const foundFields =
                                allMcFields.filter((f) => mcMapping[f]).length + (mcImageColumns.length > 0 ? 1 : 0);
                            const hasMissing = issues.missingPflichtCols.length > 0;
                            return (
                                <details
                                    style={{ background: '#FFF', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)' }}
                                    open={mappingExpanded}
                                    onToggle={(e) => setMappingExpanded(e.currentTarget.open)}
                                >
                                    <summary
                                        style={{
                                            padding: '12px 16px',
                                            cursor: 'pointer',
                                            fontSize: 13,
                                            fontWeight: 600,
                                            color: '#111827',
                                        }}
                                    >
                                        Spalten-Zuordnung{' '}
                                        <span style={{ color: '#6B7280', fontWeight: 400, fontSize: 11 }}>
                                            ({foundFields}/{totalFields} erkannt)
                                        </span>
                                        {hasMissing && (
                                            <span
                                                style={{
                                                    marginLeft: 8,
                                                    fontSize: 10,
                                                    color: '#B91C1C',
                                                    fontWeight: 700,
                                                }}
                                            >
                                                · {issues.missingPflichtCols.length} Pflichtspalten fehlen
                                            </span>
                                        )}
                                    </summary>
                                    <div style={{ padding: '0 16px 16px', display: 'grid', gap: 4 }}>
                                        {/* Hauptbild-Zuordnung (separat, nicht konfigurierbar – kommt aus Spaltenerkennung) */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <span style={{ fontSize: 10, color: '#374151', width: 150, flexShrink: 0 }}>
                                                Hauptbild (+ Zusatzb.)
                                            </span>
                                            <div
                                                style={{
                                                    flex: 1,
                                                    fontSize: 10,
                                                    padding: '4px 8px',
                                                    borderRadius: 5,
                                                    border: `1px solid ${mcImageColumns.length > 0 ? '#D1D5DB' : '#FCA5A5'}`,
                                                    background: '#F9FAFB',
                                                    color: mcImageColumns.length > 0 ? '#166534' : '#DC2626',
                                                    fontWeight: 600,
                                                }}
                                            >
                                                {mcImageColumns.length > 0 ? mcImageColumns.join(', ') : '–'}
                                            </div>
                                        </div>
                                        {(() => {
                                            const manufacturerPflichtEnd = allMcFields.indexOf('manufacturer_email');
                                            const displayFields = [
                                                ...allMcFields.slice(0, manufacturerPflichtEnd + 1),
                                                'manufacturer_phone_number',
                                                ...allMcFields.filter(
                                                    (f) =>
                                                        f !== 'manufacturer_phone_number' &&
                                                        allMcFields.indexOf(f) > manufacturerPflichtEnd,
                                                ),
                                            ].filter((f) => mcMapping[f] || MC_PFLICHT_COLS.includes(f));
                                            const hiddenCount = allMcFields.filter(
                                                (f) =>
                                                    !mcMapping[f] &&
                                                    !MC_PFLICHT_COLS.includes(f) &&
                                                    f !== 'manufacturer_phone_number',
                                            ).length;
                                            return (
                                                <>
                                                    {displayFields.map((f) => {
                                                        const isManual = f in manualMapping;
                                                        const col = mcMapping[f];
                                                        const isPflicht = MC_PFLICHT_COLS.includes(f);
                                                        const missing = !col && isPflicht;
                                                        return (
                                                            <div
                                                                key={f}
                                                                style={{
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: 6,
                                                                }}
                                                            >
                                                                <span
                                                                    style={{
                                                                        fontSize: 10,
                                                                        color: '#374151',
                                                                        width: 150,
                                                                        flexShrink: 0,
                                                                    }}
                                                                >
                                                                    {LEFT_FL[f] || f}
                                                                    {isPflicht && (
                                                                        <span
                                                                            style={{ color: '#DC2626', marginLeft: 2 }}
                                                                        >
                                                                            *
                                                                        </span>
                                                                    )}
                                                                </span>
                                                                <select
                                                                    value={col || ''}
                                                                    onChange={(e) => {
                                                                        const val = e.target.value;
                                                                        setManualMapping((prev) => {
                                                                            const next = { ...prev };
                                                                            if (val === '') delete next[f];
                                                                            else next[f] = val;
                                                                            return next;
                                                                        });
                                                                    }}
                                                                    style={{
                                                                        flex: 1,
                                                                        fontSize: 10,
                                                                        padding: '3px 6px',
                                                                        borderRadius: 5,
                                                                        border: `1px solid ${missing ? '#FCA5A5' : '#D1D5DB'}`,
                                                                        background: '#FFF',
                                                                        cursor: 'pointer',
                                                                    }}
                                                                >
                                                                    <option value="">-- Nicht zugeordnet --</option>
                                                                    {headers.map((h) => (
                                                                        <option
                                                                            key={h}
                                                                            value={h}
                                                                        >
                                                                            {h}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                                {isManual && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            setManualMapping((prev) => {
                                                                                const next = { ...prev };
                                                                                delete next[f];
                                                                                return next;
                                                                            })
                                                                        }
                                                                        style={{
                                                                            fontSize: 10,
                                                                            padding: '2px 6px',
                                                                            borderRadius: 4,
                                                                            border: '1px solid #C4B5FD',
                                                                            background: '#FFF',
                                                                            color: '#7C3AED',
                                                                            cursor: 'pointer',
                                                                        }}
                                                                    >
                                                                        ↩
                                                                    </button>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                    {hiddenCount > 0 && (
                                                        <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 4 }}>
                                                            {hiddenCount} weitere optionale Felder nicht im Feed
                                                        </div>
                                                    )}
                                                </>
                                            );
                                        })()}
                                    </div>
                                </details>
                            );
                        })()}

                    {/* Content Tips */}
                    <details style={{ background: '#FFF', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)' }}>
                        <summary
                            style={{
                                padding: '12px 16px',
                                cursor: 'pointer',
                                fontSize: 13,
                                fontWeight: 600,
                                color: '#111827',
                            }}
                        >
                            Tipps für besseren Content
                        </summary>
                        <div style={{ padding: '0 16px 16px', display: 'grid', gap: 8 }}>
                            {[
                                {
                                    title: 'Produkttitel',
                                    desc: 'Mind. 40 Zeichen. Aufbau: Marke + Produkttyp + wichtigstes Merkmal (z. B. Farbe, Material, Größe). Keine Sonderzeichen oder Werbebegriffe.',
                                },
                                {
                                    title: 'Beschreibung',
                                    desc: 'Mind. 80 Zeichen. Vorteile, Material, Einsatzbereich, Maße. Keine externen Links, keine HTML-Tags, keine Wiederholung des Titels.',
                                },
                                {
                                    title: 'Bilder',
                                    desc: 'Mind. 3 Bilder pro Produkt. Erstes Bild als Freisteller auf weißem Hintergrund, weitere als Milieu- oder Detailbilder. Mind. 800×800 px.',
                                },
                                {
                                    title: 'Kategoriepfad',
                                    desc: 'Vollständig und korrekt befüllen – beeinflusst direkt die Sichtbarkeit. Format: Oberkategorie > Unterkategorie > Produkttyp.',
                                },
                                {
                                    title: 'Lieferumfang',
                                    desc: 'Klar und vollständig: z. B. „1x Tisch, 4x Stühle". Versandart (Paket / Spedition) immer angeben.',
                                },
                                {
                                    title: 'Preis & Verfügbarkeit',
                                    desc: 'Preise täglich aktuell halten. Ausverkaufte Produkte deaktivieren statt mit falscher Verfügbarkeit senden.',
                                },
                            ].map((t) => (
                                <div
                                    key={t.title}
                                    style={{ padding: '6px 0', borderBottom: '1px solid #F3F4F6' }}
                                >
                                    <div style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{t.title}</div>
                                    <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{t.desc}</div>
                                </div>
                            ))}
                        </div>
                    </details>

                    {/* Downloads */}
                    <div style={{ background: '#FFF', borderRadius: 12, padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <button
                            type="button"
                            onClick={() => {
                                const a = document.createElement('a');
                                a.href = 'http://media-partner.moebel.check24.de/feedvorlagen/Feedleitfaden_Anhang_2026/CHECK24_Feedvorlage_V2025.xlsx';
                                a.download = 'CHECK24_Feedvorlage_V2025.xlsx';
                                a.click();
                            }}
                            style={{
                                padding: '10px 12px',
                                borderRadius: 6,
                                border: '1px solid #E5E7EB',
                                background: '#F9FAFB',
                                cursor: 'pointer',
                                textAlign: 'left',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                            }}
                        >
                            <span style={{ fontSize: 16, flexShrink: 0 }}>⬇</span>
                            <div>
                                <div style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>Feedvorlage</div>
                                <div style={{ fontSize: 10, color: '#6B7280', marginTop: 1 }}>XLSX · sofort herunterladen</div>
                            </div>
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                const a = document.createElement('a');
                                a.href = 'https://w9cedwr8emsi29qt.public.blob.vercel-storage.com/CHECK24_Feedleitfaden_V2026.pdf';
                                a.download = 'CHECK24_Feedleitfaden_V2026.pdf';
                                a.click();
                            }}
                            style={{
                                padding: '10px 12px',
                                borderRadius: 6,
                                border: '1px solid #E5E7EB',
                                background: '#F9FAFB',
                                cursor: 'pointer',
                                textAlign: 'left',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                            }}
                        >
                            <span style={{ fontSize: 16, flexShrink: 0 }}>⬇</span>
                            <div>
                                <div style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>Feedleitfaden</div>
                                <div style={{ fontSize: 10, color: '#6B7280', marginTop: 1 }}>PDF · sofort herunterladen</div>
                            </div>
                        </button>
                    </div>
                    </div>
                </div>

                {/* ── RIGHT: Analysis Results ── */}
                {mcIsWrongFile && (
                    <div
                        style={{
                            flex: '0 1 50%',
                            minWidth: 0,
                            alignSelf: 'start',
                            padding: '16px 18px',
                            borderRadius: 10,
                            border: '1px solid #FECACA',
                            background: '#FEF2F2',
                            display: 'flex',
                            gap: 12,
                            alignItems: 'flex-start',
                        }}
                    >
                        <span style={{ fontSize: 22, flexShrink: 0 }}>⚠️</span>
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#B91C1C', marginBottom: 4 }}>
                                Diese Datei sieht nicht wie ein gültiger Produkt-Feed aus.
                            </div>
                            <div style={{ fontSize: 11, color: '#7F1D1D', lineHeight: '1.6' }}>
                                Es konnten keine bekannten Spalten erkannt werden. Bitte laden Sie eine andere Datei
                                hoch. Erwartete Spalten sind z.&nbsp;B. <code>ean</code>, <code>name</code>,{' '}
                                <code>price</code>, <code>shipping_mode</code> o.&nbsp;ä.
                            </div>
                        </div>
                    </div>
                )}
                {issues &&
                    !mcIsWrongFile &&
                    (() => {
                        // ── Gesamt-Pass/Fail-Logik ──
                        // Technische Prüfung bestanden = Fehlerquote ≤ 5% (gleicher Schwellwert wie APA)
                        const errorRate = issues.totalRows > 0 ? (issues.blockiertCount / issues.totalRows) * 100 : 0;
                        const stufe1Passed = errorRate <= 5;
                        const score = issues.totalScore;
                        const campaignEligible = stufe1Passed && score >= 70;
                        const fillPct = Math.round(issues.optionalFillRatio * 100);

                        // Deutsche Feld-Labels (sortiert nach Wichtigkeit)
                        const FL = {
                            name: 'Artikelname',
                            description: 'Beschreibung',
                            brand: 'Marke',
                            category_path: 'Kategoriepfad',
                            seller_offer_id: 'Eigene Artikel-ID',
                            ean: 'EAN (GTIN14)',
                            price: 'Preis',
                            availability: 'Verfügbarkeit',
                            stock_amount: 'Bestand',
                            delivery_time: 'Lieferzeit',
                            delivery_includes: 'Lieferumfang',
                            shipping_mode: 'Versandart',
                            image_url: 'Hauptbild',
                            color: 'Farbe',
                            material: 'Material',
                            size: 'Maße (Gesamt)',
                            size_height: 'Höhe',
                            size_depth: 'Tiefe',
                            size_diameter: 'Durchmesser',
                            manufacturer_name: 'Herstellername',
                            manufacturer_street: 'Herstellerstraße',
                            manufacturer_postcode: 'Herstellerpostleitzahl',
                            manufacturer_city: 'Herstellerstadt',
                            manufacturer_country: 'Herstellerland',
                            manufacturer_email: 'Hersteller-E-Mail',
                        };

                        // Top-Fehlergruppen berechnen (für Fehlerfall oben im Pflichtattribute-Block)
                        const rowsByGroup = {
                            desc: new Set(),
                            size: new Set(),
                            mfr: new Set(),
                            img: new Set(),
                            price: new Set(),
                            ids: new Set(),
                        };
                        issues.pflichtErrors.forEach((e) => {
                            if (e.field === 'description') rowsByGroup.desc.add(e.row);
                            else if (['size', 'size_height', 'size_depth', 'size_diameter'].includes(e.field))
                                rowsByGroup.size.add(e.row);
                            else if (e.field.startsWith('manufacturer_')) rowsByGroup.mfr.add(e.row);
                            else if (e.field === 'image_url') rowsByGroup.img.add(e.row);
                            else if (
                                [
                                    'price',
                                    'availability',
                                    'stock_amount',
                                    'delivery_time',
                                    'delivery_includes',
                                    'shipping_mode',
                                ].includes(e.field)
                            )
                                rowsByGroup.price.add(e.row);
                            else if (['name', 'brand', 'category_path', 'seller_offer_id', 'ean'].includes(e.field))
                                rowsByGroup.ids.add(e.row);
                        });
                        const topGroups = [
                            {
                                key: 'desc',
                                label: 'Beschreibung',
                                hint: 'Fehlt oder leer',
                                count: rowsByGroup.desc.size,
                            },
                            {
                                key: 'size',
                                label: 'Maße / Höhe / Tiefe',
                                hint: 'Unvollständig',
                                count: rowsByGroup.size.size,
                            },
                            {
                                key: 'mfr',
                                label: 'Herstellerangaben',
                                hint: 'Name, Adresse oder E-Mail fehlt',
                                count: rowsByGroup.mfr.size,
                            },
                            {
                                key: 'img',
                                label: 'Hauptbild',
                                hint: 'Fehlt oder nicht erreichbar',
                                count: rowsByGroup.img.size,
                            },
                            {
                                key: 'price',
                                label: 'Preis & Verfügbarkeit',
                                hint: 'Unvollständig',
                                count: rowsByGroup.price.size,
                            },
                            {
                                key: 'ids',
                                label: 'Identifikation',
                                hint: 'Name, Marke oder EAN fehlen',
                                count: rowsByGroup.ids.size,
                            },
                        ]
                            .filter((g) => g.count > 0)
                            .sort((a, b) => b.count - a.count)
                            .slice(0, 3);

                        return (
                            <div
                                style={{
                                    flex: '0 1 50%',
                                    minWidth: 0,
                                    display: 'grid',
                                    gap: 12,
                                    alignContent: 'start',
                                }}
                            >
                                {/* ── STUFE 1 – TECHNISCHE PRÜFUNG ── */}
                                <div
                                    style={{
                                        background: '#FFF',
                                        border: '1px solid #E5E7EB',
                                        borderRadius: 8,
                                        overflow: 'hidden',
                                    }}
                                >
                                    {/* Partner-Status-Banner (eigener innerer Kasten) */}
                                    <div
                                        style={{
                                            margin: '12px 18px 0',
                                            padding: '8px 12px',
                                            borderRadius: 6,
                                            border: `1px solid ${stufe1Passed ? '#BBF7D0' : '#FECACA'}`,
                                            background: stufe1Passed ? '#F0FDF4' : '#FEF2F2',
                                            display: 'flex',
                                            gap: 10,
                                            alignItems: 'flex-start',
                                        }}
                                    >
                                        <div style={{ fontSize: 12, color: '#111827', lineHeight: '1.5' }}>
                                            <strong style={{ color: stufe1Passed ? '#166534' : '#991B1B' }}>
                                                {stufe1Passed
                                                    ? 'Account freigeschaltet.'
                                                    : 'Account nicht aktivierbar.'}
                                            </strong>{' '}
                                            {stufe1Passed
                                                ? 'Die technische Prüfung wurde bestanden. Ihre Artikel werden angelegt.'
                                                : 'Bitte beheben Sie die Fehler und laden Sie den Feed erneut hoch.'}
                                        </div>
                                    </div>

                                    {/* Sektion-Label + Status-Pille */}
                                    <div
                                        style={{
                                            padding: '14px 18px 8px',
                                            display: 'flex',
                                            gap: 10,
                                            alignItems: 'center',
                                        }}
                                    >
                                        <div
                                            style={{
                                                fontSize: 10,
                                                fontWeight: 700,
                                                color: MC_BLUE,
                                                letterSpacing: '0.06em',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 10,
                                                flex: 1,
                                                minWidth: 0,
                                            }}
                                        >
                                            <span style={{ whiteSpace: 'nowrap' }}>TECHNISCHE PRÜFUNG</span>
                                            <span style={{ flex: 1, height: 1, background: '#E5E7EB' }} />
                                        </div>
                                        {stufe1Passed ? (
                                            <span
                                                style={{
                                                    fontSize: 11,
                                                    fontWeight: 700,
                                                    padding: '3px 10px',
                                                    borderRadius: 4,
                                                    background: '#DCFCE7',
                                                    color: '#16A34A',
                                                    whiteSpace: 'nowrap',
                                                }}
                                            >
                                                ✓ Bestanden
                                            </span>
                                        ) : (
                                            <span
                                                style={{
                                                    fontSize: 11,
                                                    fontWeight: 700,
                                                    padding: '3px 10px',
                                                    borderRadius: 4,
                                                    background: '#FEE2E2',
                                                    color: '#DC2626',
                                                    whiteSpace: 'nowrap',
                                                }}
                                            >
                                                ✗ Nicht bestanden
                                            </span>
                                        )}
                                    </div>

                                    {/* Titel */}
                                    <div style={{ padding: '0 18px 14px' }}>
                                        <div style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>
                                            Datenvalidierung
                                        </div>
                                    </div>

                                    {/* Pflichtattribute-Block */}
                                    <div
                                        style={{
                                            margin: '0 18px 14px',
                                            borderRadius: 8,
                                            borderLeft: `4px solid ${stufe1Passed ? '#16A34A' : '#DC2626'}`,
                                            background: stufe1Passed ? '#F0FDF4' : '#FEF2F2',
                                            padding: '10px 14px',
                                        }}
                                    >
                                        <div
                                            style={{ fontSize: 12, fontWeight: 700, color: '#111827', marginBottom: 4 }}
                                        >
                                            Pflichtattribute (25 Attribute)
                                        </div>

                                        {/* Top 3 Fehlergruppen – nur wenn nicht bestanden */}
                                        {!stufe1Passed && topGroups.length > 0 && (
                                            <div style={{ display: 'grid', gap: 5, marginBottom: 8 }}>
                                                {topGroups.map((g) => (
                                                    <div
                                                        key={g.key}
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: 8,
                                                            fontSize: 11,
                                                            color: '#374151',
                                                        }}
                                                    >
                                                        <span
                                                            style={{
                                                                width: 44,
                                                                padding: '2px 0',
                                                                borderRadius: 4,
                                                                background: '#DC2626',
                                                                color: '#FFF',
                                                                fontWeight: 700,
                                                                textAlign: 'center',
                                                                fontSize: 10,
                                                                flexShrink: 0,
                                                            }}
                                                        >
                                                            {g.count}
                                                        </span>
                                                        <span style={{ fontWeight: 700, color: '#111827' }}>
                                                            {g.label}
                                                        </span>
                                                        <span style={{ color: '#6B7280', fontStyle: 'italic' }}>
                                                            — {g.hint}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {issues.blockiertCount > 0 && (
                                            <div
                                                style={{
                                                    fontSize: 11,
                                                    color: '#374151',
                                                    marginBottom: 8,
                                                    fontStyle: 'italic',
                                                }}
                                            >
                                                {issues.blockiertCount.toLocaleString('de-DE')} Artikel mit fehlenden
                                                Pflichtfeldern werden nicht gelistet.
                                            </div>
                                        )}

                                        {/* Pflichtattribute-Dropdown mit allen 25 Feldnamen */}
                                        <details style={{ marginTop: 4 }}>
                                            <summary
                                                style={{
                                                    cursor: 'pointer',
                                                    fontSize: 11,
                                                    color: '#4B5563',
                                                    fontWeight: 600,
                                                    userSelect: 'none',
                                                }}
                                            >
                                                Pflichtattribute anzeigen
                                            </summary>
                                            <div
                                                style={{
                                                    marginTop: 6,
                                                    fontSize: 10,
                                                    color: '#9CA3AF',
                                                    lineHeight: '1.6',
                                                    overflowWrap: 'anywhere',
                                                    wordBreak: 'break-word',
                                                }}
                                            >
                                                {MC_PFLICHT_COLS.map((f, i) => (
                                                    <React.Fragment key={f}>
                                                        {i > 0 && <span style={{ margin: '0 4px' }}>·</span>}
                                                        {FL[f]}
                                                    </React.Fragment>
                                                ))}
                                            </div>
                                        </details>
                                    </div>

                                    {/* Stats: Vollständig | Unvollständig | Gesamt (kompakt, mit Tooltips) */}
                                    <div
                                        style={{
                                            display: 'grid',
                                            gridTemplateColumns: '1fr 1fr 1fr',
                                            gap: 6,
                                            padding: '0 18px 10px',
                                        }}
                                    >
                                        {[
                                            {
                                                val: issues.pflichtOkCount,
                                                label: 'Vollständig',
                                                color: '#16A34A',
                                                tip: 'Artikel, bei denen alle 25 Pflichtattribute befüllt und gültig sind. Diese Artikel werden bei CHECK24 angelegt.',
                                            },
                                            {
                                                val: issues.blockiertCount,
                                                label: 'Unvollständig',
                                                color: '#DC2626',
                                                tip: 'Artikel mit mindestens einem fehlenden oder ungültigen Pflichtattribut. Diese Artikel werden nicht gelistet, bis die Fehler behoben sind.',
                                            },
                                            {
                                                val: issues.totalRows,
                                                label: 'Gesamt',
                                                color: '#111827',
                                                tip: 'Gesamtzahl der Artikel in Ihrem hochgeladenen Feed.',
                                            },
                                        ].map(({ val, label, color, tip }) => (
                                            <div
                                                key={label}
                                                style={{
                                                    padding: '6px 4px',
                                                    borderRadius: 5,
                                                    border: '1px solid #E5E7EB',
                                                    background: '#FFF',
                                                    textAlign: 'center',
                                                }}
                                            >
                                                <div style={{ fontSize: 20, fontWeight: 700, color }}>
                                                    {val.toLocaleString('de-DE')}
                                                </div>
                                                <Tooltip text={tip}>
                                                    <div
                                                        style={{
                                                            fontSize: 10,
                                                            color: '#6B7280',
                                                            marginTop: 2,
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: 3,
                                                            cursor: 'help',
                                                        }}
                                                    >
                                                        {label}
                                                        <svg
                                                            width="11"
                                                            height="11"
                                                            viewBox="0 0 16 16"
                                                            fill="none"
                                                            stroke="#9CA3AF"
                                                            strokeWidth="1.5"
                                                        >
                                                            <circle
                                                                cx="8"
                                                                cy="8"
                                                                r="7"
                                                            />
                                                            <line
                                                                x1="8"
                                                                y1="5"
                                                                x2="8"
                                                                y2="8"
                                                            />
                                                            <circle
                                                                cx="8"
                                                                cy="11"
                                                                r=".6"
                                                                fill="#9CA3AF"
                                                            />
                                                        </svg>
                                                    </div>
                                                </Tooltip>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* ── CSV DOWNLOAD (highlighted primary action) ── */}
                                <div
                                    style={{
                                        padding: '14px 16px',
                                        borderRadius: 10,
                                        border: `2px solid ${MC_BLUE}`,
                                        background: '#EEF4FF',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 12,
                                        boxShadow: '0 2px 8px rgba(21, 83, 182, 0.12)',
                                    }}
                                >
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>
                                            Fehlerbericht herunterladen
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const pflichtByRow = {};
                                            const optionalByRow = {};
                                            issues.pflichtErrors.forEach((e) => {
                                                if (!pflichtByRow[e.row]) pflichtByRow[e.row] = [];
                                                pflichtByRow[e.row].push(
                                                    e.field + (e.type === 'invalid' ? ` ungültig` : ' fehlt'),
                                                );
                                            });
                                            issues.optionalHints.forEach((e) => {
                                                if (!optionalByRow[e.row]) optionalByRow[e.row] = [];
                                                optionalByRow[e.row].push(`${e.field} fehlt`);
                                            });
                                            const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
                                            const sep = ';';
                                            const headerRow = [
                                                'Fehler Pflichtfelder',
                                                'Fehler Optionale Felder',
                                                ...headers,
                                            ]
                                                .map(esc)
                                                .join(sep);
                                            const lines = rows.map((r, i) => {
                                                const rn = i + 1;
                                                const p = pflichtByRow[rn]
                                                    ? [...new Set(pflichtByRow[rn])].join('; ')
                                                    : '';
                                                const o = optionalByRow[rn]
                                                    ? [...new Set(optionalByRow[rn])].join('; ')
                                                    : '';
                                                return [esc(p), esc(o), ...headers.map((h) => esc(r[h]))].join(sep);
                                            });
                                            const csv = [headerRow, ...lines].join('\n');
                                            const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
                                            const url = URL.createObjectURL(blob);
                                            const a = document.createElement('a');
                                            a.href = url;
                                            a.download = `feed-fehlerliste-${new Date().toISOString().slice(0, 10)}.csv`;
                                            a.click();
                                            URL.revokeObjectURL(url);
                                        }}
                                        style={{
                                            padding: '10px 18px',
                                            borderRadius: 6,
                                            border: 'none',
                                            background: MC_BLUE,
                                            color: '#FFF',
                                            fontSize: 13,
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                            whiteSpace: 'nowrap',
                                            flexShrink: 0,
                                        }}
                                    >
                                        CSV herunterladen
                                    </button>
                                </div>

                                {/* ── STUFE 2 – FEED-QUALITÄTSSCORE (Soft Score) — hidden until public release ── */}
                                {showQualityScore && (
                                    <div
                                        style={{
                                            background: '#FFF',
                                            border: '1px solid #E5E7EB',
                                            borderRadius: 8,
                                            overflow: 'hidden',
                                            position: 'relative',
                                        }}
                                    >
                                        <div style={{ opacity: stufe1Passed ? 1 : 0.55 }}>
                                            {/* Sektion-Label */}
                                            <div
                                                style={{
                                                    padding: '14px 18px 8px',
                                                    display: 'flex',
                                                    gap: 10,
                                                    alignItems: 'center',
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        fontSize: 10,
                                                        fontWeight: 700,
                                                        color: MC_BLUE,
                                                        letterSpacing: '0.06em',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 10,
                                                        flex: 1,
                                                        minWidth: 0,
                                                    }}
                                                >
                                                    <span style={{ whiteSpace: 'nowrap' }}>
                                                        STUFE 2 — FEED-QUALITÄTSSCORE
                                                    </span>
                                                    <span style={{ flex: 1, height: 1, background: '#E5E7EB' }} />
                                                </div>
                                                {score >= 70 ? (
                                                    <span
                                                        style={{
                                                            fontSize: 11,
                                                            fontWeight: 700,
                                                            padding: '3px 10px',
                                                            borderRadius: 4,
                                                            background: '#DCFCE7',
                                                            color: '#16A34A',
                                                            whiteSpace: 'nowrap',
                                                        }}
                                                    >
                                                        ✓ Zielwert erreicht
                                                    </span>
                                                ) : (
                                                    <span
                                                        style={{
                                                            fontSize: 11,
                                                            fontWeight: 700,
                                                            padding: '3px 10px',
                                                            borderRadius: 4,
                                                            background: '#FEE2E2',
                                                            color: '#DC2626',
                                                            whiteSpace: 'nowrap',
                                                        }}
                                                    >
                                                        ✗ Zielwert nicht erreicht
                                                    </span>
                                                )}
                                            </div>

                                            {/* Score */}
                                            <div
                                                style={{
                                                    padding: '0 18px 10px',
                                                    display: 'flex',
                                                    justifyContent: 'flex-start',
                                                    alignItems: 'flex-end',
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        fontSize: 20,
                                                        fontWeight: 800,
                                                        color: campaignEligible ? '#16A34A' : '#111827',
                                                        lineHeight: 1,
                                                    }}
                                                >
                                                    {score}
                                                    <span style={{ fontWeight: 600, color: '#9CA3AF' }}>/100</span>
                                                </div>
                                            </div>

                                            {/* Fortschrittsbalken mit 70-Marker */}
                                            <div style={{ padding: '0 18px 4px' }}>
                                                <div style={{ position: 'relative', paddingTop: 34 }}>
                                                    {/* 70-Marker Pille */}
                                                    <div
                                                        style={{
                                                            position: 'absolute',
                                                            top: 0,
                                                            left: '70%',
                                                            transform: 'translateX(-50%)',
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            alignItems: 'center',
                                                        }}
                                                    >
                                                        <div
                                                            style={{
                                                                fontSize: 8,
                                                                fontWeight: 700,
                                                                color: campaignEligible ? '#166534' : '#4B5563',
                                                                whiteSpace: 'nowrap',
                                                                padding: '1px 5px',
                                                                borderRadius: 3,
                                                                background: campaignEligible ? '#DCFCE7' : '#F3F4F6',
                                                                border: `1px solid ${campaignEligible ? '#86EFAC' : '#E5E7EB'}`,
                                                            }}
                                                        >
                                                            Zielwert erreicht
                                                        </div>
                                                        <div
                                                            style={{
                                                                width: 1,
                                                                height: 14,
                                                                background: campaignEligible ? '#16A34A' : '#9CA3AF',
                                                            }}
                                                        />
                                                    </div>
                                                    {/* Balken */}
                                                    <div
                                                        style={{
                                                            height: 16,
                                                            borderRadius: 8,
                                                            background: '#E5E7EB',
                                                            overflow: 'hidden',
                                                        }}
                                                    >
                                                        <div
                                                            style={{
                                                                height: '100%',
                                                                width: `${score}%`,
                                                                background: campaignEligible
                                                                    ? '#16A34A'
                                                                    : score >= 50
                                                                      ? '#D97706'
                                                                      : '#DC2626',
                                                                transition: 'width 0.4s',
                                                            }}
                                                        />
                                                    </div>
                                                    {/* Notch an 70% */}
                                                    <div
                                                        style={{
                                                            position: 'absolute',
                                                            top: 34,
                                                            left: '70%',
                                                            transform: 'translateX(-50%)',
                                                            width: 2,
                                                            height: 16,
                                                            background: campaignEligible ? '#16A34A' : '#6B7280',
                                                            pointerEvents: 'none',
                                                        }}
                                                    />
                                                    <div
                                                        style={{
                                                            display: 'flex',
                                                            fontSize: 9,
                                                            color: '#9CA3AF',
                                                            marginTop: 3,
                                                            position: 'relative',
                                                        }}
                                                    >
                                                        <span>0</span>
                                                        <span
                                                            style={{
                                                                position: 'absolute',
                                                                left: '50%',
                                                                transform: 'translateX(-50%)',
                                                            }}
                                                        >
                                                            50
                                                        </span>
                                                        <span
                                                            style={{
                                                                position: 'absolute',
                                                                left: '70%',
                                                                transform: 'translateX(-50%)',
                                                                color: campaignEligible ? '#16A34A' : '#4B5563',
                                                                fontWeight: 700,
                                                            }}
                                                        >
                                                            70
                                                        </span>
                                                        <span style={{ marginLeft: 'auto' }}>100</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Scoring-Logik – als Dropdown, geschlossen (direkt unter Progress-Bar) */}
                                            <details style={{ padding: '0 18px', marginTop: 8 }}>
                                                <summary
                                                    style={{
                                                        cursor: 'pointer',
                                                        fontSize: 11,
                                                        color: '#4B5563',
                                                        fontWeight: 600,
                                                        userSelect: 'none',
                                                        padding: '6px 0',
                                                    }}
                                                >
                                                    Scoring-Logik anzeigen
                                                </summary>

                                                <div
                                                    style={{
                                                        marginTop: 4,
                                                        padding: '7px 12px',
                                                        borderRadius: 6,
                                                        background: '#F9FAFB',
                                                        border: '1px solid #E5E7EB',
                                                        fontSize: 11,
                                                        fontFamily: 'monospace',
                                                        color: '#374151',
                                                        marginBottom: 10,
                                                    }}
                                                >
                                                    Score = Pflichtfelder-Score + Empfohlene-Felder-Score
                                                </div>

                                                {/* Pflichtfelder-Score */}
                                                <div
                                                    style={{
                                                        padding: '10px 12px',
                                                        borderRadius: 6,
                                                        borderLeft: '3px solid #3B82F6',
                                                        background: '#EFF6FF',
                                                        marginBottom: 8,
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            fontSize: 12,
                                                            fontWeight: 700,
                                                            color: '#111827',
                                                            marginBottom: 4,
                                                        }}
                                                    >
                                                        Pflichtfelder-Score (max. 70 Pkt.)
                                                    </div>
                                                    <div style={{ fontSize: 11, color: '#374151', marginBottom: 4 }}>
                                                        {issues.pflichtOkCount.toLocaleString('de-DE')} von{' '}
                                                        {issues.totalRows.toLocaleString('de-DE')} Artikeln mit
                                                        vollständigen Pflichtattributen.
                                                    </div>
                                                    <div style={{ fontSize: 11, color: '#111827', fontWeight: 600 }}>
                                                        →{' '}
                                                        <strong>
                                                            {issues.pflichtOkCount.toLocaleString('de-DE')}/
                                                            {issues.totalRows.toLocaleString('de-DE')} × 70 ={' '}
                                                            {issues.pflichtScore}/70 Punkte
                                                        </strong>
                                                    </div>
                                                </div>

                                                {/* Empfohlene Felder */}
                                                <div
                                                    style={{
                                                        padding: '10px 12px',
                                                        borderRadius: 6,
                                                        borderLeft: '3px solid #EAB308',
                                                        background: '#FEFCE8',
                                                        marginBottom: 10,
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            fontSize: 12,
                                                            fontWeight: 700,
                                                            color: '#111827',
                                                            marginBottom: 4,
                                                        }}
                                                    >
                                                        Empfohlene Felder (max. 30 Pkt.)
                                                    </div>
                                                    <div style={{ fontSize: 11, color: '#374151', marginBottom: 4 }}>
                                                        Durchschnittlich {fillPct}% der empfohlenen Felder je Artikel
                                                        befüllt.
                                                    </div>
                                                    <div
                                                        style={{
                                                            fontSize: 11,
                                                            color: '#111827',
                                                            fontWeight: 600,
                                                            marginBottom: 8,
                                                        }}
                                                    >
                                                        →{' '}
                                                        <strong>
                                                            {issues.optionalFillRatio.toFixed(2)} × 30 ={' '}
                                                            {issues.optionalScore}/30 Punkte
                                                        </strong>
                                                    </div>
                                                    <div style={{ fontSize: 10, color: '#6B7280', lineHeight: '1.6' }}>
                                                        <div>
                                                            <strong style={{ color: '#374151' }}>Produktinfos:</strong>{' '}
                                                            Deeplink · Modellbezeichnung
                                                        </div>
                                                        <div>
                                                            <strong style={{ color: '#374151' }}>
                                                                Produktmerkmale:
                                                            </strong>{' '}
                                                            Stil · Gewicht · Belastbarkeit · Sitzhöhe · Liegefläche ·
                                                            Ausrichtung · Härtegrad
                                                        </div>
                                                        <div>
                                                            <strong style={{ color: '#374151' }}>
                                                                Bilder & Medien:
                                                            </strong>{' '}
                                                            Zusatzbilder (2–10) · Youtube-Video · 3D-Ansicht (GLB/USDZ)
                                                            · Montageanleitung
                                                        </div>
                                                        <div>
                                                            <strong style={{ color: '#374151' }}>Ausstattung:</strong>{' '}
                                                            Set-Inhalt · Leuchtmittel inklusive · Matratze inklusive ·
                                                            Lattenrost inklusive · LED verbaut · Beleuchtung inklusive ·
                                                            Steckdose/Anschluss
                                                        </div>
                                                        <div>
                                                            <strong style={{ color: '#374151' }}>Textilien:</strong>{' '}
                                                            Pflegehinweise · Füllung · Bezug abnehmbar ·
                                                            Allergikergeeignet
                                                        </div>
                                                        <div>
                                                            <strong style={{ color: '#374151' }}>Nachweise:</strong>{' '}
                                                            Energieeffizienzklasse · Produktdatenblatt
                                                        </div>
                                                        <div>
                                                            <strong style={{ color: '#374151' }}>Hersteller:</strong>{' '}
                                                            Telefonnummer
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Gesamt */}
                                                <div
                                                    style={{
                                                        padding: '10px 14px',
                                                        borderRadius: 6,
                                                        border: `1px solid ${campaignEligible ? '#86EFAC' : '#E5E7EB'}`,
                                                        background: campaignEligible ? '#F0FDF4' : '#F9FAFB',
                                                        textAlign: 'center',
                                                        fontSize: 12,
                                                        fontWeight: 700,
                                                        color: '#111827',
                                                        marginBottom: 10,
                                                    }}
                                                >
                                                    Gesamt: {issues.pflichtScore} + {issues.optionalScore} = {score}/100
                                                    →{' '}
                                                    {campaignEligible
                                                        ? 'Kampagnen-berechtigt ✓'
                                                        : 'Nicht kampagnen-berechtigt'}
                                                </div>
                                            </details>

                                            {/* Kampagnen-Karte */}
                                            <div
                                                style={{
                                                    margin: '10px 18px 0',
                                                    borderRadius: 8,
                                                    border: `1px solid ${campaignEligible ? '#86EFAC' : '#FECACA'}`,
                                                    background: campaignEligible ? '#F0FDF4' : '#FEF2F2',
                                                    padding: '12px 14px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 12,
                                                }}
                                            >
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        <div
                                                            style={{
                                                                width: 18,
                                                                height: 18,
                                                                borderRadius: '50%',
                                                                background: campaignEligible ? '#16A34A' : '#DC2626',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                color: '#FFF',
                                                                fontSize: 10,
                                                                fontWeight: 800,
                                                                flexShrink: 0,
                                                            }}
                                                        >
                                                            {campaignEligible ? '✓' : '!'}
                                                        </div>
                                                        <div
                                                            style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}
                                                        >
                                                            Kampagnen-Teilnahme
                                                        </div>
                                                    </div>
                                                    <details style={{ marginTop: 5 }}>
                                                        <summary
                                                            style={{
                                                                cursor: 'pointer',
                                                                fontSize: 10,
                                                                color: '#4B5563',
                                                                fontWeight: 600,
                                                                userSelect: 'none',
                                                            }}
                                                        >
                                                            Alle Kampagnen-Kriterien anzeigen
                                                        </summary>
                                                        <div style={{ fontSize: 10, color: '#374151', marginTop: 4 }}>
                                                            Ab <strong>70/100</strong> ist Ihr Feed für Kampagnen
                                                            freigeschaltet. Zusätzlich müssen auch die weiteren
                                                            Shop-KPIs erfüllt sein:
                                                        </div>
                                                        <ul
                                                            style={{
                                                                margin: '3px 0 0 0',
                                                                paddingLeft: 16,
                                                                fontSize: 10,
                                                                color: '#374151',
                                                                lineHeight: '1.6',
                                                                listStyleType: 'disc',
                                                                listStylePosition: 'outside',
                                                            }}
                                                        >
                                                            <li style={{ display: 'list-item' }}>
                                                                Stornoquote ≤ 2,5 %
                                                            </li>
                                                            <li style={{ display: 'list-item' }}>
                                                                Liefertermintreue ≥ 94 %
                                                            </li>
                                                            <li style={{ display: 'list-item' }}>
                                                                Trackingquote ≥ 92 %
                                                            </li>
                                                            <li style={{ display: 'list-item' }}>
                                                                Preisparität ≥ 95 %
                                                            </li>
                                                        </ul>
                                                    </details>
                                                </div>
                                                <a
                                                    href={
                                                        campaignEligible
                                                            ? 'http://mc.moebel.check24.de/campaigns'
                                                            : undefined
                                                    }
                                                    target={campaignEligible ? '_blank' : undefined}
                                                    rel={campaignEligible ? 'noopener noreferrer' : undefined}
                                                    onClick={(e) => {
                                                        if (!campaignEligible) e.preventDefault();
                                                    }}
                                                    aria-disabled={!campaignEligible}
                                                    style={{
                                                        padding: '10px 18px',
                                                        borderRadius: 6,
                                                        border: 'none',
                                                        background: campaignEligible ? '#16A34A' : '#D1D5DB',
                                                        color: '#FFF',
                                                        fontSize: 13,
                                                        fontWeight: 700,
                                                        cursor: campaignEligible ? 'pointer' : 'not-allowed',
                                                        whiteSpace: 'nowrap',
                                                        textDecoration: 'none',
                                                        flexShrink: 0,
                                                        opacity: campaignEligible ? 1 : 0.7,
                                                    }}
                                                >
                                                    Zum Deal-Tool →
                                                </a>
                                            </div>

                                            {/* APA-Karte */}
                                            <div
                                                style={{
                                                    margin: '10px 18px 14px',
                                                    borderRadius: 8,
                                                    border: `1px solid ${stufe1Passed ? '#86EFAC' : '#FECACA'}`,
                                                    background: stufe1Passed ? '#F0FDF4' : '#FEF2F2',
                                                    padding: '12px 14px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 12,
                                                }}
                                            >
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        <div
                                                            style={{
                                                                width: 18,
                                                                height: 18,
                                                                borderRadius: '50%',
                                                                background: stufe1Passed ? '#16A34A' : '#DC2626',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                color: '#FFF',
                                                                fontSize: 10,
                                                                fontWeight: 800,
                                                                flexShrink: 0,
                                                            }}
                                                        >
                                                            {stufe1Passed ? '✓' : '!'}
                                                        </div>
                                                        <div
                                                            style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}
                                                        >
                                                            APA (Automatische Produktanlage)
                                                        </div>
                                                    </div>
                                                    <div style={{ fontSize: 10, color: '#374151', marginTop: 4 }}>
                                                        {stufe1Passed ? '✓' : '✗'}{' '}
                                                        {stufe1Passed
                                                            ? 'Berechtigt für APA'
                                                            : 'Nicht berechtigt für APA'}{' '}
                                                        · Fehlerquote: {errorRate.toFixed(1).replace('.', ',')}% (Max.
                                                        5%)
                                                    </div>
                                                    <div
                                                        style={{
                                                            fontSize: 10,
                                                            color: stufe1Passed ? '#166534' : '#991B1B',
                                                            fontWeight: 600,
                                                            marginTop: 2,
                                                        }}
                                                    >
                                                        {stufe1Passed
                                                            ? 'Ihre Artikel werden automatisch innerhalb von 2–3 Tagen angelegt.'
                                                            : 'Ohne APA werden Artikel manuell angelegt. Das kann 1–3 Wochen dauern.'}
                                                    </div>
                                                </div>
                                                <a
                                                    href={
                                                        stufe1Passed
                                                            ? 'mailto:partnerbetreuung@check24.de?subject=' +
                                                              encodeURIComponent('APA-Freischaltung anfordern') +
                                                              '&body=' +
                                                              encodeURIComponent(
                                                                  'Hallo CHECK24-Team,\n\nwir möchten die automatische Produktanlage (APA) für unseren Shop aktivieren. Unsere aktuelle Fehlerquote liegt bei ' +
                                                                      errorRate.toFixed(1).replace('.', ',') +
                                                                      '% und damit innerhalb des Grenzwerts von 5%.\n\nBitte schalten Sie uns für APA frei.\n\nVielen Dank\nIhr Partner',
                                                              )
                                                            : undefined
                                                    }
                                                    onClick={(e) => {
                                                        if (!stufe1Passed) e.preventDefault();
                                                    }}
                                                    aria-disabled={!stufe1Passed}
                                                    style={{
                                                        padding: '10px 18px',
                                                        borderRadius: 6,
                                                        border: 'none',
                                                        background: stufe1Passed ? '#16A34A' : '#D1D5DB',
                                                        color: '#FFF',
                                                        fontSize: 13,
                                                        fontWeight: 700,
                                                        cursor: stufe1Passed ? 'pointer' : 'not-allowed',
                                                        whiteSpace: 'nowrap',
                                                        textDecoration: 'none',
                                                        flexShrink: 0,
                                                        opacity: stufe1Passed ? 1 : 0.7,
                                                    }}
                                                >
                                                    APA-Zugang per E-Mail anfordern
                                                </a>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })()}
            </div>
        </div>
        </div>
    );
}
