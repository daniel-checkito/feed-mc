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

const EXAMPLE_FEED_CSV = `EAN (GTIN14);offer_id;name;description;brand;price;delivery_time;shipping_mode;availability;stock_amount;Bildlink_1;Bildlink_2;Bildlink_3;color;material;category_path;delivery_includes;manufacturer_name;manufacturer_street;manufacturer_postcode;manufacturer_city;manufacturer_country;manufacturer_email
4045347288557;T12345-SW;Dreammöbel Dream Ecksofa mit Hocker, Kunstleder schwarz, 270x170 cm;Elegantes Ecksofa aus hochwertigem Kunstleder in Schwarz. Maße: B 270 cm × H 82 cm × T 170 cm. Pflegeleichtes Kunstleder, strapazierfähiger Holzrahmen. Inkl. Hocker. Einfache Selbstmontage ca. 30 min.;Dreammöbel;899.00;3-5 Werktage;Spedition;auf Lager;12;https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600;https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?w=600;https://images.unsplash.com/photo-1567016432779-094069958ea5?w=600;Schwarz;Kunstleder / Holz;Wohnzimmer > Sofas > Ecksofas;1x Ecksofa, 1x Hocker, 4x Füße;Traum GmbH;Musterstr. 1;10115;Berlin;Deutschland;info@traumgmbh.de
4045347288558;T12345-GR;Dreammöbel Dream Ecksofa mit Hocker, Kunstleder grau, 270x170 cm;Elegantes Ecksofa aus hochwertigem Kunstleder in Grau. Maße: B 270 cm × H 82 cm × T 170 cm. Pflegeleichtes Kunstleder, stabiler Holzrahmen. Inkl. Hocker mit passendem Bezug.;Dreammöbel;849.00;3-5 Werktage;Spedition;auf Lager;8;https://images.unsplash.com/photo-1540574163026-643ea20ade25?w=600;https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600;;Grau;Kunstleder / Holz;Wohnzimmer > Sofas > Ecksofas;1x Ecksofa, 1x Hocker, 4x Füße;Traum GmbH;Musterstr. 1;10115;Berlin;Deutschland;info@traumgmbh.de
4045347299001;T67890-NK;NaturWood Esstisch massiv Eiche natur, 160x80 cm;Massiver Esstisch aus naturbelassener Eiche. Maße: B 160 cm × H 76 cm × T 80 cm. Geölt und gewachst. Jedes Stück ein Unikat durch die natürliche Maserung. Lieferung teilmontiert.;NaturWood;649.00;1-2 Wochen;Spedition;auf Lager;7;https://images.unsplash.com/photo-1449247709967-d4461a6a6103?w=600;https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600;https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?w=600;Natur / Eiche;Eiche massiv;Esszimmer > Tische > Esstische;1x Esstisch;NaturWood GmbH;Waldweg 5;80331;München;Deutschland;service@naturwood.de
4045347299010;T67891-WS;NaturWood Esstisch massiv Eiche weiß gebeizt, 140x80 cm;Massiver Esstisch aus Eiche, weiß gebeizt. Maße: B 140 cm × H 76 cm × T 80 cm. Zeitloser Landhausstil, robust und pflegeleicht. Montage in ca. 20 Minuten.;NaturWood;Auf Anfrage;1-2 Wochen;Spedition;auf Lager;4;https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?w=600;;;Weiß gebeizt;Eiche massiv;Esszimmer > Tische > Esstische;1x Esstisch;NaturWood GmbH;Waldweg 5;80331;München;Deutschland;service@naturwood.de
;T99999-WR;HomeStyle Wandregal schwebend weiß, 3er Set 60 cm;Modernes Schwebegeregal aus lackiertem MDF in Weiß. 3er-Set, je Regal: B 60 cm × T 20 cm × H 4 cm. Unsichtbare Wandbefestigung inklusive. Ideal für Wohnzimmer und Büro.;HomeStyle;59.00;2-4 Werktage;Paket;auf Lager;23;https://images.unsplash.com/photo-1616627781431-23b776aad6b2?w=600;;; Weiß;MDF lackiert;Wohnzimmer > Regale > Wandregale;3x Wandregal, 9x Dübel, 9x Schrauben;HomeStyle KG;Hauptstr. 10;20095;Hamburg;Deutschland;info@homestyle.de
4045347299002;T55555;OakLine Sideboard Eiche massiv natur, 4 Türen, 160 cm;;OakLine;549.00;1-2 Wochen;Spedition;sofort lieferbar;3;https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600;;; Eiche natur;Eiche massiv;Wohnzimmer > Sideboards;1x Sideboard;OakLine GmbH;Eichenweg 3;50667;Köln;Deutschland;kontakt@oakline.de
4045347299003;T55555;HomeStyle Bücherregal weiß hochglanz, 5 Fächer, 80x180 cm;Weißes Bücherregal aus MDF, hochglanz lackiert. 5 Einlegeböden verstellbar. Maße: B 80 cm × H 180 cm × T 30 cm. Standsicher mit Kippschutz-Montageset.;HomeStyle;149.00;2-4 Werktage;Paket;auf Lager;15;https://images.unsplash.com/photo-1616627781431-23b776aad6b2?w=600;https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600;;Weiß Hochglanz;MDF lackiert;Wohnzimmer > Regale > Bücherregale;1x Regal, 5x Einlegeboden, Montageset;HomeStyle KG;Hauptstr. 10;20095;Hamburg;Deutschland;info@homestyle.de
4045347299020;T88001-WK;SleepWell Boxspringbett Stoff anthrazit, 180x200 cm;Hochwertiges Boxspringbett mit 3-schichtigem Aufbau: Bonellfedern-Unterbox, 7-Zonen-Taschenfederkern-Matratze, Topper. Bezug: Strukturstoff anthrazit. Maße: B 180 cm × H 120 cm × T 220 cm.;SleepWell;1299.00;5-7 Werktage;Spedition;auf Lager;5;https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=600;https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600;https://images.unsplash.com/photo-1540574163026-643ea20ade25?w=600;Anthrazit;Strukturstoff / Stahl;Schlafzimmer > Betten > Boxspringbetten;1x Boxspringbett (Unterbox + Matratze + Topper), Montagematerial;SleepWell GmbH;Schlafweg 12;70173;Stuttgart;Deutschland;info@sleepwell.de
4045347299021;T88002-BG;SleepWell Boxspringbett Kunstleder beige, 160x200 cm;Elegantes Boxspringbett mit Kunstlederbezug in Beige. 7-Zonen-Taschenfederkernmatratze H3, Visco-Topper 5 cm. Maße: B 160 cm × H 118 cm × T 218 cm. Lieferung frei Haus, Aufbauservice buchbar.;SleepWell;1099.00;5-7 Werktage;Spedition;auf Lager;3;https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=600;;;Beige;Kunstleder / Metall;Schlafzimmer > Betten > Boxspringbetten;1x Boxspringbett, Montagematerial;SleepWell GmbH;Schlafweg 12;70173;Stuttgart;Deutschland;info@sleepwell.de
4045347299030;T77001-ES;FurniStyle Esszimmerstuhl Stoff grau, 4er Set;4 Esszimmerstühle im modernen Skandi-Design. Sitzfläche und Rückenlehne gepolstert mit Strukturstoff in Grau. Gestell aus Buchenholz natur. Maße je Stuhl: B 46 × H 83 × T 55 cm.;FurniStyle;299.00;3-5 Werktage;Paket;auf Lager;18;https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?w=600;https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600;https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?w=600;Grau / Natur;Stoff / Buchenholz;Esszimmer > Stühle > Esszimmerstühle;4x Stuhl, Montagematerial;FurniStyle KG;Designweg 8;40210;Düsseldorf;Deutschland;hello@furnistyle.de
4045347299040;T66001-PL;LightUp Pendelleuchte Metall schwarz, E27, höhenverstellbar;Moderne Pendelleuchte aus gebürstetem Metall in Schwarz. Fassung E27, max. 60W. Kabel höhenverstellbar 40–120 cm. Inklusive Baldachin und Montagematerial. OHNE Leuchtmittel.;LightUp;89.00;2-3 Werktage;Paket;auf Lager;31;https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600;https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600;;Schwarz;Metall / Textilkabel;Wohnzimmer > Leuchten > Pendelleuchten;1x Pendelleuchte, 1x Baldachin, Montagematerial;LightUp GmbH;Lichtstr. 3;50679;Köln;Deutschland;info@lightup.de
4045347299041;T66002-GO;LightUp Pendelleuchte Metall gold, E27, höhenverstellbar;Stilvolle Pendelleuchte aus gebürstetem Metall in Messing-Gold. Fassung E27, max. 60W. Kabel höhenverstellbar 40–120 cm. Passt zu modernen und klassischen Einrichtungsstilen.;LightUp;99.00;2-3 Werktage;Paket;auf Lager;14;https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600;;;Gold / Messing;Metall / Textilkabel;Wohnzimmer > Leuchten > Pendelleuchten;1x Pendelleuchte, 1x Baldachin, Montagematerial;LightUp GmbH;Lichtstr. 3;50679;Köln;Deutschland;info@lightup.de
4045347299050;T90001-KS;WardrobeMax Kleiderschrank 3-türig weiß, 150x200 cm;Großer Kleiderschrank mit 3 Türen, Spiegeltür mittig. Inneneinteilung: 2 Kleiderstangen, 4 Fachböden. B 150 × H 200 × T 60 cm. Selbstmontage möglich.;WardrobeMax;349.00;1-2 Wochen;Spedition;auf Lager;6;https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600;https://images.unsplash.com/photo-1540574163026-643ea20ade25?w=600;https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?w=600;Weiß;MDF / Spanplatte;Schlafzimmer > Schränke > Kleiderschränke;1x Kleiderschrank, Montagematerial;WardrobeMax GmbH;Schrankstr. 7;30159;Hannover;Deutschland;info@wardrobemax.de
4045347299051;T90002-SE;LoungeChair Sessel Echtleder cognac, Drehfunktion;Hochwertiger Sessel mit echtem Rindsleder in Cognac. 360° Drehfunktion. Holzfüße natur. Maße: B 70 × H 90 × T 75 cm. Entspanntes Sitzen mit Hochlehner.;LoungeChair;599.00;3-5 Werktage;Spedition;auf Lager;4;https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?w=600;https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600;;Cognac;Echtleder / Buchenholz;Wohnzimmer > Sessel > Lounge-Sessel;1x Sessel, 4x Füße;LoungeChair GmbH;Sesselweg 2;70173;Stuttgart;Deutschland;info@loungechair.de
4045347299052;T90003-SD;DeskPro Schreibtisch höhenverstellbar elektrisch, 140x70 cm;Elektrisch höhenverstellbarer Schreibtisch. Höhe 63–128 cm, stufenlos. Tischplatte MDF weiß, Gestell Stahl schwarz. B 140 × T 70 cm. Memory-Funktion 3 Positionen.;DeskPro;699.00;5-7 Werktage;Spedition;auf Lager;9;https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600;;;Weiß / Schwarz;MDF / Stahl;Büro > Schreibtische > Steh-Sitz-Schreibtische;1x Schreibtisch, Montagematerial;DeskPro GmbH;Bürostr. 15;60329;Frankfurt;Deutschland;service@deskpro.de
4045347299053;T90004-KO;;Kompakte Kommode mit 4 geräumigen Schubladen. Softclose-Funktion. Oberfläche matt lackiert. B 80 × H 90 × T 40 cm. Standsicher dank Anti-Kipp-Beschlag.;HomeStyle;229.00;2-4 Werktage;Paket;auf Lager;11;https://images.unsplash.com/photo-1616627781431-23b776aad6b2?w=600;https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600;;Weiß Matt;MDF lackiert;Wohnzimmer > Kommoden;1x Kommode, Montagematerial;HomeStyle KG;Hauptstr. 10;20095;Hamburg;Deutschland;info@homestyle.de
4045347299054;T90005-GP;WoodDesign Garderobenpaneel Eiche massiv, 5 Haken, 100 cm;Massivholz-Garderobenpaneel aus Eiche, geölt. 5 Kleiderhaken aus Messing. Inkl. Ablage oben. B 100 × H 30 × T 20 cm.;WoodDesign;179.00;2-4 Werktage;Paket;sofort lieferbar;7;https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600;https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?w=600;https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?w=600;Eiche natur / Messing;Eiche massiv / Messing;Flur > Garderobe > Garderobenpaneele;1x Garderobenpaneel, 5x Haken, Montageset;WoodDesign AG;Holzallee 4;10117;Berlin;Deutschland;info@wooddesign.de
4045347299055;T90006-OL;OutdoorPlus Lounge-Sofa Polyrattan grau, 3-Sitzer;Wetterfestes Lounge-Sofa aus Polyrattan in Grau. Gestell Aluminium pulverbeschichtet. Polster wasserabweisend, abziehbar. B 190 × H 75 × T 80 cm.;OutdoorPlus;799.00;1 Woche;Spedition;auf Lager;2;https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600;;; Grau;Polyrattan / Aluminium;Garten > Gartensofa > Loungesofa;1x Lounge-Sofa, Kissen;OutdoorPlus GmbH;Gartenweg 9;81243;München;Deutschland;outdoor@outdoorplus.de
;T11001-NE;CityHome Nachttisch weiß, 2 Schubladen;Modernes Nachttisch-Set mit 2 Schubladen. Maße: B 45 × H 50 × T 35 cm. Softclose.;CityHome;79.00;2-4 Werktage;Paket;auf Lager;14;https://images.unsplash.com/photo-1616627781431-23b776aad6b2?w=600;;;Weiß;MDF lackiert;Schlafzimmer > Nachttische;1x Nachttisch;CityHome KG;Stadtweg 22;10115;Berlin;Deutschland;info@cityhome.de
;T11002-NE;CityHome Nachttisch schwarz, 2 Schubladen;Modernes Nachttisch-Set mit 2 Schubladen in Schwarz. Maße: B 45 × H 50 × T 35 cm. Softclose.;CityHome;79.00;2-4 Werktage;Paket;auf Lager;9;https://images.unsplash.com/photo-1616627781431-23b776aad6b2?w=600;;;Schwarz;MDF lackiert;Schlafzimmer > Nachttische;1x Nachttisch;CityHome KG;Stadtweg 22;10115;Berlin;Deutschland;info@cityhome.de
;T11003-RE;CityHome Beistelltisch Eiche, rund 40 cm;Runder Beistelltisch aus Eiche, Durchmesser 40 cm, Höhe 50 cm.;CityHome;49.00;2-4 Werktage;Paket;auf Lager;20;https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?w=600;https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600;;Eiche;Eiche;Wohnzimmer > Beistelltische;1x Beistelltisch;CityHome KG;Stadtweg 22;10115;Berlin;Deutschland;info@cityhome.de
;T11004-LA;BrightLight Tischleuchte Messing, E27;Edle Tischleuchte aus Messing. Fassung E27, max. 40W. Höhe 35 cm.;BrightLight;69.00;2-3 Werktage;Paket;auf Lager;8;https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600;;;Messing;Metall;Wohnzimmer > Leuchten > Tischleuchten;1x Tischleuchte;BrightLight GmbH;Lichtweg 8;50679;Köln;Deutschland;info@brightlight.de
;T11005-LA;BrightLight Stehleuchte Chrom, 3-flammig;Dreiflammige Stehleuchte aus Chrom. Höhe 180 cm. Drehbare Spots.;BrightLight;129.00;2-3 Werktage;Paket;auf Lager;5;https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600;;;Chrom;Metall;Wohnzimmer > Leuchten > Stehleuchten;1x Stehleuchte;BrightLight GmbH;Lichtweg 8;50679;Köln;Deutschland;info@brightlight.de
404534729906;T22001-PO;Pouf;Bequemer Pouf in modernem Design.;ComfortLine;39.00;2-4 Werktage;Paket;auf Lager;25;https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?w=600;;;Grau;Stoff;Wohnzimmer > Hocker;1x Pouf;ComfortLine GmbH;Komfortstr. 1;80331;München;Deutschland;info@comfortline.de
404534729907;T22002-PO;Bank;Sitzbank für Esszimmer.;ComfortLine;119.00;2-4 Werktage;Paket;auf Lager;12;https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?w=600;;;Schwarz;Stoff / Holz;Esszimmer > Sitzbänke;1x Bank;ComfortLine GmbH;Komfortstr. 1;80331;München;Deutschland;info@comfortline.de
40453472990;T22003-PO;Stuhl;Esszimmerstuhl modern.;ComfortLine;59.00;2-4 Werktage;Paket;auf Lager;18;https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?w=600;;;Grau;Stoff;Esszimmer > Stühle;1x Stuhl;ComfortLine GmbH;Komfortstr. 1;80331;München;Deutschland;info@comfortline.de
40453472991;T22004-RE;Regal;Wandregal in modernem Design.;ComfortLine;39.00;2-4 Werktage;Paket;auf Lager;30;https://images.unsplash.com/photo-1616627781431-23b776aad6b2?w=600;;;Weiß;MDF;Wohnzimmer > Regale;1x Regal;ComfortLine GmbH;Komfortstr. 1;80331;München;Deutschland;info@comfortline.de
4045347299100;T33001-DU;Dreammöbel Dream Ecksofa mit Hocker, Kunstleder schwarz, 270x170 cm;Elegantes Ecksofa in Schwarz. Maße: 270x170 cm. Pflegeleichtes Kunstleder.;Dreammöbel;899.00;3-5 Werktage;Spedition;auf Lager;12;https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600;https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?w=600;https://images.unsplash.com/photo-1567016432779-094069958ea5?w=600;Schwarz;Kunstleder;Wohnzimmer > Sofas > Ecksofas;1x Ecksofa, 1x Hocker;DupBrand GmbH;Doppelstr. 1;10115;Berlin;Deutschland;info@dup.de
4045347299101;T33002-DU;NaturWood Esstisch massiv Eiche natur, 160x80 cm;Massiver Esstisch aus Eiche. 160x80 cm.;NaturWood;649.00;1-2 Wochen;Spedition;auf Lager;7;https://images.unsplash.com/photo-1449247709967-d4461a6a6103?w=600;https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600;;Natur;Eiche;Esszimmer > Tische > Esstische;1x Esstisch;DupBrand GmbH;Doppelstr. 1;10115;Berlin;Deutschland;info@dup.de
4045347299102;T33003-AD;HomeStyle Bett 140x200 Jetzt kaufen mit 30% Rabatt!;Tolles Bett zum Sonderpreis. Jetzt kaufen mit 30% Rabatt! Mehr Infos auf www.homestyle-shop.de.;HomeStyle;199.00;2-4 Werktage;Paket;auf Lager;4;https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=600;;;Weiß;MDF;Wohnzimmer > Sonstiges;1x Bett;HomeStyle KG;Hauptstr. 10;20095;Hamburg;Deutschland;info@homestyle.de
4045347299103;T33004-XX;Test Produkt n/a;test;n/a;0;n/a;n/a;n/a;0;;;;n/a;n/a;Sonstiges;;n/a;;;;;
4045347299104;T33005-SC;BeispielArtikel;siehe oben;TestBrand;TBD;auf Anfrage;Spedition;auf Lager;1;;;;TBD;TBD;Möbel;n/a;TestBrand;;;;Deutschland;
4045347299105;T44001-LI;LightUp LED-Deckenleuchte rund weiß, 40W;Moderne LED-Deckenleuchte. Durchmesser 50 cm. 40W LED integriert. Dimmbar.;LightUp;149.00;2-3 Werktage;Paket;auf Lager;15;https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600;;;Weiß;Metall / Acryl;Wohnzimmer > Leuchten > Deckenleuchten;1x Deckenleuchte;LightUp GmbH;Lichtstr. 3;50679;Köln;Deutschland;info@lightup.de
4045347299106;T44002-LI;LightUp LED-Wandleuchte schwarz, 12W;Moderne LED-Wandleuchte für Innen. 12W LED integriert. IP44.;LightUp;89.00;2-3 Werktage;Paket;auf Lager;9;https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600;https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600;;Schwarz;Metall;Wohnzimmer > Leuchten > Wandleuchten;1x Wandleuchte;LightUp GmbH;Lichtstr. 3;50679;Köln;Deutschland;info@lightup.de
4045347299107;T44003-LI;LightUp Pendelleuchte Glas klar, E27;Pendelleuchte mit Klarglas-Schirm. E27 Fassung, max. 60W.;LightUp;99.00;2-3 Werktage;Paket;auf Lager;6;https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600;https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600;https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?w=600;Klar;Glas / Metall;Wohnzimmer > Leuchten > Pendelleuchten;1x Pendelleuchte;LightUp GmbH;Lichtstr. 3;50679;Köln;Deutschland;info@lightup.de
4045347299108;T55001-GP;CompactLiving Drehstuhl;Bürostuhl mit Drehfunktion und höhenverstellbar.;CompactLiving;149.00;3-5 Werktage;Paket;auf Lager;7;https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?w=600;https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600;https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?w=600;;;Büro > Bürostühle;1x Drehstuhl;CompactLiving GmbH;Bürostr. 4;60329;Frankfurt;Deutschland;info@compactliving.de
4045347299109;T55002-GP;CompactLiving Bürotisch;Tisch für Heimbüro.;CompactLiving;199.00;3-5 Werktage;Spedition;auf Lager;5;https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?w=600;;;;;Büro > Schreibtische;1x Tisch;CompactLiving GmbH;Bürostr. 4;60329;Frankfurt;Deutschland;info@compactliving.de`;

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
const SHIPPING_MODE_ALIASES = {
    package: 'paket', pakete: 'paket', parcel: 'paket', pkg: 'paket', karton: 'paket',
    shipment: 'spedition', spedition_ware: 'spedition', speditionsware: 'spedition', freight: 'spedition', forwarding: 'spedition',
};
const TEMPLATE_DESC_RE = /beispieltext|musterbeschreibung|lorem ipsum/i;
const ADVERTISING_RE = /jetzt kaufen|rabatt\b|angebot\b/i;
const EXTERNAL_LINK_RE = /www\.|https?:\/\//i;
const DELIVERY_TIME_RE = /^\d+(-\d+)?\s*(tage|werktage|arbeitstage|wochen|woche|wk|wt|d|days)?$/i;

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
    stepUpload: 'Hochladen', stepMapping: 'Zuordnung', stepResults: 'Pflichtfelder', stepOptional: 'Optionale Felder', stepRecommendations: 'Empfehlungen',
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
    warehouseDE: 'Deutschland', warehouseNonDE: 'In einem anderen EU-Land',
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
    missingCount: (n) => `${n} Fehler`,
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
        label: 'PFLICHT', color: '#991B1B', bg: '#FEF2F2', border: '#FCA5A5',
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
        label: 'QUALITÄT', color: '#92400E', bg: '#FFFBEB', border: '#FCD34D',
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
        { n: 4, title: 'Optionale Felder', desc: 'Alle optionalen Felder werden geprüft.' },
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
    stepUpload: 'Upload', stepMapping: 'Mapping', stepResults: 'Required Fields', stepOptional: 'Optional Fields', stepRecommendations: 'Recommendations',
    helpContact: 'Help & Contact',
    s1Heading: 'Check Your Feed',
    s1Sub: 'Upload a CSV - we analyze required and optional fields and show which items are ready to list.',
    fileReading: 'Reading…',
    fileLoaded: (n) => `${n} items detected`,
    fileChange: 'Different file',
    dropHeading: 'Select CSV file',
    dropSub: 'Drag here or click',
    warehouseLabel: 'Warehouse Location',
    warehouseDE: 'Germany', warehouseNonDE: 'In another EU country',
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
    missingCount: (n) => `${n} errors`,
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
        label: 'REQUIRED', color: '#991B1B', bg: '#FEF2F2', border: '#FCA5A5',
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
        label: 'QUALITY', color: '#92400E', bg: '#FFFBEB', border: '#FCD34D',
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
        { n: 4, title: 'Optional Fields', desc: 'All optional fields are checked.' },
        { n: 5, title: 'Recommendations', desc: 'Download the error report and fix in Excel.' },
    ],
    warehouseDEsub: 'No HS Code required',
    warehouseNonDEsub: 'HS Code validated as required field',
    continueMappingBtn: 'Continue to Column Mapping',
    feedTemplateSub2: 'Excel file with all required fields',
};

export default function McAngebotsfeed() {
    const showQualityScore = false; // not public yet - re-enable when ready

    // Pastel color palette for status indicators
    const P_RED    = '#FCA5A5'; const P_RED_BG    = '#FEF2F2'; const P_RED_TEXT    = '#DC2626';
    const P_ORANGE = '#FCD34D'; const P_ORANGE_BG = '#FFFBEB'; const P_ORANGE_TEXT = '#92400E';
    const P_GREEN  = '#86EFAC'; const P_GREEN_BG  = '#F0FDF4'; const P_GREEN_TEXT  = '#166534';
    const P_BLUE   = '#93C5FD'; const P_BLUE_BG   = '#EFF6FF'; const P_BLUE_TEXT   = '#1E40AF';

    const [file, setFile] = useState(null);
    const [dragging, setDragging] = useState(false);
    const [showLeitfaden, setShowLeitfaden] = useState(false);
    const [showVorlage, setShowVorlage] = useState(false);
    const [vorlageSearch, setVorlageSearch] = useState('');
    const [storeLocation, setStoreLocation] = useState('germany');
    const [step, setStep] = useState(1);
    const [rows, setRows] = useState([]);
    const [headers, setHeaders] = useState([]);
    const [manualMapping, setManualMapping] = useState({});
    const [expandedRecs, setExpandedRecs] = useState(() => new Set());
    const [expandedFieldExamples, setExpandedFieldExamples] = useState(() => new Set());
    const [expandedFieldSubgroups, setExpandedFieldSubgroups] = useState(() => new Set());
    const [collapsedSections, setCollapsedSections] = useState(() => new Set());
    const [lang, setLang] = useState('de');
    const [langOpen, setLangOpen] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [imgModal, setImgModal] = useState({ open: false, urls: [], idx: 0 });
    const [eanSearchImg, setEanSearchImg] = useState('');
    const [selectedImgCount, setSelectedImgCount] = useState(null);
    const [alwaysAvailable, setAlwaysAvailable] = useState(false);
    const [optionalExpanded, setOptionalExpanded] = useState(false);
    const [parseError, setParseError] = useState(null);
    const [titleBucket, setTitleBucket] = useState(null);
    const [descBucket, setDescBucket] = useState(null);
    const [recFilter, setRecFilter] = useState('all');
    const fileRef = useRef(null);

    function parseFile(f) {
        if (!f) return;
        const ext = f.name.split('.').pop().toLowerCase();
        if (ext !== 'csv' && f.type !== 'text/csv' && f.type !== 'application/csv') {
            setParseError(lang === 'de' ? 'Nur CSV-Dateien werden unterstützt.' : 'Only CSV files are supported.');
            return;
        }
        setParseError(null);
        setFile(f);
        setRows([]);
        setHeaders([]);
        setManualMapping({});
        const tryParseMc = (encoding) => {
            const reader = new FileReader();
            reader.onerror = () => {
                setParseError(lang === 'de' ? 'Datei konnte nicht gelesen werden.' : 'Could not read file.');
            };
            reader.onload = (evt) => {
                const text = evt.target?.result;
                if (typeof text !== 'string') {
                    setParseError(lang === 'de' ? 'Dateiinhalt konnte nicht verarbeitet werden.' : 'Could not process file contents.');
                    return;
                }
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
                        if (h.length === 0) {
                            setParseError(lang === 'de' ? 'Die CSV-Datei enthält keine Spaltenköpfe.' : 'The CSV file contains no column headers.');
                            setFile(null);
                            return;
                        }
                        if (r.length === 0) {
                            setParseError(lang === 'de' ? 'Die CSV-Datei enthält keine Datenzeilen.' : 'The CSV file contains no data rows.');
                            setFile(null);
                            return;
                        }
                        if (res.errors?.length > 0) {
                            const firstErr = res.errors[0];
                            setParseError(lang === 'de'
                                ? `CSV-Fehler in Zeile ${firstErr.row ?? '?'}: ${firstErr.message}`
                                : `CSV error at row ${firstErr.row ?? '?'}: ${firstErr.message}`);
                        }
                        setHeaders(h);
                        setRows(r);
                    },
                    error: (err) => {
                        setParseError(lang === 'de' ? `CSV konnte nicht geparst werden: ${err.message}` : `Could not parse CSV: ${err.message}`);
                        setFile(null);
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
                    } else if (val.trim().split(/\s+/).length <= 3) {
                        pflichtErrors.push({ row: rn, ean, field: 'description', type: 'template', value: val });
                        pflichtOk = false;
                    } else if (val.length < 50) {
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
                if (key === 'delivery_time' && !DELIVERY_TIME_RE.test(val.trim())) {
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
        // brand and description are already validated in the Pflichtfeld step,
        // so they are intentionally excluded from the optional-field check.
        const OPT_FIELDS_TO_CHECK = ['color', 'material', 'delivery_includes'];
        const OPT_FIELD_LABELS_DE = { color: 'Farbe', material: 'Material', delivery_includes: 'Lieferumfang' };
        const OPT_FIELD_LABELS_EN = { color: 'Color', material: 'Material', delivery_includes: 'Delivery Includes' };
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

    // Reusable horizontal progress bar with legend.
    // Used for Pflicht / Optional / Listbar score displays so they all share one look.
    const ScoreBar = ({
        title,
        pct,
        color,
        complete,
        incomplete,
        total,
        completeLabel,
        incompleteLabel,
        totalLabel,
        tipComplete,
        tipIncomplete,
        tipTotal,
        summary,
        numLocale,
    }) => (
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #F3F4F6' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 8 }}>{title}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, height: 10, background: '#E5E7EB', borderRadius: 5, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, pct))}%`, background: color, borderRadius: 5, transition: 'width 0.4s' }} />
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color, lineHeight: 1, minWidth: 44, textAlign: 'right' }}>{pct}%</div>
            </div>
            {(complete !== undefined || incomplete !== undefined || total !== undefined) && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 8, fontSize: 10 }}>
                    {complete !== undefined && (
                        <Tooltip text={tipComplete}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#374151', cursor: tipComplete ? 'help' : 'default' }}>
                                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#86EFAC', flexShrink: 0 }} />
                                <strong style={{ fontWeight: 700, color: '#111827' }}>{complete.toLocaleString(numLocale)}</strong> {completeLabel}
                            </span>
                        </Tooltip>
                    )}
                    {incomplete !== undefined && (
                        <Tooltip text={tipIncomplete}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#374151', cursor: tipIncomplete ? 'help' : 'default' }}>
                                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#FCD34D', flexShrink: 0 }} />
                                <strong style={{ fontWeight: 700, color: '#111827' }}>{incomplete.toLocaleString(numLocale)}</strong> {incompleteLabel}
                            </span>
                        </Tooltip>
                    )}
                    {total !== undefined && (
                        <Tooltip text={tipTotal}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#6B7280', cursor: tipTotal ? 'help' : 'default', marginLeft: 'auto' }}>
                                <strong style={{ fontWeight: 700, color: '#374151' }}>{total.toLocaleString(numLocale)}</strong> {totalLabel}
                            </span>
                        </Tooltip>
                    )}
                </div>
            )}
            {summary && (
                <div style={{ fontSize: 11, color: '#6B7280', marginTop: 8, lineHeight: 1.5 }}>{summary}</div>
            )}
        </div>
    );

    return (
        <div style={{ background: '#F3F4F6', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <style>{`
                .mc-header-btn-label { display: inline; }
                .mc-header-guide-btn { display: flex !important; }
                .mc-header-sep { display: block !important; }
                .mc-step1-grid { display: grid; grid-template-columns: 1fr 400px; gap: 24px; align-items: start; }
                .mc-two-col-320 { display: grid; grid-template-columns: 1fr 400px; gap: 24px; align-items: start; }
                .mc-two-col-400 { display: grid; grid-template-columns: 1fr 400px; gap: 24px; align-items: start; }
                .mc-tab-bar { overflow-x: auto; scrollbar-width: none; }
                .mc-tab-bar::-webkit-scrollbar { display: none; }
                .mc-sticky-sidebar { position: sticky; top: 20px; align-self: flex-start; }
                @media (max-width: 960px) {
                    .mc-header-btn-label { display: none !important; }
                    .mc-step1-grid { grid-template-columns: 1fr !important; }
                    .mc-two-col-400 { grid-template-columns: 1fr !important; }
                    .mc-two-col-320 { grid-template-columns: 1fr !important; }
                    .mc-sticky-sidebar { position: static !important; }
                }
                .mc-mobile-menu-btn { display: none !important; }
                .mc-lang-label { display: inline; }
                @media (max-width: 640px) {
                    .mc-header-guide-btn { display: none !important; }
                    .mc-header-sep { display: none !important; }
                    .mc-mobile-menu-btn { display: flex !important; }
                    .mc-lang-label { display: none !important; }
                }
            `}</style>
            {/* ── HEADER ── */}
            <header style={{ background: MC_BLUE, padding: '10px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, zIndex: 200 }}>
                <span onClick={resetToStart} style={{ color: '#FFF', fontWeight: 900, fontSize: 22, letterSpacing: '-0.5px', fontStyle: 'italic', whiteSpace: 'nowrap', flexShrink: 0, cursor: 'pointer' }}>
                    FEED CHECKER
                </span>

                {/* Right-side buttons (language selector + action buttons) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {/* Language dropdown */}
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                        <button type="button" onClick={() => setLangOpen((v) => !v)}
                            style={{ display: 'flex', alignItems: 'center', gap: 7, background: langOpen ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', color: '#FFF', fontSize: 13, fontWeight: 600, transition: 'background 0.15s' }}>
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
                            <span className="mc-lang-label">{lang === 'de' ? 'Deutsch' : 'English'}</span>
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ opacity: 0.8, transform: langOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}><path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </button>
                        {langOpen && (
                            <>
                                <div style={{ position: 'fixed', inset: 0, zIndex: 1000 }} onClick={() => setLangOpen(false)} />
                                <div style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, background: '#FFF', borderRadius: 8, border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 8px 24px rgba(0,0,0,0.18)', overflow: 'hidden', zIndex: 1001, width: '100%' }}>
                                    {[{ value: 'de', label: 'Deutsch' }, { value: 'en', label: 'English' }].map((opt) => (
                                        <button key={opt.value} type="button"
                                            onClick={() => { setLang(opt.value); setLangOpen(false); }}
                                            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 7, padding: '8px 12px', background: lang === opt.value ? '#EEF4FF' : '#FFF', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: lang === opt.value ? 700 : 400, color: lang === opt.value ? MC_BLUE : '#374151', whiteSpace: 'nowrap' }}>
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
                    <div className="mc-header-sep" style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.2)', margin: '0 2px' }} />
                    <button type="button" onClick={() => setShowLeitfaden(true)} className="mc-header-guide-btn"
                        style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid rgba(255,255,255,0.3)', background: 'transparent', color: '#FFF', fontSize: 12, fontWeight: 600, padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}>
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M2.5 1.5h8.5l3 3v10h-11.5v-13z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/><path d="M11 1.5v3h3" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/><path d="M5 8h6M5 10.5h6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                        <span className="mc-header-btn-label">{T.feedGuide}</span>
                    </button>
                    <button type="button" onClick={() => setShowVorlage(true)} className="mc-header-guide-btn"
                        style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid rgba(255,255,255,0.3)', background: 'transparent', color: '#FFF', fontSize: 12, fontWeight: 600, padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}>
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M8 2v8M5 7l3 3 3-3M2 13h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        <span className="mc-header-btn-label">{T.feedTemplate}</span>
                    </button>
                    <div className="mc-header-sep" style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.2)', margin: '0 2px' }} />
                    <a
                        href="mailto:contentmanagement.moebel@check24.de?subject=Feed%20Checker%20-%20Hilfe"
                        style={{ border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.08)', color: '#FFFFFF', fontSize: 12, fontWeight: 600, padding: '6px 10px', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
                        className="mc-header-guide-btn"
                    >
                        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ flexShrink: 0 }}><rect x="1" y="2.5" width="11" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M1 4l5.5 3.5L12 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
                        <span className="mc-header-btn-label">{T.helpContact}</span>
                    </a>
                    {/* Hamburger button, only visible at <640px */}
                    <div style={{ position: 'relative' }}>
                        <button type="button" className="mc-mobile-menu-btn" onClick={() => setMobileMenuOpen((v) => !v)}
                            style={{ alignItems: 'center', justifyContent: 'center', gap: 5, background: mobileMenuOpen ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 8, padding: '7px 10px', cursor: 'pointer', color: '#FFF' }}>
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
                        </button>
                        {mobileMenuOpen && (
                            <>
                                <div style={{ position: 'fixed', inset: 0, zIndex: 1001 }} onClick={() => setMobileMenuOpen(false)} />
                                <div style={{ position: 'absolute', top: '100%', right: 0, background: '#FFF', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.18)', padding: 8, zIndex: 1002, minWidth: 180, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    <button type="button" onClick={() => { setShowLeitfaden(true); setMobileMenuOpen(false); }}
                                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: 6, fontSize: 13, fontWeight: 600, color: '#374151', textAlign: 'left', width: '100%' }}>
                                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M2.5 1.5h8.5l3 3v10h-11.5v-13z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/><path d="M11 1.5v3h3" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/><path d="M5 8h6M5 10.5h6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                                        {T.feedGuide}
                                    </button>
                                    <button type="button" onClick={() => { setShowVorlage(true); setMobileMenuOpen(false); }}
                                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: 6, fontSize: 13, fontWeight: 600, color: '#374151', textAlign: 'left', width: '100%' }}>
                                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M8 2v8M5 7l3 3 3-3M2 13h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                        {T.feedTemplate}
                                    </button>
                                    <a href="mailto:contentmanagement.moebel@check24.de?subject=Feed%20Checker%20-%20Hilfe"
                                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'transparent', borderRadius: 6, fontSize: 13, fontWeight: 600, color: '#374151', textDecoration: 'none', width: '100%' }}>
                                        <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="1" y="2.5" width="11" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M1 4l5.5 3.5L12 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
                                        {T.helpContact}
                                    </a>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </header>
        {/* ── MAIN BODY ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* Step tabs bar */}
            <div className="mc-tab-bar" style={{ background: '#fff', borderBottom: '1px solid #E2E6EE', padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, flexShrink: 0, position: 'relative' }}>
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
                {/* Start over link, absolutely positioned so tabs stay centered */}
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
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 20px', boxSizing: 'border-box' }}>

            {/* ══════════════════════════════════════════
                STEP 1 - Upload
            ══════════════════════════════════════════ */}
            {step === 1 && (
                <div className="mc-step1-grid" style={{ width: '100%', maxWidth: 1320, alignItems: 'start' }}>

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
                            {/* Reichweiten-Hinweisbox */}
                            <div style={{ margin: '10px 18px 14px', background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1, color: '#92400E' }}>
                                    <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4"/>
                                    <path d="M8 5v3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                                    <circle cx="8" cy="11" r="0.7" fill="currentColor"/>
                                </svg>
                                <span style={{ fontSize: 11, color: '#92400E', lineHeight: 1.5 }}>
                                    {lang === 'de'
                                        ? 'Vollständige Feeds erzielen mehr Reichweite und werden schneller freigeschaltet.'
                                        : 'Complete feeds get more reach and faster activation.'}
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
                                    <button type="button" onClick={() => {
                                            const msg = lang === 'de'
                                                ? 'Aktuellen Feed verwerfen und eine neue Datei laden?'
                                                : 'Discard current feed and load a new file?';
                                            if (!window.confirm(msg)) return;
                                            setFile(null); setRows([]); setHeaders([]); setManualMapping({}); setParseError(null);
                                        }}
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
                                    style={{ border: `2px dashed ${dragging ? MC_BLUE : '#D1D5DB'}`, background: dragging ? '#EEF4FF' : '#F9FAFB', borderRadius: 10, padding: '16px 20px', cursor: 'pointer', transition: 'all 0.15s', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 }}
                                >
                                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#EEF3FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ color: MC_BLUE }}>
                                            <path d="M7 17A4.5 4.5 0 017 8h.1A6.5 6.5 0 0120 9.5a4 4 0 010 8H7z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                                            <path d="M12 17v-6m0 0l-2 2m2-2l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                        </svg>
                                    </div>
                                    <div style={{ textAlign: 'left' }}>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{T.dropHeading}</div>
                                        <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>{lang === 'de' ? 'Hierher ziehen oder klicken · CSV · UTF-8' : 'Drag here or click · CSV · UTF-8'}</div>
                                    </div>
                                    <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={(e) => { setParseError(null); parseFile(e.target.files?.[0] || null); }} />
                                </div>
                            )}

                            {parseError && (
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 12px' }}>
                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="8" cy="8" r="7" stroke="#FCA5A5" strokeWidth="1.3"/><path d="M8 5v3.5M8 10.5v.5" stroke="#FCA5A5" strokeWidth="1.4" strokeLinecap="round"/></svg>
                                    <span style={{ fontSize: 12, color: '#991B1B', lineHeight: 1.45 }}>{parseError}</span>
                                </div>
                            )}

                            {/* Warehouse location selector */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
                                    {lang === 'de' ? 'Wo befindet sich Ihr Versandlager?' : 'Where is your warehouse located?'}
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                    {[
                                        {
                                            value: 'germany',
                                            label: lang === 'de' ? 'Innerhalb von Deutschland' : 'Inside Germany',
                                            flag: (
                                                <svg width="22" height="16" viewBox="0 0 22 16" style={{ borderRadius: 2, flexShrink: 0, boxShadow: '0 0 0 1px rgba(0,0,0,0.06)' }}>
                                                    <rect width="22" height="5.33" y="0" fill="#000"/>
                                                    <rect width="22" height="5.33" y="5.33" fill="#D00"/>
                                                    <rect width="22" height="5.34" y="10.66" fill="#FFCE00"/>
                                                </svg>
                                            ),
                                        },
                                        {
                                            value: 'outside_germany',
                                            label: lang === 'de' ? 'In einem anderen EU-Land' : 'In another EU country',
                                            flag: (
                                                <svg width="22" height="16" viewBox="0 0 22 16" style={{ borderRadius: 2, flexShrink: 0, boxShadow: '0 0 0 1px rgba(0,0,0,0.06)' }}>
                                                    <rect width="22" height="16" fill="#003399"/>
                                                    {Array.from({ length: 12 }).map((_, i) => {
                                                        const angle = (i * 30 - 90) * (Math.PI / 180);
                                                        const cx = 11 + Math.cos(angle) * 5;
                                                        const cy = 8 + Math.sin(angle) * 5;
                                                        return <circle key={i} cx={cx} cy={cy} r="0.85" fill="#FFCC00"/>;
                                                    })}
                                                </svg>
                                            ),
                                        },
                                    ].map((opt) => {
                                        const active = storeLocation === opt.value;
                                        return (
                                            <button
                                                key={opt.value}
                                                type="button"
                                                onClick={() => setStoreLocation(opt.value)}
                                                style={{
                                                    padding: '10px 12px',
                                                    border: `1px solid ${active ? MC_BLUE : '#D1D5DB'}`,
                                                    background: active ? '#EEF4FF' : '#FFF',
                                                    borderRadius: 8,
                                                    cursor: 'pointer',
                                                    textAlign: 'left',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 10,
                                                }}
                                            >
                                                {opt.flag}
                                                <span style={{ fontSize: 12, fontWeight: 600, color: active ? MC_BLUE : '#111827', lineHeight: 1.3 }}>{opt.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

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
                                    {lang === 'de' ? 'Beispiel-Feed laden (37 Artikel, inkl. Fehler)' : 'Load example feed (37 items, incl. errors)'}
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

                // Fields for middle (Optional) column: only the ones we actually
                // analyse later (Farbe, Material, Lieferumfang). Brand and
                // description are already in the Pflichtfelder column. The rest
                // of MC_OPTIONAL_COLS go into the collapsible "show more" group.
                const checkedOptionalFields = ['color', 'material', 'delivery_includes'];
                const optionalFieldsMid = checkedOptionalFields;
                const otherOptionalFields = MC_OPTIONAL_COLS.filter((f) => !checkedOptionalFields.includes(f));

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
                                        {T.mainImageLabel}<span style={{ color: '#991B1B', fontWeight: 700 }}>*</span>
                                        <span style={{ fontSize: 9, color: '#9CA3AF', borderRadius: '50%', border: '1px solid #D1D5DB', width: 12, height: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>?</span>
                                    </span>
                                </Tooltip>
                                <div style={{ flex: 1, minWidth: 0, fontSize: 11, padding: '4px 7px', borderRadius: 5, border: `1px solid ${mcImageColumns.length > 0 ? '#D1FAE5' : '#FCA5A5'}`, background: mcImageColumns.length > 0 ? '#F0FDF4' : '#FFF5F5', color: mcImageColumns.length > 0 ? '#166534' : '#991B1B', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {mcImageColumns.length > 0 ? mcImageColumns.join(', ') : T.notDetected}
                                </div>
                            </div>
                        );
                    }

                    const isAvailability = fieldKey === 'availability';
                    const col = isAvailability
                        ? (mcMapping['availability'] || mcMapping['stock_amount'])
                        : mcMapping[fieldKey];
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
                                        {isPflicht && <span style={{ color: '#991B1B', fontWeight: 700, flexShrink: 0 }}>*</span>}
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
                    <div style={{ width: '100%', maxWidth: 1320, overflowX: 'hidden' }}>
                        {mcIsWrongFile ? (
                            <div style={{ padding: '20px', borderRadius: 12, border: '1px solid #FECACA', background: '#FEF2F2', display: 'flex', gap: 12 }}>
                                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0, color: '#991B1B' }}><path d="M10 3L2 17h16L10 3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M10 9v3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><circle cx="10" cy="14.5" r="0.75" fill="currentColor"/></svg>
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
                                            <div style={{ fontSize: 12, color: '#991B1B', fontWeight: 600 }}>{T.mappingMissing(missingPflicht2.length)}</div>
                                        )}
                                    </div>
                                    {missingPflicht2.length > 0 && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#991B1B' }}>
                                            <span style={{ color: '#991B1B', fontWeight: 700 }}>*</span>
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
                                        return (
                                            <div style={{ padding: '12px 14px', borderRight: '1px solid #F3F4F6', minWidth: 0, overflowX: 'hidden' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                                    <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.06em' }}>
                                                        {langDE ? 'OPTIONALE FELDER' : 'OPTIONAL FIELDS'}
                                                    </div>
                                                    <div style={{ fontSize: 10, color: '#9CA3AF' }}>
                                                        {optionalFieldsMid.filter((f) => !!mcMapping[f]).length}/{optionalFieldsMid.length} {langDE ? 'zugeordnet' : 'mapped'}
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                                    {optionalFieldsMid.map((f) => (
                                                        <MappingRow key={f} fieldKey={f} label={FIELD_LABELS[f] || f} isPflicht={false} />
                                                    ))}
                                                    {optionalExpanded && otherOptionalFields.map((f) => (
                                                        <MappingRow key={f} fieldKey={f} label={FIELD_LABELS[f] || f} isPflicht={false} />
                                                    ))}
                                                </div>
                                                {otherOptionalFields.length > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setOptionalExpanded((v) => !v)}
                                                        style={{ marginTop: 8, width: '100%', padding: '5px 8px', background: 'none', border: '1px dashed #D1D5DB', borderRadius: 5, fontSize: 11, color: '#6B7280', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                                                    >
                                                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" style={{ transform: optionalExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}><path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                                        {optionalExpanded
                                                            ? (langDE ? 'Weitere Felder ausblenden' : 'Hide additional fields')
                                                            : (langDE ? `${otherOptionalFields.length} weitere Felder anzeigen` : `Show ${otherOptionalFields.length} more fields`)}
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
                                            <div style={{ fontSize: 12, color: '#166534', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                                                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8l4 4 6-6" stroke="#166534" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                                {langDE ? 'Alle Pflichtfelder zugeordnet' : 'All required fields mapped'}
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                                {missingPflicht2.map((f) => {
                                                    const label = f === 'image_url' ? (langDE ? 'Hauptbild' : 'Main Image') : (FIELD_LABELS[f] || f);
                                                    return (
                                                        <div key={f} style={{ fontSize: 11, display: 'flex', alignItems: 'flex-start', gap: 5, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 5, padding: '5px 8px' }}>
                                                            <span style={{ color: '#991B1B', fontWeight: 700, flexShrink: 0, marginTop: 1 }}>✕</span>
                                                            <div>
                                                                <div style={{ color: '#991B1B', fontWeight: 600 }}>{label}</div>
                                                                <div style={{ color: '#B91C1C', fontSize: 10 }}>{langDE ? 'nicht zugeordnet' : 'not assigned'}</div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                                <div style={{ fontSize: 10, color: '#92400E', background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 5, padding: '6px 8px', marginTop: 4, lineHeight: 1.5 }}>
                                                    {T.mappingWarning}
                                                </div>
                                            </div>
                                        )}
                                        {/* Detected fields summary - split by Pflicht / Optional */}
                                        {(() => {
                                            const detectedPflicht = MC_PFLICHT_COLS.filter((f) => f !== 'stock_amount' && (f === 'image_url' ? mcImageColumns.length > 0 : f === 'availability' ? (mcMapping.availability || mcMapping.stock_amount || alwaysAvailable) : mcMapping[f]));
                                            const detectedOptional = optionalFieldsMid.filter((f) => !!mcMapping[f]);
                                            const renderRow = (f) => {
                                                const col = f === 'image_url' ? mcImageColumns[0] : f === 'availability' ? (mcMapping.availability || mcMapping.stock_amount || (alwaysAvailable ? (langDE ? 'Immer verfügbar' : 'Always available') : null)) : mcMapping[f];
                                                const lbl = f === 'image_url' ? (langDE ? 'Hauptbild' : 'Main Image') : (FIELD_LABELS[f] || f);
                                                return (
                                                    <div key={f} style={{ fontSize: 10, display: 'flex', alignItems: 'baseline', gap: 3 }}>
                                                        <span style={{ color: '#166534', fontWeight: 700, flexShrink: 0 }}>✓</span>
                                                        <span style={{ color: '#374151' }}>{lbl}</span>
                                                        {col && <span style={{ color: '#9CA3AF', fontSize: 9 }}>→ {col}</span>}
                                                    </div>
                                                );
                                            };
                                            return (
                                                <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                                                    <div>
                                                        <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.06em', marginBottom: 6 }}>
                                                            {langDE ? 'ERKANNT · PFLICHTFELDER' : 'DETECTED · REQUIRED'}
                                                        </div>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                                            {detectedPflicht.length > 0 ? detectedPflicht.slice(0, 8).map(renderRow) : (
                                                                <div style={{ fontSize: 10, color: '#9CA3AF' }}>{langDE ? 'Keine erkannt' : 'None detected'}</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.06em', marginBottom: 6 }}>
                                                            {langDE ? 'ERKANNT · OPTIONALE FELDER' : 'DETECTED · OPTIONAL'}
                                                        </div>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                                            {detectedOptional.length > 0 ? detectedOptional.map(renderRow) : (
                                                                <div style={{ fontSize: 10, color: '#9CA3AF' }}>{langDE ? 'Keine erkannt' : 'None detected'}</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>

                                {/* Bottom nav */}
                                <div style={{ padding: '10px 20px', borderTop: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                                    <div style={{ fontSize: 11, color: (issues?.missingPflichtCols?.length ?? 0) > 0 ? '#991B1B' : '#166534', fontWeight: 600 }}>
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

                const imgDistribution = mcImageColumns.length > 0 ? (() => {
                    const dist = {};
                    let totalRows = 0;
                    rows.forEach((r) => {
                        totalRows++;
                        const cnt = mcImageColumns.reduce((s, col) => s + (String(r[col] ?? '').trim() ? 1 : 0), 0);
                        dist[cnt] = (dist[cnt] || 0) + 1;
                    });
                    return { dist, totalRows };
                })() : null;
                const eanColImg = mcMapping.ean;
                const nameColImg = mcMapping.name;

                // Build per-type error breakdown for sidebar
                const eanCol3 = mcMapping.ean;
                const nameCol3 = mcMapping.name;
                const getEansFromRowSet = (rowNumSet, max = 5) => {
                    if (!eanCol3 || !rowNumSet) return [];
                    const result = [];
                    for (const rn of rowNumSet) {
                        const ean = String(rows[rn - 1]?.[eanCol3] ?? '').trim();
                        const name = nameCol3 ? String(rows[rn - 1]?.[nameCol3] ?? '').trim() : '';
                        if (ean && !result.find(r => r.ean === ean)) result.push({ ean, name });
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
                    if (e.ean && errorsByType[key].sampleEans.length < 5 && !errorsByType[key].sampleEans.find(s => s.ean === e.ean)) {
                        const nameAtRow = nameCol3 ? String(rows[e.row - 1]?.[nameCol3] ?? '').trim() : '';
                        errorsByType[key].sampleEans.push({ ean: e.ean, name: nameAtRow });
                    }
                });
                if (issues.eanDupRows.size > 0) errorsByType['ean::dup'] = { label: T.csvEanDup, count: issues.eanDupRows.size, sampleEans: getEansFromRowSet(issues.eanDupRows) };
                if (issues.nameDupRows.size > 0) errorsByType['name::dup'] = { label: T.csvNameDup, count: issues.nameDupRows.size, sampleEans: getEansFromRowSet(issues.nameDupRows) };
                if (issues.offerIdDupRows && issues.offerIdDupRows.size > 0) errorsByType['seller_offer_id::dup'] = { label: T.csvOfferIdDup, count: issues.offerIdDupRows.size, sampleEans: getEansFromRowSet(issues.offerIdDupRows) };
                const detailedErrors = Object.values(errorsByType)
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 7);

                // Per-field, per-type breakdown used in the field table rows
                const fieldErrorDetails = {};
                issues.pflichtErrors.forEach((e) => {
                    const k = e.field === 'stock_amount' ? 'availability' : e.field;
                    if (!fieldErrorDetails[k]) fieldErrorDetails[k] = {};
                    if (!fieldErrorDetails[k][e.type]) fieldErrorDetails[k][e.type] = { count: 0, samples: [] };
                    fieldErrorDetails[k][e.type].count++;
                    if (fieldErrorDetails[k][e.type].samples.length < 200) {
                        const nm = nameCol3 ? String(rows[e.row - 1]?.[nameCol3] ?? '').trim() : '';
                        fieldErrorDetails[k][e.type].samples.push({ ean: e.ean, value: e.value, name: nm });
                    }
                });
                [
                    ['ean', issues.eanDupRows, eanCol3],
                    ['name', issues.nameDupRows, nameCol3],
                    ['seller_offer_id', issues.offerIdDupRows, mcMapping.seller_offer_id],
                ].forEach(([field, dupSet, col]) => {
                    if (!dupSet?.size) return;
                    if (!fieldErrorDetails[field]) fieldErrorDetails[field] = {};
                    fieldErrorDetails[field].dup = { count: dupSet.size, samples: [] };
                    for (const rn of dupSet) {
                        if (fieldErrorDetails[field].dup.samples.length >= 200) break;
                        const ean = eanCol3 ? String(rows[rn - 1]?.[eanCol3] ?? '').trim() : '';
                        const val = col ? String(rows[rn - 1]?.[col] ?? '').trim() : '';
                        const nm = nameCol3 ? String(rows[rn - 1]?.[nameCol3] ?? '').trim() : '';
                        fieldErrorDetails[field].dup.samples.push({ ean, value: val, name: nm });
                    }
                });

                const errTypeLabel = (type) => lang === 'de' ? ({
                    missing: 'Fehlend', placeholder: 'Platzhalter', too_short: 'Zu kurz', one_word: 'Einwortig',
                    bware: 'B-Ware', wrong_length: 'Ungültige Länge', invalid: 'Ungültiger Wert',
                    scientific: 'Wiss. Notation', siehe_oben: 'Querverweis', external_link: 'Ext. Link',
                    template: 'Mustertext', advertising: 'Werbetext', identical_to_title: '= Titel',
                    dup: 'Doppelt', single: 'Nur 1 Bild', wrong_category: 'Falsche Kat.',
                }[type] ?? type) : ({
                    missing: 'Missing', placeholder: 'Placeholder', too_short: 'Too short', one_word: 'Single word',
                    bware: 'B-grade', wrong_length: 'Invalid length', invalid: 'Invalid value',
                    scientific: 'Sci. notation', siehe_oben: 'Cross-ref', external_link: 'Ext. link',
                    template: 'Template', advertising: 'Ad text', identical_to_title: '= Title',
                    dup: 'Duplicate', single: 'Only 1 image', wrong_category: 'Wrong cat.',
                }[type] ?? type);

                const errTypeDesc = (type) => lang === 'de' ? ({
                    missing: 'Pflichtfeld nicht befüllt',
                    placeholder: 'Platzhalterwert hinterlegt (z. B. "n/a", "test")',
                    too_short: 'Wert enthält zu wenig Informationen',
                    one_word: 'Nur ein einzelnes Wort erfasst',
                    bware: '"B-Ware"-Kennzeichnung erkannt',
                    wrong_length: 'Wert entspricht nicht der erforderlichen Länge',
                    invalid: 'Wert hat ein ungültiges Format',
                    scientific: 'EAN in wissenschaftlicher Notation',
                    siehe_oben: '"siehe oben" als Artikelname verwendet',
                    external_link: 'Externe URL in der Beschreibung gefunden',
                    template: 'Mustertext (Lorem Ipsum o. Ä.) erkannt',
                    advertising: 'Werbephrasen in der Beschreibung',
                    identical_to_title: 'Beschreibung identisch zum Titel',
                    dup: 'Doppelte Einträge erkannt',
                    single: 'Artikel haben nur ein einziges Hauptbild statt der empfohlenen Mehrfachansicht',
                    wrong_category: 'Kategoriepfad gehört nicht zum Möbel-Sortiment',
                }[type] ?? '') : ({
                    missing: 'Required field is empty',
                    placeholder: 'Placeholder value used (e.g. "n/a", "test")',
                    too_short: 'Value contains too little information',
                    one_word: 'Only a single word entered',
                    bware: '"B-grade" marker detected',
                    wrong_length: 'Value does not match the required length',
                    invalid: 'Value has an invalid format',
                    scientific: 'EAN in scientific notation',
                    siehe_oben: '"see above" used as item name',
                    external_link: 'External URL found in the description',
                    template: 'Template text (Lorem Ipsum etc.) detected',
                    advertising: 'Advertising phrases in the description',
                    identical_to_title: 'Description identical to title',
                    dup: 'Duplicate entries detected',
                    single: 'Items only have a single main image instead of the recommended multi-view',
                    wrong_category: 'Category path is not part of the furniture assortment',
                }[type] ?? '');

                const fieldHint = (field) => lang === 'de' ? ({
                    name: 'Einige Artikel haben unvollständige oder zu kurze Titel',
                    ean: 'Einige Artikel haben fehlende oder ungültige EANs',
                    description: 'Einige Beschreibungen sind zu kurz oder enthalten unzulässige Inhalte',
                    brand: 'Einige Artikel haben keine eindeutige Markenangabe',
                    price: 'Einige Artikel haben einen ungültigen oder fehlenden Preis',
                    shipping_mode: 'Einige Artikel haben keine gültige Versandart',
                    image_url: 'Einige Produkte haben nicht genug oder kein Hauptbild',
                    availability: 'Einige Artikel haben keinen Bestand oder Verfügbarkeitsstatus',
                    stock_amount: 'Einige Artikel haben keinen gültigen Lagerbestand',
                    delivery_time: 'Einige Artikel haben keine oder eine ungültige Lieferzeit',
                    seller_offer_id: 'Einige Artikel haben keine eindeutige interne Artikel-ID',
                    hs_code: 'Einige Artikel haben keinen HS-Code (Pflicht für EU-Lager)',
                    category_path: 'Einige Artikel haben eine ungültige Kategorie zugeordnet',
                    color: 'Einige Artikel haben keine Farbangabe, wichtig für Filter & Suche',
                    material: 'Einige Artikel haben keine Materialangabe, wichtig für Filterung',
                    delivery_includes: 'Einige Artikel haben keinen Lieferumfang hinterlegt',
                }[field] ?? '') : ({
                    name: 'Some items have incomplete or too short titles',
                    ean: 'Some items are missing or have invalid EANs',
                    description: 'Some descriptions are too short or contain disallowed content',
                    brand: 'Some items have no clear brand value',
                    price: 'Some items have an invalid or missing price',
                    shipping_mode: 'Some items have no valid shipping mode',
                    image_url: 'Some products do not have enough images or no main image',
                    availability: 'Some items have no stock or availability status',
                    stock_amount: 'Some items have no valid stock count',
                    delivery_time: 'Some items have no or an invalid delivery time',
                    seller_offer_id: 'Some items have no unique internal item ID',
                    hs_code: 'Some items have no HS code (required for EU warehouses)',
                    category_path: 'Some items have an invalid category assignment',
                    color: 'Some items have no color specified, important for filtering & search',
                    material: 'Some items have no material, important for filtering',
                    delivery_includes: 'Some items have no delivery scope set',
                }[field] ?? '');

                // Description length distribution
                const descCol = mcMapping['description'];
                const descStats = rows.length > 0 ? (() => {
                    const buckets = { none: 0, short: 0, ok: 0, good: 0 };
                    let total = 0, totalChars = 0;
                    rows.forEach((r) => {
                        total++;
                        const len = descCol ? String(r[descCol] ?? '').trim().length : 0;
                        totalChars += len;
                        if (len === 0) buckets.none++;
                        else if (len < 100) buckets.short++;
                        else if (len < 300) buckets.ok++;
                        else buckets.good++;
                    });
                    return { total, avg: total ? Math.round(totalChars / total) : 0, buckets };
                })() : null;

                // Title length distribution
                const nameCol = mcMapping['name'];
                const titleStats = rows.length > 0 ? (() => {
                    const buckets = { none: 0, short: 0, ok: 0, good: 0 };
                    let total = 0, totalChars = 0;
                    rows.forEach((r) => {
                        total++;
                        const len = nameCol ? String(r[nameCol] ?? '').trim().length : 0;
                        totalChars += len;
                        if (len === 0) buckets.none++;
                        else if (len < 30) buckets.short++;
                        else if (len < 80) buckets.ok++;
                        else buckets.good++;
                    });
                    return { total, avg: total ? Math.round(totalChars / total) : 0, buckets };
                })() : null;

                // Title structure analysis
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

                const listablePct = issues.totalRows > 0 ? Math.round((issues.livefaehigCount / issues.totalRows) * 100) : 0;

                const score = issues.totalScore;
                const scoreColor = score >= 85 ? P_GREEN_TEXT : score >= 60 ? P_ORANGE_TEXT : P_RED_TEXT;
                const scoreBg = score >= 85 ? P_GREEN_BG : score >= 60 ? P_ORANGE_BG : P_RED_BG;

                return (
                    <div style={{ width: '100%', maxWidth: 1320, display: 'flex', flexDirection: 'column', gap: 12 }}>

                        {/* 2-column: table | action panel */}
                        <div className="mc-two-col-320" style={{ alignItems: 'start' }}>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                        {/* Field analysis table */}
                        <div style={{ background: '#FFF', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
                            <div style={{ padding: '12px 16px 10px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'sticky', top: 0, background: '#FFF', zIndex: 1, gap: 12 }}>
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{T.analysisTitle}</div>
                                    <div style={{ fontSize: 11, color: '#6B7280', marginTop: 1 }}>{T.analysisSubtitle}</div>
                                </div>
                                <div style={{ fontSize: 10, color: '#6B7280', textAlign: 'right', flexShrink: 0, marginTop: 2 }}>
                                    {T.analysisSummary(totalPflichtFields, vollstaendigFields, totalPflichtFields - vollstaendigFields)}
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px 120px', padding: '5px 16px', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.05em' }}>{T.colField}</div>
                                <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.05em', textAlign: 'right' }}>{T.colStatus}</div>
                                <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.05em', paddingLeft: 12 }}>{T.colCoverage}</div>
                            </div>
                            {[...PFLICHT_TABLE_FIELDS]
                                .map(({ key, label }) => {
                                    const isMapped = key === 'availability'
                                        ? (alwaysAvailable || !!(mcMapping.availability || mcMapping.stock_amount))
                                        : key === 'image_url' ? mcImageColumns.length > 0
                                        : !!mcMapping[key];
                                    const errs = (key === 'availability' && alwaysAvailable) ? 0 : (fieldErrorRows[key]?.size || 0);
                                    const pct = isMapped ? Math.max(0, Math.round((1 - errs / issues.totalRows) * 100)) : null;
                                    // Sort key: errors-first, then by pct ascending; clean fields after; not-mapped last.
                                    const notMappedField = pct === null;
                                    const sortRank = notMappedField ? 3000 : errs > 0 ? pct : 2000 + pct;
                                    return { key, label, sortRank };
                                })
                                .sort((a, b) => a.sortRank - b.sortRank)
                                .map(({ key, label }) => {
                                const isMapped = key === 'availability'
                                    ? (alwaysAvailable || !!(mcMapping.availability || mcMapping.stock_amount))
                                    : key === 'image_url' ? mcImageColumns.length > 0
                                    : !!mcMapping[key];
                                const errs = (key === 'availability' && alwaysAvailable) ? 0 : (fieldErrorRows[key]?.size || 0);
                                const pct = isMapped ? Math.max(0, Math.round((1 - errs / issues.totalRows) * 100)) : null;
                                const hasError = pct !== null && errs > 0;
                                const barColor = pct === null ? '#E5E7EB' : errs === 0 ? P_GREEN : pct >= 70 ? P_ORANGE : P_RED;
                                const mappedCol = key === 'availability'
                                    ? (mcMapping.availability || mcMapping.stock_amount)
                                    : key === 'image_url' ? mcImageColumns[0]
                                    : mcMapping[key];
                                // Sample values shown next to the field label - real values from
                                // the mapped column. For ean, this is identical to the row identifier.
                                const exampleVals = !hasError && mappedCol
                                    ? [...new Set(rows.slice(0, 30).map(r => String(r[mappedCol] ?? '').trim()).filter(Boolean))].slice(0, 3)
                                    : [];
                                // Always show EAN identifiers for affected rows so users can find them.
                                // For the ean field itself, show the bad EAN value; for all others show the EAN column value.
                                const isRowExpanded = hasError && expandedFieldExamples.has(key);
                                const toggleRow = () => {
                                    if (!hasError) return;
                                    setExpandedFieldExamples((prev) => {
                                        const next = new Set(prev);
                                        if (next.has(key)) next.delete(key); else next.add(key);
                                        return next;
                                    });
                                };
                                const subgroupEntries = hasError && fieldErrorDetails[key] ? Object.entries(fieldErrorDetails[key]) : [];
                                return (
                                    <div key={key} style={{ borderBottom: '3px solid #FFFFFF', background: hasError ? (barColor === P_RED ? P_RED_BG : P_ORANGE_BG) : 'transparent', borderLeft: hasError ? `3px solid ${barColor}` : '3px solid transparent' }}>
                                        <div
                                            onClick={toggleRow}
                                            style={{ display: 'grid', gridTemplateColumns: '1fr 200px 120px', padding: '8px 16px', alignItems: 'center', cursor: hasError ? 'pointer' : 'default', userSelect: 'none' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <div style={{ fontSize: 12, color: hasError ? (barColor === P_RED ? P_RED_TEXT : P_ORANGE_TEXT) : '#374151', fontWeight: hasError ? 700 : 500, flexShrink: 0 }}>{label}</div>
                                                    {!hasError && exampleVals.length > 0 && (
                                                        <div style={{ display: 'flex', gap: 4, flexWrap: 'nowrap', overflow: 'hidden', maxWidth: 220 }}>
                                                            {exampleVals.slice(0, 2).map((v, i) => (
                                                                <span key={i} style={{ fontSize: 9, color: '#6B7280', background: '#F3F4F6', borderRadius: 3, padding: '1px 5px', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block', flexShrink: 0 }}>{v}</span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                <div style={{ fontSize: 11, color: '#6B7280', lineHeight: 1.35 }}>
                                                    {hasError ? fieldHint(key) : (lang === 'de' ? 'Alle Artikel erfüllen die Anforderungen' : 'All items meet the requirements')}
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right', minWidth: 0 }}>
                                                {pct === null ? <span style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF' }}>{T.notInFeed}</span>
                                                    : errs === 0 ? <span style={{ fontSize: 11, fontWeight: 600, color: P_GREEN_TEXT }}>{T.complete}</span>
                                                    : (
                                                        <>
                                                            <div style={{ fontSize: 12, fontWeight: 700, color: barColor === P_RED ? P_RED_TEXT : P_ORANGE_TEXT }}>
                                                                {T.missingCount(errs.toLocaleString(numLocale))}
                                                            </div>
                                                            <div style={{ fontSize: 10, color: '#6B7280', lineHeight: 1.35, marginTop: 1 }}>
                                                                {subgroupEntries.map(([type, { count }]) => `${count.toLocaleString(numLocale)}× ${errTypeLabel(type)}`).join(' · ')}
                                                            </div>
                                                        </>
                                                    )}
                                            </div>
                                            <div style={{ paddingLeft: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                {pct !== null ? (
                                                    <>
                                                        <div style={{ flex: 1, height: 5, background: '#F3F4F6', borderRadius: 3, overflow: 'hidden' }}>
                                                            <div style={{ height: '100%', width: `${errs > 0 ? Math.min(99, pct) : pct}%`, background: barColor, borderRadius: 3, transition: 'width 0.4s' }} />
                                                        </div>
                                                        <span style={{ fontSize: 10, color: '#6B7280', width: 28, textAlign: 'right', flexShrink: 0 }}>{errs > 0 ? Math.min(99, pct) : pct}%</span>
                                                    </>
                                                ) : <span style={{ fontSize: 9, color: '#D1D5DB', flex: 1 }}>-</span>}
                                                {hasError ? (
                                                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, color: '#9CA3AF', transform: isRowExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
                                                        <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                                                    </svg>
                                                ) : <span style={{ width: 12, flexShrink: 0 }} />}
                                            </div>
                                        </div>
                                        {isRowExpanded && subgroupEntries.length > 0 && (
                                            <div style={{ padding: '4px 16px 14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                                                {subgroupEntries.map(([type, { count, samples }], idx) => {
                                                    const sgKey = `${key}::${type}`;
                                                    const sgOpen = expandedFieldSubgroups.has(sgKey);
                                                    const toggleSg = (e) => {
                                                        e.stopPropagation();
                                                        setExpandedFieldSubgroups((prev) => {
                                                            const next = new Set(prev);
                                                            if (next.has(sgKey)) next.delete(sgKey); else next.add(sgKey);
                                                            return next;
                                                        });
                                                    };
                                                    return (
                                                        <div key={type} style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: idx === 0 ? 0 : 8, borderTop: idx === 0 ? 'none' : '1px dashed #E5E7EB' }}>
                                                            <div onClick={toggleSg} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
                                                                <span style={{ fontSize: 10, fontWeight: 700, background: '#FFF', color: barColor === P_RED ? P_RED_TEXT : P_ORANGE_TEXT, border: `1px solid ${barColor}`, borderRadius: 4, padding: '2px 8px', flexShrink: 0, whiteSpace: 'nowrap' }}>
                                                                    {errTypeLabel(type)} · {count.toLocaleString(numLocale)}×
                                                                </span>
                                                                <span style={{ fontSize: 11, color: '#374151', flex: 1, minWidth: 0 }}>
                                                                    {errTypeDesc(type) || (lang === 'de' ? `${count.toLocaleString(numLocale)} betroffene Artikel` : `${count.toLocaleString(numLocale)} affected items`)}
                                                                </span>
                                                                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: '#6B7280', letterSpacing: '0.04em', flexShrink: 0 }}>
                                                                    {count.toLocaleString(numLocale)} {lang === 'de' ? 'ANZEIGEN' : 'SHOW'}
                                                                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ color: '#9CA3AF', transform: sgOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
                                                                        <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                                                                    </svg>
                                                                </span>
                                                            </div>
                                                            {sgOpen && samples.length > 0 && (
                                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
                                                                    {samples.map((s, i) => (
                                                                        <div key={i} title={s.value || s.name || s.ean} style={{ background: '#FFF', border: '1px solid #E5E7EB', borderRadius: 6, padding: '8px 10px', minWidth: 0 }}>
                                                                            <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.ean || '-'}</div>
                                                                            <div style={{ fontSize: 12, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
                                                                                {s.name || (s.value ? <span style={{ fontFamily: 'monospace', color: P_RED_TEXT }}>"{s.value}"</span> : <span style={{ color: '#9CA3AF', fontStyle: 'italic' }}>{lang === 'de' ? '(kein Name)' : '(no name)'}</span>)}
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                    {count > samples.length && (
                                                                        <div style={{ background: '#FFF', border: '1px dashed #E5E7EB', borderRadius: 6, padding: '8px 10px', fontSize: 11, color: '#9CA3AF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                            {lang === 'de' ? `… und ${(count - samples.length).toLocaleString(numLocale)} weitere` : `… and ${(count - samples.length).toLocaleString(numLocale)} more`}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Title and description length charts side by side */}
                        {(titleStats?.total > 0 || descStats?.total > 0) && (() => {
                            const eanCol = mcMapping['ean'];
                            const titleBuckets = [
                                { key: 'none',  label: lang === 'de' ? 'Leer' : 'Empty',     sub: lang === 'de' ? 'Pflichtfeld nicht befüllt' : 'Required field empty',         color: '#EF4444', match: (l) => l === 0 },
                                { key: 'short', label: lang === 'de' ? 'Zu kurz' : 'Too short', sub: lang === 'de' ? 'unter 30 Zeichen, kaum auffindbar' : 'under 30 characters, hard to find', color: '#F59E0B', match: (l) => l > 0 && l < 30 },
                                { key: 'ok',    label: lang === 'de' ? 'Akzeptabel' : 'Acceptable',  sub: lang === 'de' ? '30–79 Zeichen, geht, aber kürzer als ideal' : '30–79 characters, okay, but shorter than ideal',  color: '#60A5FA', match: (l) => l >= 30 && l < 80 },
                                { key: 'good',  label: lang === 'de' ? 'Optimal' : 'Optimal',   sub: lang === 'de' ? '80+ Zeichen, gute Auffindbarkeit' : '80+ characters, good searchability',   color: '#166534', match: (l) => l >= 80 },
                            ];
                            const descBuckets = [
                                { key: 'none',  label: lang === 'de' ? 'Leer' : 'Empty',         sub: lang === 'de' ? 'Pflichtfeld nicht befüllt' : 'Required field empty',          color: '#EF4444', match: (l) => l === 0 },
                                { key: 'short', label: lang === 'de' ? 'Zu kurz' : 'Too short',   sub: lang === 'de' ? 'unter 100 Zeichen, zu wenig Produktinfos' : 'under 100 characters, too little product info',   color: '#F59E0B', match: (l) => l > 0 && l < 100 },
                                { key: 'ok',    label: lang === 'de' ? 'Akzeptabel' : 'Acceptable',  sub: lang === 'de' ? '100–299 Zeichen, geht, mehr Details wären besser' : '100–299 characters, okay, more detail would help',  color: '#60A5FA', match: (l) => l >= 100 && l < 300 },
                                { key: 'good',  label: lang === 'de' ? 'Optimal' : 'Optimal',     sub: lang === 'de' ? '300+ Zeichen, gute Conversion-Basis' : '300+ characters, strong conversion baseline',     color: '#166534', match: (l) => l >= 300 },
                            ];
                            const buildMatches = (col, buckets, selected) => {
                                if (!col || !selected) return null;
                                const bucket = buckets.find((b) => b.key === selected);
                                if (!bucket) return null;
                                const list = [];
                                rows.forEach((r) => {
                                    const value = String(r[col] ?? '');
                                    const len = value.trim().length;
                                    if (bucket.match(len)) {
                                        list.push({
                                            ean: eanCol ? String(r[eanCol] ?? '').trim() : '',
                                            name: mcMapping['name'] ? String(r[mcMapping['name']] ?? '').trim() : '',
                                            value,
                                            len,
                                        });
                                    }
                                });
                                return { bucket, list };
                            };
                            const titleSel = buildMatches(nameCol, titleBuckets, titleBucket);
                            const descSel = buildMatches(descCol, descBuckets, descBucket);
                            const renderList = (sel, setBucket) => {
                                if (!sel) return null;
                                const { bucket, list } = sel;
                                return (
                                    <div style={{ marginTop: 12, borderTop: '1px solid #F3F4F6', paddingTop: 10 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: '#111827' }}>
                                                <span style={{ width: 8, height: 8, borderRadius: 2, background: bucket.color, display: 'inline-block' }} />
                                                {bucket.label} · {list.length.toLocaleString(numLocale)} {lang === 'de' ? 'Artikel' : 'items'}
                                            </div>
                                            <button type="button" onClick={() => setBucket(null)}
                                                style={{ fontSize: 10, color: '#6B7280', background: 'none', border: '1px solid #E5E7EB', borderRadius: 5, padding: '2px 7px', cursor: 'pointer' }}>
                                                {lang === 'de' ? 'Schließen' : 'Close'}
                                            </button>
                                        </div>
                                        {list.length === 0 ? (
                                            <div style={{ fontSize: 11, color: '#9CA3AF', padding: '8px 0' }}>{lang === 'de' ? 'Keine Artikel in dieser Kategorie.' : 'No items in this category.'}</div>
                                        ) : (
                                            <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid #F3F4F6', borderRadius: 6 }}>
                                                {list.slice(0, 200).map((item, i) => (
                                                    <div key={i}
                                                        title={item.value}
                                                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderBottom: i < Math.min(list.length, 200) - 1 ? '1px solid #F3F4F6' : 'none', fontSize: 11 }}>
                                                        <div style={{ fontFamily: 'monospace', color: '#6B7280', fontSize: 10, width: 110, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {item.ean || '-'}
                                                        </div>
                                                        <div style={{ flex: 1, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {item.name || <span style={{ color: '#9CA3AF', fontStyle: 'italic' }}>{lang === 'de' ? '(kein Name)' : '(no name)'}</span>}
                                                        </div>
                                                        <div style={{ fontSize: 10, color: '#9CA3AF', flexShrink: 0 }}>
                                                            {item.len} {lang === 'de' ? 'Z.' : 'ch.'}
                                                        </div>
                                                    </div>
                                                ))}
                                                {list.length > 200 && (
                                                    <div style={{ padding: '6px 10px', fontSize: 10, color: '#9CA3AF', textAlign: 'center', background: '#FAFAFA' }}>
                                                        {lang === 'de' ? `… und ${(list.length - 200).toLocaleString(numLocale)} weitere` : `… and ${(list.length - 200).toLocaleString(numLocale)} more`}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            };
                            const tipsByField = {
                                title: {
                                    heading: lang === 'de' ? 'Tipps für bessere Titel' : 'Tips for better titles',
                                    bad: '"Sofa schwarz"',
                                    good: lang === 'de' ? '"Dreammöbel Ecksofa 3-Sitzer, Kunstleder schwarz, 180 × 90 cm"' : '"Dreammöbel Corner Sofa 3-seater, faux leather black, 180 × 90 cm"',
                                    dos: lang === 'de'
                                        ? ['Marke voranstellen', 'Produktart + Farbe + Maße', 'Mind. 2 Wörter', 'Ziel: 80+ Zeichen']
                                        : ['Brand first', 'Product type + Color + Dimensions', 'Min. 2 words', 'Aim for 80+ characters'],
                                    donts: lang === 'de'
                                        ? ['"B-Ware" / "gebraucht"', 'Nur ein Wort', 'Werbephrasen', 'Platzhalter wie "n/a"']
                                        : ['"used" / "B-stock"', 'Single word only', 'Advertising phrases', 'Placeholders like "n/a"'],
                                },
                                desc: {
                                    heading: lang === 'de' ? 'Tipps für bessere Beschreibungen' : 'Tips for better descriptions',
                                    bad: '"Schönes Sofa."',
                                    good: lang === 'de' ? '"Elegantes Ecksofa aus Kunstleder in Schwarz. Maße: 200 × 80 × 120 cm. Kaltschaum-Polsterung, abnehmbarer Bezug."' : '"Elegant corner sofa made of faux leather in black. Dimensions: 200 × 80 × 120 cm. Cold-foam padding, removable cover."',
                                    dos: lang === 'de'
                                        ? ['Material, Farbe, Maße nennen', 'Konkrete Produktdetails', 'Mind. 100, idealerweise 300+ Zeichen', 'Pflege- und Aufbauhinweise']
                                        : ['State material, color, dimensions', 'Concrete product details', 'Min. 100, ideally 300+ characters', 'Care and assembly notes'],
                                    donts: lang === 'de'
                                        ? ['"günstig", "Top-Qualität"', 'Externe Links / URLs', 'Identisch zum Titel', 'Lorem-Ipsum-Platzhalter']
                                        : ['"cheap", "top quality"', 'External links / URLs', 'Identical to title', 'Lorem-Ipsum placeholders'],
                                },
                            };
                            const renderTips = (fieldKey) => {
                                const tip = tipsByField[fieldKey];
                                if (!tip) return null;
                                const key = `chart_tips_${fieldKey}`;
                                const isOpen = expandedRecs.has(key);
                                const toggle = () => setExpandedRecs((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(key)) next.delete(key); else next.add(key);
                                    return next;
                                });
                                return (
                                    <div style={{ marginTop: 12, borderTop: '1px solid #F3F4F6', paddingTop: 8 }}>
                                        <div onClick={toggle}
                                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, cursor: 'pointer', userSelect: 'none', padding: '4px 2px' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: '#111827' }}>
                                                <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M8 1.5a5 5 0 00-3 9v1.5h6V10.5a5 5 0 00-3-9z" stroke="#F59E0B" strokeWidth="1.3" strokeLinejoin="round"/><path d="M6.5 14h3" stroke="#F59E0B" strokeWidth="1.3" strokeLinecap="round"/></svg>
                                                {tip.heading}
                                            </span>
                                            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ color: '#9CA3AF', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                        </div>
                                        {isOpen && (
                                            <div style={{ marginTop: 6 }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 8 }}>
                                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '6px 9px', background: P_RED_BG, borderRadius: 6, borderLeft: `2px solid ${P_RED}` }}>
                                                        <span style={{ color: P_RED_TEXT, fontSize: 11, fontWeight: 800, lineHeight: 1.2, flexShrink: 0 }}>✗</span>
                                                        <span style={{ fontSize: 10, color: P_RED_TEXT, lineHeight: 1.4, fontStyle: 'italic' }}>{tip.bad}</span>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '6px 9px', background: P_GREEN_BG, borderRadius: 6, borderLeft: `2px solid ${P_GREEN}` }}>
                                                        <span style={{ color: P_GREEN_TEXT, fontSize: 11, fontWeight: 800, lineHeight: 1.2, flexShrink: 0 }}>✓</span>
                                                        <span style={{ fontSize: 10, color: P_GREEN_TEXT, lineHeight: 1.4, fontStyle: 'italic' }}>{tip.good}</span>
                                                    </div>
                                                </div>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                                    <div>
                                                        <div style={{ fontSize: 9, fontWeight: 800, color: P_GREEN_TEXT, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                                            {lang === 'de' ? 'So geht es' : 'Do'}
                                                        </div>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                                            {tip.dos.map((d, j) => (
                                                                <div key={j} style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                                                                    <span style={{ color: P_GREEN_TEXT, fontSize: 10, fontWeight: 800, flexShrink: 0 }}>+</span>
                                                                    <span style={{ fontSize: 10, color: '#374151', lineHeight: 1.4 }}>{d}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: 9, fontWeight: 800, color: P_RED_TEXT, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                                            {lang === 'de' ? 'Vermeiden' : 'Avoid'}
                                                        </div>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                                            {tip.donts.map((d, j) => (
                                                                <div key={j} style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                                                                    <span style={{ color: P_RED_TEXT, fontSize: 10, fontWeight: 800, flexShrink: 0 }}>−</span>
                                                                    <span style={{ fontSize: 10, color: '#374151', lineHeight: 1.4 }}>{d}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            };
                            const renderChart = ({ title, intro, target, stats, buckets, selected, setBucket, labelWidth, fieldKey }) => (
                                <div style={{ background: '#FFF', borderRadius: 12, border: '1px solid #E5E7EB', padding: '14px 16px', minWidth: 0, alignSelf: 'start' }}>
                                    <div style={{ marginBottom: 10 }}>
                                        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{title}</div>
                                            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                                                <div style={{ fontSize: 10, color: '#166534', fontWeight: 600 }}>{lang === 'de' ? `Ziel: ${target} Zeichen` : `Target: ${target} characters`}</div>
                                                <div style={{ fontSize: 10, color: '#9CA3AF' }}>
                                                    {lang === 'de' ? `Ø ${stats.avg.toLocaleString(numLocale)} Zeichen` : `Avg. ${stats.avg.toLocaleString(numLocale)} characters`}
                                                </div>
                                            </div>
                                        </div>
                                        {intro && (
                                            <div style={{ fontSize: 11, color: '#6B7280', lineHeight: 1.45, marginTop: 4 }}>{intro}</div>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        {buckets.map(({ key, label, sub, color }) => {
                                            const cnt = stats.buckets[key];
                                            const pct = stats.total ? Math.round((cnt / stats.total) * 100) : 0;
                                            const isSel = selected === key;
                                            return (
                                                <div key={key}
                                                    onClick={() => setBucket(isSel ? null : key)}
                                                    style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '5px 6px', borderRadius: 6, cursor: 'pointer', background: isSel ? '#EEF4FF' : 'transparent', transition: 'background 0.15s' }}>
                                                    <div style={{ width: labelWidth, flexShrink: 0, textAlign: 'right' }}>
                                                        <div style={{ fontSize: 11, color: '#111827', fontWeight: isSel ? 700 : 600 }}>{label}</div>
                                                        {sub && <div style={{ fontSize: 9, color: '#9CA3AF', lineHeight: 1.3, marginTop: 1 }}>{sub}</div>}
                                                    </div>
                                                    <div style={{ flex: 1, minWidth: 0, paddingTop: 4 }}>
                                                        <div style={{ height: 10, background: '#F3F4F6', borderRadius: 5, overflow: 'hidden' }}>
                                                            <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 5, transition: 'width 0.4s' }} />
                                                        </div>
                                                    </div>
                                                    <div style={{ width: 70, paddingTop: 2, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                                        <div style={{ fontSize: 11, fontWeight: 700, color }}>{cnt.toLocaleString(numLocale)}</div>
                                                        <div style={{ fontSize: 9, color: '#9CA3AF' }}>{pct}%</div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {fieldKey === 'title' && renderList(titleSel, setTitleBucket)}
                                    {fieldKey === 'desc' && renderList(descSel, setDescBucket)}
                                    {renderTips(fieldKey)}
                                </div>
                            );
                            return (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                    {titleStats && titleStats.total > 0 && renderChart({
                                        title: lang === 'de' ? 'Titellänge' : 'Title Length',
                                        intro: lang === 'de'
                                            ? 'Aussagekräftige Titel mit Marke, Produktart und Schlüsselmerkmalen (Maße, Farbe, Material) werden besser gefunden und führen zu mehr Klicks.'
                                            : 'Descriptive titles that combine brand, product type and key attributes (dimensions, color, material) rank better and drive more clicks.',
                                        target: '80+', stats: titleStats, buckets: titleBuckets,
                                        selected: titleBucket, setBucket: setTitleBucket, labelWidth: 130, fieldKey: 'title',
                                    })}
                                    {descStats && descStats.total > 0 && renderChart({
                                        title: lang === 'de' ? 'Beschreibungslänge' : 'Description Length',
                                        intro: lang === 'de'
                                            ? 'Eine detaillierte Beschreibung beantwortet Kundenfragen vor dem Kauf, reduziert Retouren und stärkt das Vertrauen ins Produkt.'
                                            : 'A detailed description answers buyer questions up front, lowers returns, and builds trust in the product.',
                                        target: '300+', stats: descStats, buckets: descBuckets,
                                        selected: descBucket, setBucket: setDescBucket, labelWidth: 140, fieldKey: 'desc',
                                    })}
                                </div>
                            );
                        })()}

                        {/* Bilder analysis */}
                        {imgDistribution && imgDistribution.totalRows > 0 && (() => {
                            const allImgSamples = mcImageColumns.length > 0 ? rows.map((r) => ({
                                name: nameColImg ? String(r[nameColImg] ?? '').trim() : '',
                                ean: eanColImg ? String(r[eanColImg] ?? '').trim() : '',
                                urls: mcImageColumns.map((c) => String(r[c] ?? '').trim()).filter(Boolean),
                                total: mcImageColumns.reduce((s, c) => s + (String(r[c] ?? '').trim() ? 1 : 0), 0),
                            })) : [];

                            const searchTerm = eanSearchImg.trim().toLowerCase();
                            const filteredSamples = allImgSamples
                                .filter((s) => selectedImgCount === null || s.total === selectedImgCount)
                                .filter((s) => !searchTerm || s.ean.toLowerCase().includes(searchTerm) || s.name.toLowerCase().includes(searchTerm))
                                .slice(0, 5);

                            return (
                                <div style={{ background: '#FFF', borderRadius: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #E5E7EB', overflow: 'hidden' }}>
                                    <div style={{ padding: '12px 16px 10px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{lang === 'de' ? 'Bilder' : 'Images'}</div>
                                        <div style={{ marginLeft: 'auto', fontSize: 10, color: P_GREEN_TEXT, background: P_GREEN_BG, border: `1px solid ${P_GREEN}`, borderRadius: 999, padding: '3px 10px', fontWeight: 600 }}>
                                            {lang === 'de' ? `${mcImageColumns.length} Bildspalten` : `${mcImageColumns.length} image columns`}
                                        </div>
                                    </div>
                                    <div style={{ padding: '10px 16px 10px', display: 'flex', flexWrap: 'wrap', gap: 6, borderBottom: '1px solid #F3F4F6' }}>
                                        {[{ cnt: null, label: lang === 'de' ? 'Alle' : 'All', n: imgDistribution.totalRows }]
                                            .concat(Object.entries(imgDistribution.dist).map(([k, v]) => ({ cnt: parseInt(k, 10), label: null, n: v })).sort((a, b) => a.cnt - b.cnt))
                                            .map(({ cnt, label, n }) => {
                                                const isActive = selectedImgCount === cnt;
                                                const isOk = cnt === null || cnt >= 3;
                                                const isWarn = cnt !== null && cnt > 0 && cnt < 3;
                                                const color = isActive ? '#FFF' : isOk ? P_GREEN_TEXT : isWarn ? P_ORANGE_TEXT : P_RED_TEXT;
                                                const bg = isActive ? (isOk ? P_GREEN_TEXT : isWarn ? P_ORANGE_TEXT : P_RED_TEXT) : isOk ? P_GREEN_BG : isWarn ? P_ORANGE_BG : P_RED_BG;
                                                const border = isOk ? P_GREEN : isWarn ? P_ORANGE : P_RED;
                                                const chipLabel = label ?? (lang === 'de' ? `${cnt} ${cnt === 1 ? 'Bild' : 'Bilder'}` : `${cnt} ${cnt === 1 ? 'image' : 'images'}`);
                                                return (
                                                    <button key={String(cnt)} type="button"
                                                        onClick={() => setSelectedImgCount(isActive ? null : cnt)}
                                                        style={{ fontSize: 11, fontWeight: 600, color, background: bg, border: `1px solid ${border}`, borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>
                                                        {chipLabel}: {n}
                                                    </button>
                                                );
                                            })}
                                    </div>
                                    <div style={{ padding: '8px 16px', borderBottom: '1px solid #F3F4F6', position: 'relative' }}>
                                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ position: 'absolute', left: 24, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }}><circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.3"/><path d="M10 10l3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
                                        <input type="text" value={eanSearchImg} onChange={(e) => setEanSearchImg(e.target.value)}
                                            placeholder={lang === 'de' ? 'EAN oder Produktname suchen…' : 'Search EAN or product name…'}
                                            style={{ width: '100%', boxSizing: 'border-box', paddingLeft: 28, paddingRight: 10, paddingTop: 5, paddingBottom: 5, border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 11, outline: 'none', background: '#F9FAFB' }} />
                                    </div>
                                    <div style={{ padding: '8px 16px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        {filteredSamples.length === 0 ? (
                                            <div style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center', padding: '12px 0' }}>
                                                {lang === 'de' ? 'Keine Produkte gefunden.' : 'No products found.'}
                                            </div>
                                        ) : filteredSamples.map((s, i) => (
                                            <div key={i} style={{ border: '1px solid #F3F4F6', borderRadius: 10, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <div style={{ minWidth: 0, flex: 1 }}>
                                                    <div style={{ fontSize: 11, fontWeight: 700, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name || '-'}</div>
                                                    {s.ean && <div style={{ fontSize: 10, color: '#9CA3AF', fontFamily: 'monospace', marginTop: 1 }}>{s.ean}</div>}
                                                    <div style={{ fontSize: 10, color: '#6B7280', marginTop: 1 }}>{lang === 'de' ? `${s.total} Bilder` : `${s.total} images`}</div>
                                                </div>
                                                <div style={{ display: 'flex', gap: 4, flexShrink: 0, marginLeft: 'auto' }}>
                                                    {s.urls.slice(0, 4).map((u, ui) => (
                                                        <img key={ui}
                                                            src={`/api/image-proxy?url=${encodeURIComponent(u)}`}
                                                            alt=""
                                                            onClick={() => setImgModal({ open: true, urls: s.urls, idx: ui })}
                                                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                            style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6, border: '1px solid #E5E7EB', background: '#F9FAFB', cursor: 'zoom-in' }}
                                                        />
                                                    ))}
                                                    {s.urls.length > 4 && (
                                                        <div onClick={() => setImgModal({ open: true, urls: s.urls, idx: 4 })}
                                                            style={{ width: 44, height: 44, borderRadius: 6, border: '1px solid #E5E7EB', background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#6B7280', cursor: 'zoom-in', flexShrink: 0 }}>
                                                            +{s.urls.length - 4}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })()}

                        </div>

                        {/* Right action panel */}
                        <div className="mc-sticky-sidebar" style={{ background: '#FFF', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

                            {/* Sidebar heading */}
                            <div style={{ padding: '14px 16px', borderBottom: '1px solid #F3F4F6' }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>
                                    {lang === 'de' ? 'Ergebnis' : 'Result'}
                                </div>
                                <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 1 }}>
                                    {lang === 'de' ? 'Pflichtfeldabdeckung & Status' : 'Required field coverage & status'}
                                </div>
                            </div>

                            {/* Score progress bar - Pflichtfelder */}
                            {(() => {
                                const s = issues.pflichtScore;
                                const c3 = s >= 90 ? '#16A34A' : s >= 60 ? '#F59E0B' : '#DC2626';
                                return (
                                    <ScoreBar
                                        title={lang === 'de' ? 'Pflichtfeldabdeckung' : 'Required field coverage'}
                                        pct={s}
                                        color={c3}
                                        complete={issues.livefaehigCount}
                                        incomplete={issues.blockiertCount}
                                        total={issues.totalRows}
                                        completeLabel={T.statComplete}
                                        incompleteLabel={lang === 'de' ? 'unvollständig' : 'incomplete'}
                                        totalLabel={T.statTotal}
                                        tipComplete={T.tipComplete}
                                        tipIncomplete={T.tipErrors}
                                        tipTotal={T.tipTotal}
                                        summary={
                                            issues.blockiertCount === 0
                                                ? (lang === 'de'
                                                    ? `Alle ${issues.totalRows.toLocaleString(numLocale)} Artikel sind listbar.`
                                                    : `All ${issues.totalRows.toLocaleString(numLocale)} items are ready to list.`)
                                                : (lang === 'de'
                                                    ? `${issues.livefaehigCount.toLocaleString(numLocale)} von ${issues.totalRows.toLocaleString(numLocale)} Artikeln listbar.`
                                                    : `${issues.livefaehigCount.toLocaleString(numLocale)} of ${issues.totalRows.toLocaleString(numLocale)} items listable.`)
                                        }
                                        numLocale={numLocale}
                                    />
                                );
                            })()}

                            {/* Nav buttons */}
                            <div style={{ padding: '10px 16px', borderTop: '1px solid #F3F4F6', display: 'flex', flexDirection: 'column', gap: 6 }}>
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
                const overallColor = overallPct >= 70 ? '#16A34A' : overallPct >= 40 ? '#F59E0B' : '#DC2626';

                const fieldHint = (field) => lang === 'de' ? ({
                    color: 'Einige Artikel haben keine Farbangabe, wichtig für Filter & Suche',
                    material: 'Einige Artikel haben keine Materialangabe, wichtig für Filterung',
                    delivery_includes: 'Einige Artikel haben keinen Lieferumfang hinterlegt',
                }[field] ?? '') : ({
                    color: 'Some items have no color specified, important for filtering & search',
                    material: 'Some items have no material, important for filtering',
                    delivery_includes: 'Some items have no delivery scope set',
                }[field] ?? '');

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

                // Image distribution per product (granular - per integer count)
                const imgDistribution = mcImageColumns.length > 0 ? (() => {
                    const dist = {};
                    let totalRows = 0;
                    rows.forEach((r) => {
                        totalRows++;
                        const cnt = mcImageColumns.reduce((s, col) => s + (String(r[col] ?? '').trim() ? 1 : 0), 0);
                        dist[cnt] = (dist[cnt] || 0) + 1;
                    });
                    return { dist, totalRows };
                })() : null;

                // Sample products with images (for thumbnails)
                const eanColImg = mcMapping.ean;
                const nameColImg = mcMapping.name;
                const imageSamples = mcImageColumns.length > 0 ? (() => {
                    const samples = [];
                    for (const r of rows) {
                        if (samples.length >= 3) break;
                        const urls = mcImageColumns.map((c) => String(r[c] ?? '').trim()).filter(Boolean);
                        if (urls.length < 1) continue;
                        samples.push({
                            name: nameColImg ? String(r[nameColImg] ?? '').trim() : '',
                            ean: eanColImg ? String(r[eanColImg] ?? '').trim() : '',
                            urls: urls.slice(0, 5),
                            total: urls.length,
                        });
                    }
                    return samples;
                })() : [];

                const totalOptionalFields = optFieldStats.fields.length;
                const completeOptionalFields = optFieldStats.fields.filter(f => !f.notMapped && f.pct === 100).length;
                const errorOptionalFields = optFieldStats.fields.filter(f => !f.notMapped && f.pct < 100).length;

                // Build EAN lookup per optional field from optionalHints (with product name)
                const optHintsByField = {};
                const nameColOpt = mcMapping.name;
                issues.optionalHints.forEach(({ field, ean, row }) => {
                    if (!optHintsByField[field]) optHintsByField[field] = [];
                    if (ean && optHintsByField[field].length < 200 && !optHintsByField[field].find(s => s.ean === ean)) {
                        const nm = nameColOpt ? String(rows[row - 1]?.[nameColOpt] ?? '').trim() : '';
                        optHintsByField[field].push({ ean, name: nm });
                    }
                });

                return (
                    <div style={{ width: '100%', maxWidth: 1320, display: 'flex', flexDirection: 'column', gap: 12 }}>

                        {/* Two-column layout */}
                        <div className="mc-two-col-320" style={{ alignItems: 'start' }}>

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
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px 120px', padding: '5px 16px', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.05em' }}>{T.colField}</div>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.05em', textAlign: 'right' }}>{T.colStatus}</div>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.05em', paddingLeft: 12 }}>{T.colCoverage}</div>
                                    </div>
                                    {[...optFieldStats.fields]
                                        .map(f => {
                                            const fNotMapped = f.notMapped;
                                            const fPct = fNotMapped ? null : f.pct;
                                            const fSortRank = fNotMapped ? 3000 : (fPct < 100 ? fPct : 2000 + fPct);
                                            return { ...f, _sortRank: fSortRank };
                                        })
                                        .sort((a, b) => a._sortRank - b._sortRank)
                                        .map((f) => {
                                        const label = lang === 'de' ? f.labelDE : f.labelEN;
                                        const isMapped = !f.notMapped;
                                        const pct = isMapped ? f.pct : null;
                                        const errs = isMapped ? Math.max(0, f.total - f.covered) : 0;
                                        const hasError = pct !== null && errs > 0;
                                        const barColor = pct === null ? '#E5E7EB' : errs === 0 ? P_GREEN : pct >= 70 ? P_ORANGE : P_RED;
                                        const mappedCol = mcMapping[f.field];
                                        // Real example values from filled rows of this field (always shown if available).
                                        const exampleVals = mappedCol
                                            ? [...new Set(rows.map(r => String(r[mappedCol] ?? '').trim()).filter(Boolean))].slice(0, 3)
                                            : [];
                                        // EAN list for bad rows, shown directly in the table row.
                                        const errorEans4 = hasError ? (optHintsByField[f.field] || []) : [];
                                        const rowKey = `opt::${f.field}`;
                                        const isRowExpanded = hasError && expandedFieldExamples.has(rowKey);
                                        const toggleRow = () => {
                                            if (!hasError) return;
                                            setExpandedFieldExamples((prev) => {
                                                const next = new Set(prev);
                                                if (next.has(rowKey)) next.delete(rowKey); else next.add(rowKey);
                                                return next;
                                            });
                                        };
                                        const sgKey = `${rowKey}::missing`;
                                        const sgOpen = expandedFieldSubgroups.has(sgKey);
                                        const toggleSg = (e) => {
                                            e.stopPropagation();
                                            setExpandedFieldSubgroups((prev) => {
                                                const next = new Set(prev);
                                                if (next.has(sgKey)) next.delete(sgKey); else next.add(sgKey);
                                                return next;
                                            });
                                        };
                                        return (
                                            <div key={f.field} style={{ borderBottom: '3px solid #FFFFFF', background: hasError ? (barColor === P_RED ? P_RED_BG : P_ORANGE_BG) : 'transparent', borderLeft: hasError ? `3px solid ${barColor}` : '3px solid transparent' }}>
                                                <div
                                                    onClick={toggleRow}
                                                    style={{ display: 'grid', gridTemplateColumns: '1fr 200px 120px', padding: '8px 16px', alignItems: 'center', cursor: hasError ? 'pointer' : 'default', userSelect: 'none' }}>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                            <div style={{ fontSize: 12, color: hasError ? (barColor === P_RED ? P_RED_TEXT : P_ORANGE_TEXT) : '#374151', fontWeight: hasError ? 700 : 500, flexShrink: 0 }}>{label}</div>
                                                            {!hasError && exampleVals.length > 0 && (
                                                                <div style={{ display: 'flex', gap: 4, flexWrap: 'nowrap', overflow: 'hidden', maxWidth: 220 }}>
                                                                    {exampleVals.slice(0, 2).map((v, i) => (
                                                                        <span key={i} style={{ fontSize: 9, color: '#6B7280', background: '#F3F4F6', borderRadius: 3, padding: '1px 5px', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block', flexShrink: 0 }}>{v}</span>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div style={{ fontSize: 11, color: '#6B7280', lineHeight: 1.35 }}>
                                                            {hasError ? fieldHint(f.field) : (lang === 'de' ? 'Alle Artikel haben dieses Feld befüllt' : 'All items have this field filled')}
                                                        </div>
                                                    </div>
                                                    <div style={{ textAlign: 'right', minWidth: 0 }}>
                                                        {pct === null ? <span style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF' }}>{T.notInFeed}</span>
                                                            : errs === 0 ? <span style={{ fontSize: 11, fontWeight: 600, color: P_GREEN_TEXT }}>{T.complete}</span>
                                                            : (
                                                                <>
                                                                    <div style={{ fontSize: 12, fontWeight: 700, color: barColor === P_RED ? P_RED_TEXT : P_ORANGE_TEXT }}>
                                                                        {T.missingCount(errs.toLocaleString(numLocale))}
                                                                    </div>
                                                                    <div style={{ fontSize: 10, color: '#6B7280', lineHeight: 1.35, marginTop: 1 }}>
                                                                        {errs.toLocaleString(numLocale)}× {lang === 'de' ? 'Fehlend' : 'Missing'}
                                                                    </div>
                                                                </>
                                                            )}
                                                    </div>
                                                    <div style={{ paddingLeft: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                        {pct !== null ? (
                                                            <>
                                                                <div style={{ flex: 1, height: 5, background: '#F3F4F6', borderRadius: 3, overflow: 'hidden' }}>
                                                                    <div style={{ height: '100%', width: `${errs > 0 ? Math.min(99, pct) : pct}%`, background: barColor, borderRadius: 3, transition: 'width 0.4s' }} />
                                                                </div>
                                                                <span style={{ fontSize: 10, color: '#6B7280', width: 28, textAlign: 'right', flexShrink: 0 }}>{errs > 0 ? Math.min(99, pct) : pct}%</span>
                                                            </>
                                                        ) : <span style={{ fontSize: 9, color: '#D1D5DB', flex: 1 }}>-</span>}
                                                        {hasError ? (
                                                            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, color: '#9CA3AF', transform: isRowExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
                                                                <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                                                            </svg>
                                                        ) : <span style={{ width: 12, flexShrink: 0 }} />}
                                                    </div>
                                                </div>
                                                {isRowExpanded && errorEans4.length > 0 && (
                                                    <div style={{ padding: '4px 16px 14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                        <div onClick={toggleSg} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
                                                            <span style={{ fontSize: 10, fontWeight: 700, background: '#FFF', color: barColor === P_RED ? P_RED_TEXT : P_ORANGE_TEXT, border: `1px solid ${barColor}`, borderRadius: 4, padding: '2px 8px', flexShrink: 0, whiteSpace: 'nowrap' }}>
                                                                {lang === 'de' ? 'Fehlend' : 'Missing'} · {errs.toLocaleString(numLocale)}×
                                                            </span>
                                                            <span style={{ fontSize: 11, color: '#374151', flex: 1, minWidth: 0 }}>
                                                                {lang === 'de' ? `${label} ist nicht befüllt, optionales Feld leer` : `${label} is empty, optional field not filled`}
                                                            </span>
                                                            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: '#6B7280', letterSpacing: '0.04em', flexShrink: 0 }}>
                                                                {errs.toLocaleString(numLocale)} {lang === 'de' ? 'ANZEIGEN' : 'SHOW'}
                                                                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ color: '#9CA3AF', transform: sgOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
                                                                    <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                                                                </svg>
                                                            </span>
                                                        </div>
                                                        {sgOpen && (
                                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
                                                                {errorEans4.map((item, i) => {
                                                                    const ean = typeof item === 'string' ? item : item.ean;
                                                                    const name = typeof item === 'string' ? '' : (item.name || '');
                                                                    return (
                                                                        <div key={i} title={name || ean} style={{ background: '#FFF', border: '1px solid #E5E7EB', borderRadius: 6, padding: '8px 10px', minWidth: 0 }}>
                                                                            <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ean || '-'}</div>
                                                                            <div style={{ fontSize: 12, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
                                                                                {name || <span style={{ color: '#9CA3AF', fontStyle: 'italic' }}>{lang === 'de' ? '(kein Name)' : '(no name)'}</span>}
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                                {errs > errorEans4.length && (
                                                                    <div style={{ background: '#FFF', border: '1px dashed #E5E7EB', borderRadius: 6, padding: '8px 10px', fontSize: 11, color: '#9CA3AF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                        {lang === 'de' ? `… und ${(errs - errorEans4.length).toLocaleString(numLocale)} weitere` : `… and ${(errs - errorEans4.length).toLocaleString(numLocale)} more`}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Right: score + nav (matches step 3 layout) */}
                            <div className="mc-sticky-sidebar" style={{ background: '#FFF', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

                                {/* Sidebar heading */}
                                <div style={{ padding: '14px 16px', borderBottom: '1px solid #F3F4F6' }}>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>
                                        {lang === 'de' ? 'Ergebnis' : 'Result'}
                                    </div>
                                    <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 1 }}>
                                        {lang === 'de' ? 'Optionale Feldabdeckung & Lücken' : 'Optional field coverage & gaps'}
                                    </div>
                                </div>

                                {/* Score progress bar - Optionale Felder. Stats on the article level. */}
                                {(() => {
                                    const noOptMapped = optFieldStats.fields.filter(f => !f.notMapped).length === 0;
                                    const mappedFields = optFieldStats.fields.filter(f => !f.notMapped);
                                    let completeArticles = 0;
                                    if (mappedFields.length > 0) {
                                        rows.forEach((r) => {
                                            const allFilled = mappedFields.every((f) => {
                                                const col = mcMapping[f.field];
                                                return col && String(r[col] ?? '').trim();
                                            });
                                            if (allFilled) completeArticles++;
                                        });
                                    }
                                    const incompleteArticles = issues.totalRows - completeArticles;
                                    const summary = mappedFields.length === 0
                                        ? (lang === 'de' ? 'Keine optionalen Felder im Feed erkannt.' : 'No optional fields detected in the feed.')
                                        : completeArticles === issues.totalRows
                                            ? (lang === 'de' ? 'Alle Artikel haben vollständige optionale Felder.' : 'All items have complete optional fields.')
                                            : (lang === 'de'
                                                ? `${completeArticles.toLocaleString(numLocale)} von ${issues.totalRows.toLocaleString(numLocale)} Artikeln vollständig.`
                                                : `${completeArticles.toLocaleString(numLocale)} of ${issues.totalRows.toLocaleString(numLocale)} items complete.`);
                                    return (
                                        <>
                                            <div style={{ opacity: noOptMapped ? 0.45 : 1, pointerEvents: noOptMapped ? 'none' : 'auto' }}>
                                                <ScoreBar
                                                    title={lang === 'de' ? 'Optionale Feldabdeckung' : 'Optional field coverage'}
                                                    pct={overallPct}
                                                    color={overallColor}
                                                    complete={completeArticles}
                                                    incomplete={incompleteArticles}
                                                    total={issues.totalRows}
                                                    completeLabel={lang === 'de' ? 'vollständig' : 'complete'}
                                                    incompleteLabel={lang === 'de' ? 'unvollständig' : 'incomplete'}
                                                    totalLabel={lang === 'de' ? 'gesamt' : 'total'}
                                                    tipComplete={lang === 'de' ? 'Artikel mit allen optionalen Feldern befüllt' : 'Items with all optional fields filled'}
                                                    tipIncomplete={lang === 'de' ? 'Artikel mit mind. einer Lücke in den optionalen Feldern' : 'Items with at least one gap in the optional fields'}
                                                    tipTotal={lang === 'de' ? 'Gesamtzahl Artikel im Feed' : 'Total items in the feed'}
                                                    summary={summary}
                                                    numLocale={numLocale}
                                                />
                                            </div>
                                            {noOptMapped && (
                                                <div style={{ padding: '8px 12px', fontSize: 11, color: '#6B7280', textAlign: 'center', fontStyle: 'italic' }}>
                                                    {lang === 'de' ? 'Keine optionalen Felder zugeordnet' : 'No optional fields mapped'}
                                                </div>
                                            )}
                                        </>
                                    );
                                })()}

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
                const { optFieldStats } = issues;
                const listablePct = issues.totalRows > 0 ? Math.round((issues.livefaehigCount / issues.totalRows) * 100) : 0;
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

                // Track optional field hints (color, material, delivery_includes) in errorsByType
                // so they appear under the "OPTIONALE FELDER" section in recommendations.
                const OPTIONAL_HINT_FIELDS = new Set(['color', 'material', 'delivery_includes']);
                issues.optionalHints.forEach(({ field, ean }) => {
                    if (!OPTIONAL_HINT_FIELDS.has(field)) return;
                    const key = `${field}::missing`;
                    if (!errorsByType[key]) errorsByType[key] = { field, type: 'missing', count: 0, sampleEans: [] };
                    errorsByType[key].count++;
                    if (ean && errorsByType[key].sampleEans.length < 5 && !errorsByType[key].sampleEans.includes(ean)) {
                        errorsByType[key].sampleEans.push(ean);
                    }
                });

                const fieldIcon = (field, iconColor) => {
                    const color = iconColor || '#6B7280';
                    const s = { flexShrink: 0 };
                    const strokeProps = { stroke: color, strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' };
                    if (field === 'name') return <svg width="16" height="16" viewBox="0 0 24 24" style={s}><circle cx="12" cy="12" r="9" {...strokeProps}/><path d="M8 9h8M12 9v7" {...strokeProps}/></svg>;
                    if (field === 'image_url') return <svg width="16" height="16" viewBox="0 0 24 24" style={s}><path d="M10 14a3.5 3.5 0 0 1 0-5l3-3a3.5 3.5 0 0 1 5 5l-1.5 1.5" {...strokeProps}/><path d="M14 10a3.5 3.5 0 0 1 0 5l-3 3a3.5 3.5 0 0 1-5-5l1.5-1.5" {...strokeProps}/></svg>;
                    if (field === 'description') return <svg width="16" height="16" viewBox="0 0 24 24" style={s}><path d="M5 8h14M5 12h14M5 16h10" {...strokeProps}/></svg>;
                    if (field === 'ean') return <svg width="16" height="16" viewBox="0 0 24 24" style={s}><text x="12" y="15" textAnchor="middle" fontFamily="-apple-system, BlinkMacSystemFont, sans-serif" fontWeight="700" fontSize="9" fill={color} letterSpacing="0.3">EAN</text></svg>;
                    if (field === 'brand') return <svg width="16" height="16" viewBox="0 0 24 24" style={s}><path d="M3 12V4h8l10 10-8 8L3 12z" {...strokeProps}/><circle cx="7.5" cy="7.5" r="1.2" fill={color}/></svg>;
                    if (field === 'shipping_mode') return <svg width="16" height="16" viewBox="0 0 24 24" style={s}><rect x="2" y="8" width="11" height="9" rx="1" {...strokeProps}/><path d="M13 11h5l3 3v3h-8z" {...strokeProps}/><circle cx="7" cy="18" r="1.5" {...strokeProps}/><circle cx="17" cy="18" r="1.5" {...strokeProps}/></svg>;
                    if (field === 'price') return <svg width="16" height="16" viewBox="0 0 24 24" style={s}><circle cx="12" cy="12" r="9" {...strokeProps}/><path d="M15 9.5c-.6-.8-1.7-1.3-3-1.3-1.9 0-3.4 1.1-3.4 2.5 0 1.2 1 1.8 2.9 2.2 2.1.3 3.3 1 3.3 2.4 0 1.4-1.6 2.7-3.4 2.7-1.4 0-2.6-.7-3.3-1.5M12 7v1.2M12 16.8V18" {...strokeProps}/></svg>;
                    if (field === 'availability' || field === 'stock_amount') return <svg width="16" height="16" viewBox="0 0 24 24" style={s}><path d="M4 7.5L12 4l8 3.5v9L12 20l-8-3.5v-9z" {...strokeProps}/><path d="M4 7.5L12 11l8-3.5M12 11v9" {...strokeProps}/></svg>;
                    if (field === 'delivery_time') return <svg width="16" height="16" viewBox="0 0 24 24" style={s}><circle cx="12" cy="12" r="9" {...strokeProps}/><path d="M12 7v5l3 2" {...strokeProps}/></svg>;
                    if (field === 'seller_offer_id') return <svg width="16" height="16" viewBox="0 0 24 24" style={s}><rect x="3" y="6" width="18" height="12" rx="2" {...strokeProps}/><circle cx="8" cy="12" r="2" {...strokeProps}/><path d="M13 11h5M13 14h4" {...strokeProps}/></svg>;
                    if (field === 'color') return <svg width="16" height="16" viewBox="0 0 24 24" style={s}><path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2s-1-1-1-2 1-2 2-2h2a4 4 0 0 0 4-4 9 9 0 0 0-9-8z" {...strokeProps}/><circle cx="7.5" cy="11" r="1" fill={color}/><circle cx="10" cy="7.5" r="1" fill={color}/><circle cx="14" cy="7" r="1" fill={color}/><circle cx="17" cy="10" r="1" fill={color}/></svg>;
                    if (field === 'material') return <svg width="16" height="16" viewBox="0 0 24 24" style={s}><path d="M12 3l9 5-9 5-9-5 9-5z" {...strokeProps}/><path d="M3 13l9 5 9-5" {...strokeProps}/><path d="M3 17l9 5 9-5" {...strokeProps}/></svg>;
                    if (field === 'delivery_includes') return <svg width="16" height="16" viewBox="0 0 24 24" style={s}><path d="M12 3l9 5-9 5-9-5 9-5z" {...strokeProps}/><path d="M3 8v9l9 5 9-5V8M12 13v9" {...strokeProps}/></svg>;
                    if (field === 'category_path') return <svg width="16" height="16" viewBox="0 0 24 24" style={s}><path d="M10 7h10M10 12h10M10 17h10" {...strokeProps}/><circle cx="5.5" cy="7" r="1.2" fill={color}/><circle cx="5.5" cy="12" r="1.2" fill={color}/><circle cx="5.5" cy="17" r="1.2" fill={color}/></svg>;
                    if (field === '__size_missing') return <svg width="16" height="16" viewBox="0 0 24 24" style={s}><path d="M4 20l4-1L20 7l-3-3L5 16l-1 4z" {...strokeProps}/><path d="M14 6l3 3" {...strokeProps}/></svg>;
                    if (field === '__lighting') return <svg width="16" height="16" viewBox="0 0 24 24" style={s}><path d="M19 5c0 8-5 14-13 14 0-8 5-14 13-14z" {...strokeProps}/><path d="M6 19L15 8" {...strokeProps}/></svg>;
                    return <svg width="16" height="16" viewBox="0 0 24 24" style={s}><circle cx="12" cy="12" r="9" {...strokeProps}/><path d="M12 8v5" {...strokeProps}/><circle cx="12" cy="16" r="0.9" fill={color}/></svg>;
                };
                const recRules = lang === 'de' ? {
                    'name::missing':       { title: 'Artikelname fehlt',               shortDesc: 'Eindeutiger und aussagekräftiger Titel ist erforderlich',             action: 'Tragen Sie für jeden betroffenen Artikel einen vollständigen Namen ein. Format: Marke + Produkttyp + Hauptattribut, z. B. „BRAND Sofa 3-Sitzer grau 180 cm".',         tip: 'Mind. 2 Wörter und 10 Zeichen. Ein guter Name erhöht die Auffindbarkeit deutlich.' },
                    'name::too_short':     { title: 'Artikelname zu kurz',              shortDesc: 'Artikelname enthält zu wenig Informationen',                          action: 'Verlängern Sie den Artikelnamen auf mindestens 10 Zeichen.',                     tip: 'Ergänzen Sie Produkttyp, Farbe oder Material für einen aussagekräftigen Namen.' },
                    'name::one_word':      { title: 'Artikelname: nur ein Wort',        action: 'Der Name muss aus mindestens 2 Wörtern bestehen.',                              tip: 'Kombinieren Sie Marke + Produktname, z. B. „BRAND Tisch" oder „Hersteller Sofa grau".' },
                    'name::placeholder':   { title: 'Artikelname: Platzhalterwert',     action: 'Ersetzen Sie Platzhalter wie „n/a" oder „test" durch echte Artikelnamen.',       tip: 'Verwenden Sie produktspezifische, eindeutige Namen.' },
                    'name::dup':           { title: 'Artikelname: Duplikate',           shortDesc: 'Doppelte Artikelnamen gefunden',                                       action: 'Jeder Artikel muss einen eindeutigen Namen haben. Korrigieren oder entfernen Sie Duplikate.', tip: 'Unterscheiden Sie Varianten durch Farbe, Größe oder Modellbezeichnung.' },
                    'ean::missing':        { title: 'EAN fehlt',                        shortDesc: 'Gültige EAN zur eindeutigen Identifikation ist erforderlich',          action: 'Ergänzen Sie die EAN (GTIN14) für alle betroffenen Artikel.',                   tip: 'Verwenden Sie die offizielle GTIN aus der GS1-Datenbank.' },
                    'ean::wrong_length':   { title: 'EAN: falsche Länge',               shortDesc: 'EAN entspricht nicht der erforderlichen Länge',                        action: 'Die EAN muss 13 oder 14 Stellen haben (EAN-13 oder GTIN-14).',                   tip: 'Beispiel: EAN-13 „4012345678901" (13-stellig) oder GTIN-14 „04012345678901" (14-stellig).' },
                    'ean::invalid':        { title: 'EAN: ungültiger Wert',             action: 'Entfernen Sie Sonderzeichen, die EAN darf nur Ziffern enthalten.',              tip: 'Keine Buchstaben, Leerzeichen oder Bindestriche erlaubt.' },
                    'ean::placeholder':    { title: 'EAN: Platzhalterwert',             action: 'Ersetzen Sie Test-EANs durch gültige GTIN14-Nummern.',                          tip: 'Erfundene oder Test-EANs werden blockiert.' },
                    'ean::dup':            { title: 'EAN: Duplikate',                   shortDesc: 'Doppelte EANs gefunden',                                               action: 'Jede EAN darf nur einmal vorkommen. Korrigieren Sie die doppelten Einträge.',   tip: 'Prüfen Sie, ob Artikel versehentlich mehrfach exportiert wurden.' },
                    'description::missing':    { title: 'Beschreibung fehlt',               shortDesc: 'Detaillierte Beschreibung des Artikels ist erforderlich',           action: 'Ergänzen Sie eine Produktbeschreibung für alle betroffenen Artikel.',           tip: 'Mindestens 20 Zeichen, empfohlen 100–500 Zeichen mit Material, Maßen und Features.' },
                    'description::too_short':  { title: 'Beschreibung zu kurz',             shortDesc: 'Beschreibung enthält zu wenig Informationen',                       action: 'Verlängern Sie die Beschreibung auf mindestens 20 Zeichen.',                     tip: 'Nennen Sie Material, Farbe, Maße und besondere Produkteigenschaften.' },
                    'description::bware':      { title: 'Beschreibung: B-Ware-Hinweis',     action: 'Entfernen Sie die Kennzeichnung „B-Ware" aus der Beschreibung.',                tip: 'B-Ware-Artikel können nicht als Neuware gelistet werden.' },
                    'description::placeholder':{ title: 'Beschreibung: Platzhalterwert',    action: 'Ersetzen Sie Platzhalter durch echte Produktbeschreibungen.',                   tip: 'Beschreiben Sie Material, Farbe und Besonderheiten des Produkts.' },
                    'price::missing':      { title: 'Preis fehlt',                      action: 'Ergänzen Sie den Preis für alle betroffenen Artikel.',                          tip: 'Format: 19.99 (Punkt als Dezimaltrennzeichen, ohne €-Zeichen).' },
                    'price::invalid':      { title: 'Preis: ungültiges Format',         action: 'Korrigieren Sie das Preisformat auf 19.99.',                                    tip: 'Nur positive Zahlen mit Punkt als Dezimaltrennzeichen, z. B. 29.99.' },
                    'price::placeholder':  { title: 'Preis: Platzhalterwert',           action: 'Ersetzen Sie Platzhalterwerte durch den korrekten Artikelpreis.',               tip: 'Der Preis muss eine positive Zahl größer als 0 sein.' },
                    'shipping_mode::missing':  { title: 'Versandart fehlt',              shortDesc: 'Versandart und -kosten müssen angegeben werden',                       action: 'Tragen Sie die Versandart ein: „paket" für normale Paketlieferung oder „spedition" für Speditionsversand.',                   tip: 'Schwere oder sperrige Möbel zählen in der Regel als „spedition".' },
                    'shipping_mode::invalid':  { title: 'Versandart: ungültiger Wert',   action: 'Ersetzen Sie den Wert durch „paket" oder „spedition" – diese sind die einzigen gültigen Optionen.',                  tip: 'Prüfen Sie auf Leerzeichen, Groß-/Kleinschreibung oder Tippfehler.' },
                    'shipping_mode::placeholder': { title: 'Versandart: Platzhalterwert', action: 'Ersetzen Sie Platzhalterwerte durch „paket" (Paketversand) oder „spedition" (Speditionslieferung).',              tip: 'Wählen Sie anhand von Gewicht und Größe: Pakete bis ca. 30 kg → „paket", größer/schwerer → „spedition".' },
                    'image_url::missing':  { title: 'Bild-URL fehlt',                  shortDesc: 'Mindestens ein Produktbild ist erforderlich',                           action: 'Fügen Sie für jeden Artikel eine öffentlich erreichbare Bild-URL ein.',         tip: 'Freigestelltes Bild auf weißem Hintergrund, mind. 600×600 px, kein Login nötig.' },
                    'image_url::invalid':  { title: 'Bild-URL: ungültiger Wert',       action: 'Prüfen Sie, ob die Bild-URL korrekt und öffentlich erreichbar ist.',            tip: 'URL muss mit http:// oder https:// beginnen und direkt auf eine Bilddatei zeigen.' },
                    'availability::missing':   { title: 'Bestand / Verfügbarkeit fehlt', shortDesc: 'Bestand oder Verfügbarkeit muss gesetzt sein',                        action: 'Geben Sie Lagerbestand oder Verfügbarkeitsstatus für alle Artikel an.',        tip: 'Entweder numerischer Bestand (z. B. 10) oder einen Verfügbarkeitsstatus.' },
                    'stock_amount::missing':   { title: 'Bestand fehlt',                 action: 'Ergänzen Sie den numerischen Lagerbestand.',                                   tip: 'Tragen Sie den aktuellen Bestand als Zahl ein, z. B. 5 oder 100.' },
                    'brand::missing':      { title: 'Marke fehlt',                      shortDesc: 'Angabe der Marke ist erforderlich',                                    action: 'Ergänzen Sie den Markennamen für alle betroffenen Artikel.',                   tip: 'Verwenden Sie den offiziellen Markennamen, mind. 2 Zeichen.' },
                    'brand::too_short':    { title: 'Marke: zu kurz',                   action: 'Ergänzen Sie den vollständigen Markennamen (mind. 2 Zeichen).',                              tip: 'Abkürzungen vermeiden – verwenden Sie den offiziellen Namen, z. B. „Müller Möbel" statt „MM".' },
                    'brand::placeholder':  { title: 'Marke: Platzhalterwert',           action: 'Ersetzen Sie Platzhalter durch den echten Markennamen.',                       tip: 'Der Markenname muss für jeden Artikel ausgefüllt sein.' },
                    'delivery_time::missing':  { title: 'Lieferzeit fehlt',              shortDesc: 'Lieferzeit muss für alle Artikel angegeben sein',                      action: 'Tragen Sie die Lieferzeit ein, z. B. „3-5 Werktage" oder „2 Tage". Kunden erwarten diese Angabe vor dem Kauf.',                   tip: 'Format: Zahl + Einheit. Werktage-Angaben (z. B. „3-5 Werktage") werden bevorzugt.' },
                    'delivery_time::invalid':  { title: 'Lieferzeit: ungültiges Format', action: 'Schreiben Sie die Lieferzeit im Format „Zahl + Einheit", z. B. „3-5 Werktage", „1 Woche" oder „2 Tage".',                                   tip: 'Die Einheit (Tage/Werktage/Woche) muss lesbar sein. Nur eine Zahl ohne Einheit wird abgelehnt.' },
                    'delivery_time::placeholder': { title: 'Lieferzeit: Platzhalterwert', action: 'Ersetzen Sie Platzhalter durch reale Lieferzeitangaben.',                   tip: 'Geben Sie die tatsächliche Lieferzeit an, z. B. „3-5 Werktage".' },
                    'seller_offer_id::missing':{ title: 'Eigene Artikel-ID fehlt',       action: 'Ergänzen Sie Ihre interne Artikel-ID für alle betroffenen Zeilen.',            tip: 'Die Artikel-ID muss eindeutig pro Artikel sein.' },
                    'seller_offer_id::placeholder':{ title: 'Artikel-ID: Platzhalterwert', action: 'Ersetzen Sie Platzhalter durch echte, eindeutige Artikel-IDs.',            tip: 'Verwenden Sie Ihre internen SKU oder Artikelnummern.' },
                    'hs_code::missing':    { title: 'HS-Code fehlt',                    action: 'Da Ihr Lager außerhalb Deutschlands liegt, ist der HS-Code Pflichtfeld.',      tip: 'Den passenden HS-Code finden Sie im EU-Zolltarifverzeichnis (customs.ec.europa.eu).' },
                    'ean::scientific':     { title: 'EAN in wissenschaftlicher Notation', action: 'Speichern Sie die Spalte in Excel als „Text", um die wissenschaftliche Notation zu verhindern.', tip: 'Excel wandelt lange Zahlen automatisch um. Spalte als Text formatieren, dann erneut speichern.' },
                    'name::siehe_oben':    { title: 'Artikelname: „siehe oben"',          action: 'Tragen Sie für jeden Artikel einen eigenen, vollständigen Namen ein.',           tip: '"Siehe oben" ist kein gültiger Artikelname und wird von CHECK24 abgelehnt.' },
                    'description::external_link': { title: 'Beschreibung: externe URL',   shortDesc: 'Externe Links in der Beschreibung prüfen',                           action: 'Entfernen Sie alle externen Links aus der Produktbeschreibung.',                tip: 'Keine www.- oder http(s)-Links in der Beschreibung erlaubt.' },
                    'description::template': { title: 'Beschreibung: Vorlagentext',       action: 'Ersetzen Sie Mustertexte wie „Lorem Ipsum" durch echte Produktbeschreibungen.', tip: 'Jedes Produkt braucht eine einzigartige, informative Beschreibung.' },
                    'description::advertising': { title: 'Beschreibung: Werbephrasen',    shortDesc: 'Werbliche Formulierungen vermeiden',                                  action: 'Entfernen Sie Werbephrasen wie „Jetzt kaufen" oder „Rabatt" aus der Beschreibung.', tip: 'Die Beschreibung soll Produkteigenschaften darstellen, keine Werbetexte.' },
                    'description::identical_to_title': { title: 'Beschreibung = Artikelname', action: 'Verfassen Sie eine eigenständige Beschreibung mit Material, Maßen und Besonderheiten – nicht einfach den Artikelnamen wiederholen.', tip: 'Beispiel: Statt „BRAND Sofa grau" → „Gepolstertes 3-Sitzer-Sofa aus Strukturstoff, 230 cm breit, mit Kaltschaum-Polsterung und abnehmbaren Bezügen."' },
                    'image_url::single':   { title: 'Nur 1 Produktbild',                  shortDesc: 'Weitere Produktbilder können die Conversion steigern',               action: 'Fügen Sie mindestens 3 Bilder pro Artikel hinzu (Hauptbild + 2 Zusatzbilder).', tip: 'Mehr Bilder erhöhen die Klickrate und Conversion deutlich.' },
                    'seller_offer_id::dup':{ title: 'Eigene Artikel-ID: Duplikate',       action: 'Jede Artikel-ID (seller_offer_id) muss eindeutig sein. Korrigieren Sie Duplikate.', tip: 'Verwenden Sie Ihre interne SKU oder eine eindeutige Bestellnummer.' },
                    'category_path::wrong_category': { title: 'Kategoriepfad: falsche Kategorie', shortDesc: 'Kategoriezuordnung prüfen und korrigieren',                  action: 'Ersetzen Sie die Kategorie durch eine gültige Möbelkategorie, z. B. „Sofa", „Boxspringbett", „Esstisch" oder „Kleiderschrank".', tip: 'CHECK24 Möbel akzeptiert nur Kategorien aus dem Möbel-Sortiment. Allgemeine Kategorien wie „Haushalt" oder „Sonstiges" werden abgelehnt.' },
                    'color::missing':         { title: 'Farbe fehlt',                      shortDesc: 'Farbangabe erhöht die Auffindbarkeit',                                action: 'Ergänzen Sie die Farbe für alle betroffenen Artikel.',                             tip: 'Klare Farbangaben verbessern die Filterbarkeit und Auffindbarkeit erheblich.' },
                    'material::missing':      { title: 'Material fehlt',                   shortDesc: 'Materialangabe verbessert die Filterbarkeit',                         action: 'Ergänzen Sie das Material für alle betroffenen Artikel.',                          tip: 'Material ist ein wichtiges Filterkriterium – z. B. „Eiche", „Kunstleder", „Stoff".' },
                    'delivery_includes::missing': { title: 'Lieferumfang fehlt',           action: 'Geben Sie den Lieferumfang im Format „1x Tisch, 4x Stuhl" an.',                   tip: 'Ein vollständiger Lieferumfang reduziert Retouren und Kundenfragen.' },
                } : {
                    'name::missing':       { title: 'Item name missing',              shortDesc: 'A unique and descriptive title is required',                             action: 'Add a full product name for every affected item. Format: Brand + Product type + Key attribute, e.g. "BRAND Sofa 3-seater grey 180 cm".',                              tip: 'Min. 2 words and 10 characters. A descriptive name significantly improves search visibility.' },
                    'name::too_short':     { title: 'Item name too short',            shortDesc: 'Item name does not contain enough information',                           action: 'Extend the item name to at least 10 characters.',                               tip: 'Add product type, color, or material to create a descriptive name.' },
                    'name::one_word':      { title: 'Item name: single word only',   action: 'The name must consist of at least 2 words.',                                    tip: 'Combine brand + product name, e.g. "BRAND Table" or "Brand Sofa grey".' },
                    'name::placeholder':   { title: 'Item name: placeholder value',  action: 'Replace placeholders like "n/a" or "test" with real item names.',               tip: 'Use product-specific, unique names.' },
                    'name::dup':           { title: 'Item name: duplicates',         shortDesc: 'Duplicate item names found',                                              action: 'Every item must have a unique name. Fix or remove duplicates.',                  tip: 'Differentiate variants by color, size, or model designation.' },
                    'ean::missing':        { title: 'EAN missing',                   shortDesc: 'Valid EAN required for unique identification',                            action: 'Add the EAN (GTIN14) for all affected items.',                                  tip: 'Use the official GTIN from the GS1 database.' },
                    'ean::wrong_length':   { title: 'EAN: wrong length',             shortDesc: 'EAN does not match the required length',                                  action: 'EAN must be 13 or 14 digits (EAN-13 or GTIN-14).',                              tip: 'Example: EAN-13 "4012345678901" (13 digits) or GTIN-14 "04012345678901" (14 digits).' },
                    'ean::invalid':        { title: 'EAN: invalid value',            action: 'Remove special characters; EAN must contain digits only.',                     tip: 'No letters, spaces, or hyphens allowed.' },
                    'ean::placeholder':    { title: 'EAN: placeholder value',        action: 'Replace test EANs with valid GTIN14 numbers.',                                  tip: 'Invented or test EANs will be blocked.' },
                    'ean::dup':            { title: 'EAN: duplicates',               shortDesc: 'Duplicate EANs found',                                                    action: 'Each EAN may only appear once. Fix the duplicate entries.',                     tip: 'Check whether items were accidentally exported multiple times.' },
                    'description::missing':    { title: 'Description missing',           shortDesc: 'Detailed description of the item is required',                         action: 'Add a product description for all affected items.',                             tip: 'Min. 20 characters, ideally 100–500 with material, dimensions, and features.' },
                    'description::too_short':  { title: 'Description too short',         shortDesc: 'Description does not contain enough information',                       action: 'Extend the description to at least 20 characters.',                             tip: 'Mention material, color, dimensions, and key product features.' },
                    'description::bware':      { title: 'Description: used-goods label', action: 'Remove the "B-Ware" label from the description.',                               tip: 'Used goods items cannot be listed as new.' },
                    'description::placeholder':{ title: 'Description: placeholder value', action: 'Replace placeholder values with real product descriptions.',                  tip: 'Describe material, color, and special features of the product.' },
                    'price::missing':      { title: 'Price missing',                  action: 'Add the price for all affected items.',                                         tip: 'Format: 19.99 (dot as decimal separator, no currency symbol).' },
                    'price::invalid':      { title: 'Price: invalid format',          action: 'Correct the price format to 19.99.',                                            tip: 'Only positive numbers with dot as decimal separator, e.g. 29.99.' },
                    'price::placeholder':  { title: 'Price: placeholder value',       action: 'Replace placeholder values with the correct item price.',                       tip: 'The price must be a positive number greater than 0.' },
                    'shipping_mode::missing':  { title: 'Shipping mode missing',      shortDesc: 'Shipping mode and cost must be specified',                                action: 'Set the shipping mode to "paket" (parcel delivery) or "spedition" (freight delivery) for every affected item.',                                 tip: 'Heavy or bulky furniture typically qualifies as "spedition".' },
                    'shipping_mode::invalid':  { title: 'Shipping mode: invalid value', action: 'Replace the value with "paket" or "spedition", these are the only accepted options.',                           tip: 'Check for extra spaces, capitalisation, or typos.' },
                    'shipping_mode::placeholder':{ title: 'Shipping mode: placeholder', action: 'Replace placeholder values with "paket" (parcel) or "spedition" (freight delivery).',                          tip: 'Choose based on weight and size: items up to ~30 kg → "paket", larger/heavier → "spedition".' },
                    'image_url::missing':  { title: 'Image URL missing',             shortDesc: 'At least one product image is required',                                  action: 'Add a publicly accessible image URL for every item.',                           tip: 'Cut-out on white background, min. 600×600 px, no login required.' },
                    'image_url::invalid':  { title: 'Image URL: invalid value',      action: 'Check that the image URL is correct and publicly accessible.',                  tip: 'URL must start with http:// or https:// and point directly to an image file.' },
                    'availability::missing':   { title: 'Stock / Availability missing', shortDesc: 'Stock or availability must be set',                                     action: 'Provide stock count or availability status for every item.',                   tip: 'Either a numeric stock count (e.g. 10) or an availability status.' },
                    'stock_amount::missing':   { title: 'Stock missing',              action: 'Add the numeric stock count.',                                                  tip: 'Enter the current stock as a number, e.g. 5 or 100.' },
                    'brand::missing':      { title: 'Brand missing',                 shortDesc: 'Specifying the brand is required',                                        action: 'Add the brand name for all affected items.',                                   tip: 'Use the official brand name, min. 2 characters.' },
                    'brand::too_short':    { title: 'Brand: too short',              action: 'Enter the full brand name (at least 2 characters).',                                    tip: 'Avoid abbreviations, use the official name, e.g. "Müller Möbel" instead of "MM".' },
                    'brand::placeholder':  { title: 'Brand: placeholder value',      action: 'Replace placeholders with the real brand name.',                               tip: 'Brand name must be filled in for every item.' },
                    'delivery_time::missing':  { title: 'Delivery time missing',     shortDesc: 'Delivery time must be specified for all items',                           action: 'Enter the delivery time, e.g. "3-5 working days" or "2 days". Customers check this before purchasing.',                                 tip: 'Format: number + unit. Working-day ranges (e.g. "3-5 working days") are preferred.' },
                    'delivery_time::invalid':  { title: 'Delivery time: invalid format', action: 'Write the delivery time as "number + unit", e.g. "3-5 working days", "1 week", or "2 days".',                                              tip: 'The unit (days / working days / week) must be present. A number alone without a unit will be rejected.' },
                    'delivery_time::placeholder':{ title: 'Delivery time: placeholder', action: 'Replace placeholders with actual delivery time information.',                 tip: 'Enter the real delivery time, e.g. "3-5 working days".' },
                    'seller_offer_id::missing':{ title: 'Own item ID missing',        action: 'Add your internal item ID for all affected rows.',                              tip: 'The item ID must be unique per item.' },
                    'seller_offer_id::placeholder':{ title: 'Item ID: placeholder value', action: 'Replace placeholders with real, unique item IDs.',                         tip: 'Use your internal SKUs or item numbers.' },
                    'hs_code::missing':    { title: 'HS Code missing',                action: 'Since your warehouse is outside Germany, HS Code is required.',                 tip: 'Find the correct HS Code in the EU customs tariff directory.' },
                    'ean::scientific':     { title: 'EAN in scientific notation',      action: 'Format the EAN column as "Text" in Excel to prevent scientific notation.',       tip: 'Excel converts long numbers automatically. Format the column as text before saving.' },
                    'name::siehe_oben':    { title: 'Item name: "siehe oben"',         action: 'Enter a unique, complete name for every item.',                                  tip: '"Siehe oben" is not a valid item name and will be rejected by CHECK24.' },
                    'description::external_link': { title: 'Description: external URL', shortDesc: 'Check and remove external links in description',                       action: 'Remove all external links from the product description.',                      tip: 'www. or http(s) links are not allowed in the description.' },
                    'description::template': { title: 'Description: template text',    action: 'Replace template text (Lorem Ipsum etc.) with real product descriptions.',       tip: 'Every product needs a unique, informative description.' },
                    'description::advertising': { title: 'Description: advertising phrases', shortDesc: 'Avoid promotional language in descriptions',                       action: 'Remove advertising phrases like "Buy now" or "Discount" from the description.', tip: 'Descriptions should present product features, not advertising copy.' },
                    'description::identical_to_title': { title: 'Description = Item name', action: 'Write a proper description covering material, dimensions, and features, do not just copy the item name.',      tip: 'Example: instead of "BRAND Sofa grey" → "Upholstered 3-seater sofa in structured fabric, 230 cm wide, cold-foam padding, removable covers."' },
                    'image_url::single':   { title: 'Only 1 product image',            shortDesc: 'Additional product images can increase conversion',                      action: 'Add at least 3 images per item (main image + 2 additional images).',            tip: 'More images significantly increase click-through rate and conversion.' },
                    'seller_offer_id::dup':{ title: 'Own item ID: duplicates',         action: 'Each seller_offer_id must be unique. Fix the duplicate entries.',               tip: 'Use your internal SKU or a unique order number.' },
                    'category_path::wrong_category': { title: 'Category path: wrong category', shortDesc: 'Review and correct the category assignment',                    action: 'Replace the category with a valid furniture category, e.g. "Sofa", "Boxspringbett", "Esstisch", or "Kleiderschrank".', tip: 'CHECK24 Furniture only accepts categories from the furniture assortment. Generic categories like "Household" or "Other" will be rejected.' },
                    'color::missing':         { title: 'Color missing',                    shortDesc: 'Color specification increases discoverability',                          action: 'Add the color for all affected items.',                                            tip: 'Clear color values significantly improve filterability and discoverability.' },
                    'material::missing':      { title: 'Material missing',                 shortDesc: 'Material specification improves filterability',                           action: 'Add the material for all affected items.',                                        tip: 'Material is an important filter criterion, e.g. "Oak", "Faux Leather", "Fabric".' },
                    'delivery_includes::missing': { title: 'Delivery includes missing',    action: 'Enter the delivery contents in the format "1x table, 4x chair".',                tip: 'A complete delivery scope reduces returns and customer queries.' },
                };

                // Pflicht fields and optional check fields used for segmentation
                const PFLICHT_FIELDS_SET = new Set([...MC_PFLICHT_COLS, 'hs_code', 'seller_offer_id']);
                const OPTIONAL_CHECK_FIELDS_SET = new Set(['color', 'material', 'delivery_includes']);
                // Quality / advisory issue types - go into "Zusätzliche Hinweise" along with non-pflicht fields
                const HINT_TYPES = new Set(['advertising', 'external_link', 'template', 'identical_to_title', 'single', 'siehe_oben', 'wrong_category']);

                const SEVERITY_RANK = {
                    'missing': 0, 'invalid': 1, 'wrong_length': 2, 'too_short': 3,
                    'one_word': 4, 'placeholder': 5, 'bware': 6, 'dup': 7,
                    'scientific': 8, 'advertising': 9, 'template': 10, 'external_link': 11,
                    'identical_to_title': 12, 'siehe_oben': 13,
                };
                const getSeverity = (key) => {
                    const type = key.split('::')[1] || '';
                    return SEVERITY_RANK[type] ?? 99;
                };

                const allRecommendations = Object.entries(errorsByType)
                    .sort((a, b) => getSeverity(a[0]) - getSeverity(b[0]) || b[1].count - a[1].count)
                    .map(([key, { count, type, sampleEans, field }]) => ({ key, count, type, field: field || key.split('::')[0], sampleEans: sampleEans || [], rule: recRules[key] || null }))
                    .filter(({ rule }) => rule !== null);

                // Segment into 3 categories:
                //  - Pflichtfeld: any error on a required field that isn't a pure hint type
                //  - Optionale Felder: errors on the optional fields we check
                //  - Zusätzliche Hinweise: everything else + quality hints
                const pflichtRecs = allRecommendations.filter(({ field, type }) =>
                    PFLICHT_FIELDS_SET.has(field) && !HINT_TYPES.has(type));
                const optionalRecs = allRecommendations.filter(({ field }) =>
                    OPTIONAL_CHECK_FIELDS_SET.has(field));
                const hintRecs = allRecommendations.filter((r) =>
                    !pflichtRecs.includes(r) && !optionalRecs.includes(r));

                if (optFieldStats?.sizeMissingCount > 0) {
                    const extra = {
                        key: '__size_missing::missing',
                        count: optFieldStats.sizeMissingCount,
                        type: 'missing',
                        field: '__size_missing',
                        sampleEans: [],
                        rule: {
                            title: T.sizeHintTitle,
                            shortDesc: T.sizeHintDesc(optFieldStats.sizeMissingCount.toLocaleString(numLocale)),
                            action: lang === 'de'
                                ? 'Ergänzen Sie mindestens eines der Maß-Felder (size, size_height, size_depth, size_width, Liegefläche, …) für jeden betroffenen Artikel.'
                                : 'Fill at least one of the size fields (size, size_height, size_depth, size_width, lying surface, …) for every affected item.',
                            tip: lang === 'de'
                                ? 'Maße sind ein wichtiges Filterkriterium für Möbelkunden und reduzieren Retouren deutlich.'
                                : 'Dimensions are a key filter criterion for furniture buyers and significantly reduce returns.',
                        },
                    };
                    hintRecs.push(extra);
                    allRecommendations.push(extra);
                }
                if (optFieldStats?.lightingCount > 0) {
                    const extra = {
                        key: '__lighting::missing',
                        count: optFieldStats.lightingCount,
                        type: 'missing',
                        field: '__lighting',
                        sampleEans: [],
                        rule: {
                            title: T.lightingHintTitle,
                            shortDesc: T.lightingHintDesc(optFieldStats.lightingCount, optFieldStats.lightingEnergyMissing, optFieldStats.lightingEprelMissing),
                            action: lang === 'de'
                                ? 'Für Leuchtprodukte sind Energieeffizienzklasse und EPREL-Registriernummer Pflicht. Tragen Sie energy_efficiency_label und EPREL_registration_number für alle betroffenen Artikel ein.'
                                : 'For lighting products the energy-efficiency class and EPREL registration number are mandatory. Fill energy_efficiency_label and EPREL_registration_number for every affected item.',
                            tip: lang === 'de'
                                ? 'Die EPREL-Nummer finden Sie in der EU-Produktdatenbank unter eprel.ec.europa.eu.'
                                : 'Look up the EPREL number in the EU product database at eprel.ec.europa.eu.',
                        },
                    };
                    hintRecs.push(extra);
                    allRecommendations.push(extra);
                }

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
                    <div style={{ width: '100%', maxWidth: 1320 }}>

                        {/* Two-column layout: recommendations left, download panel right */}
                        <div className="mc-two-col-320" style={{ alignItems: 'start' }}>

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
                                                ? `${pflichtRecs.length} Pflichtfeld · ${optionalRecs.length} optionale Felder · ${hintRecs.length} Hinweise`
                                                : `${pflichtRecs.length} required · ${optionalRecs.length} optional · ${hintRecs.length} hints`}
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

                                {/* Recommendation cards - segmented into 3 groups: Pflicht / Optional / Hints */}
                                {recommendations.length > 0 && (() => {
                                    const toggleRec = (key) => setExpandedRecs((prev) => {
                                        const next = new Set(prev);
                                        if (next.has(key)) next.delete(key); else next.add(key);
                                        return next;
                                    });
                                    const fieldGroupLabel = (field) => {
                                        if (field === '__size_missing') return lang === 'de' ? 'Maße' : 'Size attributes';
                                        if (field === '__lighting') return lang === 'de' ? 'Leuchtprodukte (Energie & EPREL)' : 'Lighting (energy & EPREL)';
                                        const extras = lang === 'de' ? {
                                            color: 'Farbe',
                                            material: 'Material',
                                            delivery_includes: 'Lieferumfang',
                                            category_path: 'Kategoriepfad',
                                            hs_code: 'HS-Code',
                                            seller_offer_id: 'Eigene Artikel-ID',
                                            image_url: 'Hauptbild',
                                        } : {
                                            color: 'Color',
                                            material: 'Material',
                                            delivery_includes: 'Delivery Includes',
                                            category_path: 'Category Path',
                                            hs_code: 'HS Code',
                                            seller_offer_id: 'Own Item ID',
                                            image_url: 'Main Image',
                                        };
                                        if (extras[field]) return extras[field];
                                        return (T.csvFieldLabels && T.csvFieldLabels[field]) || field;
                                    };
                                    const groupByField = (items) => {
                                        const groups = new Map();
                                        items.forEach((it) => {
                                            const f = it.field;
                                            if (!groups.has(f)) groups.set(f, { field: f, label: fieldGroupLabel(f), count: 0, issues: [] });
                                            const g = groups.get(f);
                                            g.count += it.count;
                                            g.issues.push(it);
                                        });
                                        return [...groups.values()].sort((a, b) => b.count - a.count);
                                    };
                                    const renderCard = (group, accent, accentBg, accentText) => {
                                        const groupKey = `group::${group.field}`;
                                        const isOpen = expandedRecs.has(groupKey);
                                        const issueCount = group.issues.length;
                                        return (
                                            <div key={groupKey}
                                                style={{ background: '#FFF', borderRadius: 12, border: '1px solid #E5E7EB', boxShadow: isOpen ? '0 2px 8px rgba(0,0,0,0.10)' : '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}
                                            >
                                                <div
                                                    onClick={() => toggleRec(groupKey)}
                                                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', cursor: 'pointer', userSelect: 'none' }}
                                                >
                                                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: accentBg || '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                        {fieldIcon(group.field, accentText || '#6B7280')}
                                                    </div>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', lineHeight: 1.3 }}>{group.label}</div>
                                                        <div style={{ fontSize: 11, color: '#6B7280', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                            {issueCount === 1
                                                                ? group.issues[0].rule.title
                                                                : group.issues.map((it) => it.rule.title).join(' · ')}
                                                        </div>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                                                        <div style={{ fontSize: 14, fontWeight: 800, color: accentText || accent || '#374151', whiteSpace: 'nowrap' }}>
                                                            {group.count.toLocaleString(numLocale)} {lang === 'de' ? 'Fehler' : 'errors'}
                                                        </div>
                                                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, color: '#9CA3AF', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
                                                            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                                                        </svg>
                                                    </div>
                                                </div>
                                                {isOpen && (
                                                    <div style={{ padding: '0 14px 12px 14px', borderTop: '1px solid #F3F4F6', display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 10 }}>
                                                        {group.issues.map(({ key, count, rule, sampleEans }, idx) => (
                                                            <div key={key} style={{ paddingTop: idx === 0 ? 0 : 10, borderTop: idx === 0 ? 'none' : '1px dashed #E5E7EB' }}>
                                                                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                                                                    <div style={{ fontSize: 12, fontWeight: 700, color: accentText || '#111827', flex: 1, minWidth: 0 }}>{rule.title}</div>
                                                                    <span style={{ fontSize: 11, fontWeight: 700, color: accentText || accent || '#374151', flexShrink: 0 }}>
                                                                        {count.toLocaleString(numLocale)}×
                                                                    </span>
                                                                </div>
                                                                <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.5, marginBottom: 6 }}>{rule.action}</div>
                                                                {sampleEans && sampleEans.length > 0 && (
                                                                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                                                                        <span style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600, marginRight: 2 }}>EAN:</span>
                                                                        {sampleEans.map((item, i) => (
                                                                            <span key={i} style={{ fontFamily: 'monospace', fontSize: 10, background: '#F3F4F6', padding: '1px 5px', borderRadius: 3, color: '#374151', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                                                                {typeof item === 'string' ? item : item.ean}
                                                                                {typeof item !== 'string' && item.name && (
                                                                                    <span style={{ fontFamily: 'sans-serif', color: '#6B7280', marginLeft: 3, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block' }}>· {item.name}</span>
                                                                                )}
                                                                            </span>
                                                                        ))}
                                                                        {count > sampleEans.length && (
                                                                            <span style={{ fontSize: 10, color: '#9CA3AF' }}>+{count - sampleEans.length} {lang === 'de' ? 'weitere' : 'more'}</span>
                                                                        )}
                                                                    </div>
                                                                )}
                                                                {rule.tip && (
                                                                    <div style={{ fontSize: 11, color: '#6B7280', lineHeight: 1.5, background: '#F9FAFB', borderRadius: 6, padding: '6px 10px' }}>{rule.tip}</div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    };

                                    const Section = ({ title, subtitle, accent, accentBg, accentText, items, sectionKey }) => {
                                        if (items.length === 0) return null;
                                        const sOpen = !collapsedSections.has(sectionKey);
                                        const toggleSec = () => setCollapsedSections(prev => {
                                            const next = new Set(prev);
                                            if (next.has(sectionKey)) next.delete(sectionKey); else next.add(sectionKey);
                                            return next;
                                        });
                                        return (
                                            <div>
                                                <div
                                                    onClick={toggleSec}
                                                    style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: sOpen ? 10 : 0, cursor: 'pointer', userSelect: 'none', padding: '10px 14px', background: accentBg, border: `1px solid ${accent}`, borderRadius: 10, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
                                                >
                                                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                        <svg width="11" height="11" viewBox="0 0 16 16" fill="none"><path d="M8 3v6M8 12v1" stroke={accentText} strokeWidth="2" strokeLinecap="round"/></svg>
                                                    </div>
                                                    <span style={{ fontSize: 12, fontWeight: 700, color: accentText, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{title}</span>
                                                    <span style={{ fontSize: 10, background: '#FFF', color: accentText, borderRadius: 10, padding: '2px 8px', fontWeight: 700 }}>{items.length}</span>
                                                    <span style={{ fontSize: 11, color: accentText, opacity: 0.85, marginLeft: 2 }}>{subtitle}</span>
                                                    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" style={{ marginLeft: 'auto', flexShrink: 0, color: accentText, transform: sOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
                                                        <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                                                    </svg>
                                                </div>
                                                {sOpen && (
                                                    <div style={{ display: 'grid', gap: 6, paddingLeft: 40 }}>
                                                        {groupByField(items).map((g) => renderCard(g, accent, accentBg, accentText))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    };

                                    return (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                            {(() => {
                                                const tabs = [
                                                    { key: 'all',      label: lang === 'de' ? 'Alle'              : 'All',             count: pflichtRecs.length + optionalRecs.length + hintRecs.length, color: '#111827', bg: '#F3F4F6' },
                                                    { key: 'pflicht',  label: lang === 'de' ? 'Pflichtfelder'     : 'Required',        count: pflichtRecs.length,                                          color: P_RED_TEXT, bg: P_RED_BG },
                                                    { key: 'optional', label: lang === 'de' ? 'Optionale Felder'  : 'Optional',        count: optionalRecs.length,                                         color: '#9A3412',  bg: '#FFF7ED' },
                                                    { key: 'hints',    label: lang === 'de' ? 'Hinweise'          : 'Hints',           count: hintRecs.length,                                             color: P_BLUE_TEXT, bg: P_BLUE_BG },
                                                ];
                                                return (
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                                        {tabs.map((t) => {
                                                            const active = recFilter === t.key;
                                                            return (
                                                                <button key={t.key} type="button" onClick={() => setRecFilter(t.key)}
                                                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, border: `1px solid ${active ? t.color : '#E5E7EB'}`, background: active ? t.bg : '#FFF', color: active ? t.color : '#374151', fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}>
                                                                    {t.label}
                                                                    <span style={{ fontSize: 10, fontWeight: 700, background: active ? '#FFF' : '#F3F4F6', color: active ? t.color : '#6B7280', borderRadius: 999, padding: '1px 7px' }}>{t.count}</span>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                );
                                            })()}
                                            {(recFilter === 'all' || recFilter === 'pflicht') && (
                                            <Section
                                                sectionKey="pflicht"
                                                title={lang === 'de' ? 'Pflichtfelder' : 'Required Fields'}
                                                subtitle={lang === 'de' ? 'Diese Fehler blockieren das Listing. Artikel werden ohne diese Angaben nicht ausgespielt.' : 'These errors block the listing. Items cannot be shown without them.'}
                                                accent={P_RED}
                                                accentBg={P_RED_BG}
                                                accentText={P_RED_TEXT}
                                                items={pflichtRecs}
                                            />
                                            )}
                                            {(recFilter === 'all' || recFilter === 'optional') && (
                                            <Section
                                                sectionKey="optional"
                                                title={lang === 'de' ? 'Optionale Felder' : 'Optional Fields'}
                                                subtitle={lang === 'de' ? 'Nicht zwingend, aber stark empfohlen: bessere Filterbarkeit, Suchergebnisse und Conversion.' : 'Not required, but strongly recommended: better filtering, search ranking, and conversion.'}
                                                accent='#FDBA74'
                                                accentBg='#FFF7ED'
                                                accentText='#9A3412'
                                                items={optionalRecs}
                                            />
                                            )}
                                            {(recFilter === 'all' || recFilter === 'hints') && (
                                            <Section
                                                sectionKey="hints"
                                                title={lang === 'de' ? 'Hinweise' : 'Hints'}
                                                subtitle={lang === 'de' ? 'Feinschliff für mehr Klicks und weniger Retouren. Diese Punkte verbessern die Feed-Qualität.' : 'Polish for more clicks and fewer returns. These tweaks improve overall feed quality.'}
                                                accent={P_BLUE}
                                                accentBg={P_BLUE_BG}
                                                accentText={P_BLUE_TEXT}
                                                items={hintRecs}
                                            />
                                            )}

                                        </div>
                                    );
                                })()}
                            </div>

                            {/* Right: download + reset panel */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                                {/* Card 1, Feed-Übersicht */}
                                <div style={{ background: '#FFF', border: '1px solid #E5E7EB', borderRadius: 14, overflow: 'hidden' }}>
                                    <div style={{ padding: '10px 16px', borderBottom: '1px solid #F3F4F6' }}>
                                        <span style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                                            {lang === 'de' ? 'FEED-ÜBERSICHT' : 'FEED OVERVIEW'}
                                        </span>
                                    </div>
                                    {(() => {
                                        const s = issues.pflichtScore;
                                        const sc = s >= 90 ? '#16A34A' : s >= 60 ? '#F59E0B' : '#DC2626';
                                        const os = issues.optionalScore;
                                        const oc = os >= 70 ? '#16A34A' : os >= 40 ? '#F59E0B' : '#DC2626';
                                        const tc = issues.totalRows;
                                        const optMappedFields = optFieldStats.fields.filter(f => !f.notMapped);
                                        let optCompleteArticles = 0;
                                        if (optMappedFields.length > 0) {
                                            rows.forEach((r) => {
                                                const allFilled = optMappedFields.every((f) => {
                                                    const col = mcMapping[f.field];
                                                    return col && String(r[col] ?? '').trim();
                                                });
                                                if (allFilled) optCompleteArticles++;
                                            });
                                        }
                                        return (
                                            <div>
                                                <ScoreBar
                                                    title={lang === 'de' ? 'Pflichtfeldabdeckung' : 'Required field coverage'}
                                                    pct={s}
                                                    color={sc}
                                                    complete={issues.livefaehigCount}
                                                    incomplete={issues.blockiertCount}
                                                    total={tc}
                                                    completeLabel={lang === 'de' ? 'Vollständig' : 'Complete'}
                                                    incompleteLabel={lang === 'de' ? 'unvollständig' : 'incomplete'}
                                                    totalLabel={lang === 'de' ? 'gesamt' : 'total'}
                                                    tipComplete={T.tipComplete}
                                                    tipIncomplete={T.tipErrors}
                                                    tipTotal={T.tipTotal}
                                                    numLocale={numLocale}
                                                />
                                                <ScoreBar
                                                    title={lang === 'de' ? 'Optionale Feldabdeckung' : 'Optional field coverage'}
                                                    pct={os}
                                                    color={oc}
                                                    complete={optCompleteArticles}
                                                    incomplete={tc - optCompleteArticles}
                                                    total={tc}
                                                    completeLabel={lang === 'de' ? 'vollständig' : 'complete'}
                                                    incompleteLabel={lang === 'de' ? 'Lücken' : 'gaps'}
                                                    totalLabel={lang === 'de' ? 'gesamt' : 'total'}
                                                    tipComplete={lang === 'de' ? 'Artikel mit allen optionalen Feldern befüllt' : 'Items with all optional fields filled'}
                                                    tipIncomplete={lang === 'de' ? 'Artikel mit mind. einer Lücke in den optionalen Feldern' : 'Items with at least one gap in optional fields'}
                                                    tipTotal={lang === 'de' ? 'Gesamtzahl Artikel im Feed' : 'Total items in the feed'}
                                                    numLocale={numLocale}
                                                />
                                            </div>
                                        );
                                    })()}
                                </div>

                                {/* Card 2, Summary */}
                                <div style={{ background: '#EFF6FF', borderRadius: 14, border: '1px solid #DBEAFE', padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 12L8 4l6 8H2z" stroke="#1E40AF" strokeWidth="1.4" strokeLinejoin="round"/><path d="M8 4v8" stroke="#1E40AF" strokeWidth="1.2"/></svg>
                                    </div>
                                    <div style={{ fontSize: 12, color: '#1E3A8A', lineHeight: 1.6 }}>
                                        {lang === 'de' ? (
                                            <span>Von <strong>{issues.totalRows.toLocaleString(numLocale)}</strong> Artikeln im Feed sind <strong style={{ color: '#166534' }}>{issues.livefaehigCount.toLocaleString(numLocale)}</strong> listbar (<strong>{listablePct}%</strong>).{issues.blockiertCount > 0 && <> <strong style={{ color: '#991B1B' }}>{issues.blockiertCount.toLocaleString(numLocale)}</strong> Artikel weisen Fehler in den Pflichtfeldern auf.</>}</span>
                                        ) : (
                                            <span>Of <strong>{issues.totalRows.toLocaleString(numLocale)}</strong> items in the feed, <strong style={{ color: '#166534' }}>{issues.livefaehigCount.toLocaleString(numLocale)}</strong> are listable (<strong>{listablePct}%</strong>).{issues.blockiertCount > 0 && <> <strong style={{ color: '#991B1B' }}>{issues.blockiertCount.toLocaleString(numLocale)}</strong> items have errors in required fields.</>}</span>
                                        )}
                                    </div>
                                </div>

                                {/* Card 3, So geht es weiter / Next Steps */}
                                <div style={{ background: '#FFF', borderRadius: 14, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
                                    <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid #F3F4F6' }}>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.06em' }}>
                                            {lang === 'de' ? 'SO GEHT ES WEITER' : 'NEXT STEPS'}
                                        </div>
                                    </div>
                                    {[
                                        { n: 1, title: lang === 'de' ? 'Fehlerbericht herunterladen' : 'Download error report', sub: lang === 'de' ? 'CSV-Datei mit allen Fehlern je Zeile für Excel' : 'CSV file with all errors per row for Excel',
                                          icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 2v8M5 7l3 3 3-3M2 13h12" stroke="#2563EB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg> },
                                        { n: 2, title: lang === 'de' ? 'Fehler in Excel korrigieren' : 'Fix errors in Excel', sub: lang === 'de' ? 'Betroffene Artikel anhand der Fehlerspalte bearbeiten' : 'Edit affected items using the error column',
                                          icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M11 2l3 3-8 8H3v-3L11 2z" stroke="#2563EB" strokeWidth="1.4" strokeLinejoin="round"/></svg> },
                                        { n: 3, title: lang === 'de' ? 'Korrigierten Feed hochladen' : 'Upload corrected feed', sub: lang === 'de' ? 'Direkt im Händlerportal unter Einstellungen → Feed' : 'In the merchant portal under Settings → Feed',
                                          icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 10V2M5 5l3-3 3 3" stroke="#2563EB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 13h12" stroke="#2563EB" strokeWidth="1.5" strokeLinecap="round"/></svg> },
                                    ].map((step, i) => (
                                        <div key={step.n} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: i < 2 ? '1px solid #F3F4F6' : 'none' }}>
                                            <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#2563EB', color: '#FFF', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{step.n}</div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{step.title}</div>
                                                <div style={{ fontSize: 10, color: '#6B7280', marginTop: 1 }}>{step.sub}</div>
                                            </div>
                                            <div style={{ width: 28, height: 28, borderRadius: 6, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{step.icon}</div>
                                        </div>
                                    ))}
                                </div>

                                {/* Card 4, Fehlerbericht als CSV (prominent download) */}
                                <div style={{ background: '#EFF6FF', borderRadius: 14, border: '1px solid #BFDBFE', boxShadow: '0 2px 8px rgba(37,99,235,0.08)', overflow: 'hidden' }}>
                                    <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: 10, fontWeight: 700, color: '#2563EB', letterSpacing: '0.06em', marginBottom: 4 }}>
                                                {lang === 'de' ? 'FEHLERBERICHT ALS CSV' : 'ERROR REPORT AS CSV'}
                                            </div>
                                            <div style={{ fontSize: 11, color: '#1E3A8A', lineHeight: 1.5 }}>
                                                {lang === 'de' ? 'Pro Artikel werden alle Fehler in einer Spalte aufgelistet – direkt in Excel korrigierbar.' : 'All errors per item listed in one column – ready to fix in Excel.'}
                                            </div>
                                        </div>
                                        <div style={{ background: '#FFF', borderRadius: 8, padding: '8px 10px', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                            <svg width="20" height="24" viewBox="0 0 20 24" fill="none"><rect width="20" height="24" rx="3" fill="#EFF6FF" stroke="#BFDBFE" strokeWidth="1"/><path d="M4 14h12M4 17h8" stroke="#2563EB" strokeWidth="1.2" strokeLinecap="round"/><rect x="4" y="6" width="7" height="5" rx="1" fill="#DBEAFE"/></svg>
                                            <span style={{ fontSize: 8, fontWeight: 700, color: '#2563EB' }}>CSV</span>
                                        </div>
                                    </div>
                                    <div style={{ padding: '0 14px 12px' }}>
                                        <button type="button" onClick={csvOnClick}
                                            style={{ width: '100%', background: MC_BLUE, color: '#FFF', border: 'none', borderRadius: 8, padding: '10px', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 2v8M5 7l3 3 3-3M2 13h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                            {lang === 'de' ? 'Fehlerbericht herunterladen' : 'Download error report'}
                                        </button>
                                    </div>
                                </div>

                                {/* Nav */}
                                <div>
                                    <button type="button" onClick={() => setStep(4)}
                                        style={{ width: '100%', background: '#FFF', border: '1px solid #D1D5DB', borderRadius: 8, padding: '10px', fontSize: 13, fontWeight: 600, color: '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                        ← {T.back}
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

        {/* Image Lightbox Modal */}
        {imgModal.open && (
            <div
                onClick={() => setImgModal({ open: false, urls: [], idx: 0 })}
                style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1100, padding: 16,
                }}
            >
                <div
                    onClick={(e) => e.stopPropagation()}
                    style={{
                        position: 'relative', display: 'flex', flexDirection: 'column',
                        alignItems: 'center', gap: 12, maxWidth: '90vw',
                    }}
                >
                    {/* Main image */}
                    <img
                        src={imgModal.urls[imgModal.idx]}
                        alt=""
                        style={{
                            maxWidth: '80vw', maxHeight: '70vh', objectFit: 'contain',
                            borderRadius: 8, background: '#FFF', boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
                        }}
                        onError={(e) => { e.target.style.display = 'none'; }}
                    />
                    {/* Counter */}
                    <div style={{ color: '#D1D5DB', fontSize: 12 }}>
                        {imgModal.idx + 1} / {imgModal.urls.length}
                    </div>
                    {/* Thumbnail strip */}
                    {imgModal.urls.length > 1 && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
                            {imgModal.urls.map((url, i) => (
                                <img
                                    key={i}
                                    src={url}
                                    alt=""
                                    onClick={() => setImgModal((m) => ({ ...m, idx: i }))}
                                    style={{
                                        width: 44, height: 44, objectFit: 'cover', borderRadius: 5,
                                        cursor: 'pointer', border: `2px solid ${i === imgModal.idx ? '#93C5FD' : 'transparent'}`,
                                        background: '#374151', opacity: i === imgModal.idx ? 1 : 0.65,
                                        transition: 'opacity 0.15s',
                                    }}
                                    onError={(e) => { e.target.style.display = 'none'; }}
                                />
                            ))}
                        </div>
                    )}
                    {/* Prev / Next arrows */}
                    {imgModal.urls.length > 1 && (
                        <>
                            <button
                                onClick={() => setImgModal((m) => ({ ...m, idx: (m.idx - 1 + m.urls.length) % m.urls.length }))}
                                style={{
                                    position: 'absolute', left: -44, top: '35%',
                                    background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: '50%',
                                    width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: 'pointer', color: '#FFF', fontSize: 18,
                                }}
                            >‹</button>
                            <button
                                onClick={() => setImgModal((m) => ({ ...m, idx: (m.idx + 1) % m.urls.length }))}
                                style={{
                                    position: 'absolute', right: -44, top: '35%',
                                    background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: '50%',
                                    width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: 'pointer', color: '#FFF', fontSize: 18,
                                }}
                            >›</button>
                        </>
                    )}
                    {/* Close button */}
                    <button
                        onClick={() => setImgModal({ open: false, urls: [], idx: 0 })}
                        style={{
                            position: 'absolute', top: -16, right: -16,
                            background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%',
                            width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', color: '#FFF', fontSize: 16, lineHeight: 1,
                        }}
                    >×</button>
                </div>
            </div>
        )}

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
                { label: lang === 'de' ? 'Ausstattung & Lieferumfang' : 'Features & Included', color: '#92400E', cols: ['with_drawer', 'numbers_doors', 'numbers_drawers', 'numbers_shelf', 'softclose', 'set_includes', 'delivery_includes', 'incl_mattress', 'incl_slatted_frame', 'lighting_included', 'illuminant_included', 'socket', 'two_men_handling'] },
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
                                                <div key={col} style={{ border: `1px solid ${isPflicht ? '#FCD34D' : '#E5E7EB'}`, borderRadius: 7, padding: '8px 10px', background: isPflicht ? '#FFFBEB' : '#FAFAFA', display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, overflow: 'hidden' }}>
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
