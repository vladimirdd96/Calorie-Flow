import { buildReferenceFoods, type ReferenceFoodRow } from "./builder";

// Raw and simply prepared single foods missing from `produce.ts`: European
// orchard and hedgerow fruit, nuts and seeds, garden herbs and vegetables,
// preserves, and the cooked staples that only exist online as branded packets.
// Values are per 100 g of the edible portion, as eaten.
const rows: readonly ReferenceFoodRow[] = [
  // Fruit
  ["Sour cherries", "вишни, вишна, sour cherry, vishni, tart cherry", 140, "1 bowl (140 g)", [50, 1, 12.2, 0.3, 1.6, 8.5], { verified: true }],
  ["Plum", "слива, сливи, plums, sliva", 66, "1 plum", [46, 0.7, 11.4, 0.3, 1.4, 9.9], { pieceGrams: 66, verified: true }],
  ["Quince", "дюля, дюли, quince, dyulya", 92, "1 quince", [57, 0.4, 15.3, 0.1, 1.9, 9], { pieceGrams: 92, verified: true }],
  ["Persimmon", "райска ябълка, хурма, persimmon, kaki", 168, "1 persimmon", [70, 0.6, 18.6, 0.2, 3.6, 12.5], { pieceGrams: 168, verified: true }],
  ["Mulberries", "черница, черници, mulberry, dud", 140, "1 bowl (140 g)", [43, 1.4, 9.8, 0.4, 1.7, 8.1], { verified: true }],
  ["Blackcurrants", "касис, черно френско грозде, blackcurrant", 112, "1 bowl (112 g)", [63, 1.4, 15.4, 0.4, 4.3, 8], { verified: true }],
  ["Redcurrants", "френско грозде, redcurrant, ribes", 112, "1 bowl (112 g)", [56, 1.4, 13.8, 0.2, 4.3, 7.4], { verified: true }],
  ["Gooseberries", "цариградско грозде, огрозд, gooseberry", 150, "1 bowl (150 g)", [44, 0.9, 10.2, 0.6, 4.3, 8.1], { verified: true }],
  ["Elderberries", "бъз, бъзак, elderberry, sambucus", 100, "1 bowl (100 g)", [73, 0.7, 18.4, 0.5, 7, 7], { verified: true }],
  ["Rosehips", "шипка, шипки, rosehip, rose hips", 50, "1 portion (50 g)", [162, 1.6, 38.2, 0.3, 24.1, 3], { verified: true }],
  ["Sea buckthorn", "облепиха, зърнастец, sea buckthorn", 50, "1 portion (50 g)", [82, 1.4, 10, 3.5, 4.7, 5], { verified: true }],
  ["Cornelian cherries", "дрян, дрянки, cornelian cherry, dryan", 100, "1 bowl (100 g)", [45, 0.9, 10, 0.2, 1.5, 8]],
  ["Honeydew melon", "пъпеш, melon, honeydew, cantaloupe", 180, "1 wedge (180 g)", [36, 0.5, 9.1, 0.1, 0.8, 8.1], { verified: true }],
  ["Pomelo", "помело, pomelo", 190, "1 portion (190 g)", [38, 0.8, 9.6, 0, 1, 8], { verified: true }],
  ["Clementine", "клементина, мандарина, clementine, satsuma", 74, "1 clementine", [47, 0.9, 12, 0.2, 1.7, 9], { pieceGrams: 74, verified: true }],
  ["Prunes", "сушени сливи, prunes, dried plums", 40, "5 prunes (40 g)", [240, 2.2, 63.9, 0.4, 7.1, 38.1], { verified: true }],
  ["Dried apricots", "сушени кайсии, dried apricots", 40, "5 halves (40 g)", [241, 3.4, 62.6, 0.5, 7.3, 53.4], { verified: true }],
  ["Raisins", "стафиди, raisins, sultanas", 30, "1 handful (30 g)", [299, 3.1, 79.2, 0.5, 3.7, 59.2], { verified: true }],
  ["Dried figs", "сушени смокини, dried figs", 40, "2 figs (40 g)", [249, 3.3, 63.9, 0.9, 9.8, 47.9], { verified: true }],

  // Nuts and seeds
  ["Walnuts", "орехи, орех, walnut", 30, "1 handful (30 g)", [654, 15.2, 13.7, 65.2, 6.7, 2.6], { verified: true }],
  ["Hazelnuts", "лешници, лешник, hazelnut, filbert", 30, "1 handful (30 g)", [628, 15, 16.7, 60.8, 9.7, 4.3], { verified: true }],
  ["Almonds", "бадеми, бадем, almond", 30, "1 handful (30 g)", [579, 21.2, 21.6, 49.9, 12.5, 4.4], { verified: true }],
  ["Peanuts", "фъстъци, фъстък, peanut, groundnut", 30, "1 handful (30 g)", [567, 25.8, 16.1, 49.2, 8.5, 4.7], { verified: true }],
  ["Pistachios", "шам фъстък, фъстъци шам, pistachio", 30, "1 handful (30 g)", [560, 20.2, 27.2, 45.3, 10.6, 7.7], { verified: true }],
  ["Cashews", "кашу, cashew nuts", 30, "1 handful (30 g)", [553, 18.2, 30.2, 43.9, 3.3, 5.9], { verified: true }],
  ["Sunflower seeds", "слънчогледови семки, семки, sunflower seeds, semki", 30, "1 handful (30 g)", [584, 20.8, 20, 51.5, 8.6, 2.6], { verified: true }],
  ["Pumpkin seeds", "тиквени семки, pumpkin seeds", 30, "1 handful (30 g)", [559, 30.2, 10.7, 49, 6, 1.4], { verified: true }],
  ["Sesame seeds", "сусам, sesame seeds", 15, "1 tbsp (15 g)", [573, 17.7, 23.4, 49.7, 11.8, 0.3], { verified: true }],
  ["Tahini", "тахан, тахини, tahini, sesame paste", 20, "1 tbsp (20 g)", [595, 17, 21.2, 53.8, 9.3, 0.5], { verified: true }],
  ["Roasted chestnuts", "печени кестени, кестен, chestnuts", 100, "1 portion (100 g)", [245, 3.2, 53, 2.2, 5.1, 10.6], { verified: true }],

  // Vegetables and herbs
  ["Spring onion", "зелен лук, пресен лук, spring onion, scallion", 15, "1 stalk (15 g)", [32, 1.8, 7.3, 0.2, 2.6, 2.3], { verified: true }],
  ["Parsley", "магданоз, parsley", 10, "1 handful (10 g)", [36, 3, 6.3, 0.8, 3.3, 0.9], { verified: true }],
  ["Dill", "копър, dill", 10, "1 handful (10 g)", [43, 3.5, 7, 1.1, 2.1, 0], { verified: true }],
  ["Celeriac", "целина корен, celeriac, celery root", 100, "1 portion (100 g)", [42, 1.5, 9.2, 0.3, 1.8, 1.6], { verified: true }],
  ["Kohlrabi", "алабаш, кольраби, kohlrabi", 135, "1 kohlrabi", [27, 1.7, 6.2, 0.1, 3.6, 2.6], { pieceGrams: 135, verified: true }],
  ["Parsnip", "пащърнак, parsnip", 130, "1 parsnip", [75, 1.2, 18, 0.3, 4.9, 4.8], { pieceGrams: 130, verified: true }],
  ["Horseradish", "хрян, horseradish", 15, "1 tbsp (15 g)", [48, 1.2, 11.3, 0.7, 3.3, 8], { verified: true }],
  ["Sorrel", "киселец, sorrel", 100, "1 portion (100 g)", [22, 2, 3.2, 0.7, 2.9, 0.3], { verified: true }],
  ["Nettle", "коприва, nettle, stinging nettle", 100, "1 portion (100 g)", [42, 2.7, 7.5, 0.1, 6.9, 0.3], { verified: true }],
  ["Purslane", "тученица, purslane", 100, "1 portion (100 g)", [16, 1.3, 3.4, 0.4, 1.1, 0.5], { verified: true }],
  ["Rocket", "рукола, rocket, arugula", 40, "1 handful (40 g)", [25, 2.6, 3.7, 0.7, 1.6, 2], { verified: true }],
  ["Radicchio", "радичио, radicchio", 40, "1 handful (40 g)", [23, 1.4, 4.5, 0.2, 0.9, 0.6], { verified: true }],
  ["Endive", "ендивия, endive, chicory", 50, "1 portion (50 g)", [17, 1.3, 3.4, 0.2, 3.1, 0.3], { verified: true }],
  ["Watercress", "воден кресон, watercress", 35, "1 handful (35 g)", [11, 2.3, 1.3, 0.1, 0.5, 0.2], { verified: true }],
  ["Ginger", "джинджифил, ginger root", 10, "1 piece (10 g)", [80, 1.8, 17.8, 0.8, 2, 1.7], { verified: true }],
  ["Red chilli pepper", "лют пипер, люта чушка, chilli, hot pepper", 15, "1 chilli", [40, 1.9, 8.8, 0.4, 1.5, 5.3], { pieceGrams: 15, verified: true }],
  ["Porcini mushrooms", "манатарки, манатарка, porcini, cep, boletus", 100, "1 portion (100 g)", [34, 3.1, 6, 0.5, 2.5, 1.3]],
  ["Oyster mushrooms", "кладница, стридени гъби, oyster mushrooms", 100, "1 portion (100 g)", [33, 3.3, 6.1, 0.4, 2.3, 1.1], { verified: true }],

  // Preserves, pickles and pantry
  ["Green olives", "зелени маслини, green olives", 30, "8 olives (30 g)", [145, 1, 3.8, 15.3, 3.3, 0.5], { verified: true }],
  ["Black olives", "черни маслини, kalamata, black olives", 30, "8 olives (30 g)", [115, 0.8, 6.3, 10.9, 3.2, 0], { verified: true }],
  ["Sun-dried tomatoes", "сушени домати, sun dried tomatoes", 20, "1 portion (20 g)", [258, 14.1, 55.8, 3, 12.3, 37.6], { verified: true }],
  ["Capers", "каперси, capers", 15, "1 tbsp (15 g)", [23, 2.4, 4.9, 0.9, 3.2, 0.4], { verified: true }],
  ["Pickled gherkins", "кисели краставички, корнишони, gherkins, pickles", 60, "2 gherkins (60 g)", [12, 0.6, 2.3, 0.2, 1, 1.1], { verified: true }],
  ["Roasted red peppers in brine", "печени чушки в буркан, roasted peppers jar", 60, "1 portion (60 g)", [30, 1, 5.5, 0.3, 1.6, 3.5]],
  ["Ajvar-style pepper paste", "пиперена паста, pepper paste, biber salcasi", 30, "2 tbsp (30 g)", [100, 2.5, 16, 2.5, 3, 11]],

  // Legumes, grains and cooked staples
  ["White beans, cooked", "варен боб, боб, white beans, haricot beans", 200, "1 bowl (200 g)", [127, 8.7, 22.8, 0.5, 6.3, 0.3], { verified: true }],
  ["Lentils, cooked", "варена леща, леща, lentils", 200, "1 bowl (200 g)", [116, 9, 20.1, 0.4, 7.9, 1.8], { verified: true }],
  ["Chickpeas, cooked", "нахут, chickpeas, garbanzo", 200, "1 bowl (200 g)", [164, 8.9, 27.4, 2.6, 7.6, 4.8], { verified: true }],
  ["Broad beans, cooked", "бакла, broad beans, fava beans", 150, "1 portion (150 g)", [110, 7.6, 19.6, 0.4, 5.4, 1.8], { verified: true }],
  ["Bulgur, cooked", "булгур, bulgur, burghul", 180, "1 bowl (180 g)", [83, 3.1, 18.6, 0.2, 4.5, 0.1], { verified: true }],
  ["Couscous, cooked", "кус-кус, couscous", 180, "1 bowl (180 g)", [112, 3.8, 23.2, 0.2, 1.4, 0.1], { verified: true }],
  ["Buckwheat, cooked", "елда, buckwheat, grechka", 180, "1 bowl (180 g)", [92, 3.4, 19.9, 0.6, 2.7, 0.9], { verified: true }],
  ["Quinoa, cooked", "киноа, quinoa", 180, "1 bowl (180 g)", [120, 4.4, 21.3, 1.9, 2.8, 0.9], { verified: true }],
  ["Brown rice, cooked", "кафяв ориз, brown rice", 150, "1 bowl (150 g)", [123, 2.7, 25.6, 1, 1.6, 0.2], { verified: true }],
  ["Pasta, cooked", "варени макарони, спагети, pasta, spaghetti", 200, "1 plate (200 g)", [158, 5.8, 30.9, 0.9, 1.8, 0.6], { verified: true }],
  ["Boiled potatoes", "варени картофи, boiled potatoes", 200, "1 portion (200 g)", [87, 1.9, 20.1, 0.1, 1.8, 0.9], { verified: true }],
  ["Mashed potatoes", "картофено пюре, mashed potato, puree", 200, "1 portion (200 g)", [113, 2, 16.9, 4.2, 1.5, 1.5]],
];

export const pantryFoods = buildReferenceFoods(rows);
