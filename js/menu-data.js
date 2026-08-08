// Complete Menu Data for El Rey del Gusto
const menuData = {
    pizza_rouge: {
        icon: "🍕",
        title: { fr: "Pizza — Sauce Rouge", ar: "بيتزا — صلصة حمراء", en: "Pizza — Red Sauce" },
        items: [
            { name: "Margherita", price: 350, ingredients: "Sauce tomate, cheddar, olives" },
            { name: "Chicken", price: 400, ingredients: "Sauce tomate, poulet haché, cheddar, olives" },
            { name: "Classique", price: 450, ingredients: "Sauce tomate, viande hachée, olives" },
            { name: "Végétarienne", price: 450, ingredients: "Sauce tomate, maïs, tomate, poivrons, oignons, champignons, cheddar, olives" },
            { name: "Double Fromage", price: 500, ingredients: "Sauce tomate, cheddar, fromage au choix, olives" },
            { name: "La Simple", price: 500, ingredients: "Sauce tomate, viande hachée, poulet haché, cheddar, olives" },
            { name: "La Cabane", price: 550, ingredients: "Sauce tomate, viande hachée, champignons, olives" },
            { name: "Thon", price: 550, ingredients: "Sauce tomate, thon, cheddar, olives" },
            { name: "Fumée", price: 550, ingredients: "Sauce tomate, poulet fumé, cheddar, olives" },
            { name: "Kebab", price: 600, ingredients: "Sauce tomate, kebab, cheddar, olives" },
            { name: "Escalope", price: 600, ingredients: "Sauce tomate, escalope, cheddar, olives" },
            { name: "Mexicaine", price: 650, ingredients: "Sauce tomate, kebab, cheddar, olives" },
            { name: "Pizza Narcos", price: 700, ingredients: "Sauce tomate, kebab, poulet fumé, cheddar, olives", featured: true },
            { name: "Pizza Carbonara", price: 800, ingredients: "Sauce tomate, kebab, viande hachée, poulet fumé, cheddar, olives", featured: true },
            { name: "Pizza El Rey", price: 1000, ingredients: "Tous les ingrédients", signature: true, badge: "Spécialité" },
            { name: "Pizza Farce", price: 1400, ingredients: "Sauce tomate, 100g gouda, 100g mozzarella, 100g cheddar, 3 viandes au choix, olives", signature: true, badge: "Premium" }
        ]
    },
    pizza_blanche: {
        icon: "🧀",
        title: { fr: "Pizza — Sauce Blanche", ar: "بيتزا — صلصة بيضاء", en: "Pizza — White Sauce" },
        items: [
            { name: "Pizza 5 Fromages", price: 750, ingredients: "Crème, gouda, cheddar, mozzarella, gruyère, camembert" },
            { name: "Pizza Tartiflette", price: 750, ingredients: "Crème, kebab, viande hachée, cheddar, olives" },
            { name: "Pizza Reine", price: 750, ingredients: "Crème, légumes caramélisés, viande au choix, gouda, cheddar" },
            { name: "Pizza 3 Fromages Viande", price: 800, ingredients: "Crème, kebab, viande hachée, cheddar, olives" },
            { name: "Pizza Nordique", price: 800, ingredients: "Crème, thon, poulet fumé, gruyère, cheddar" }
        ]
    },
    sandwiches: {
        icon: "🥪",
        title: { fr: "Sandwiches", ar: "سندويشات", en: "Sandwiches" },
        items: [
            { name: "Poulet Haché", price: 250 },
            { name: "Viande Hachée", price: 350 },
            { name: "Escalope", price: 350 },
            { name: "Chawarma", price: 350 },
            { name: "Crispé", price: 400 },
            { name: "Mexicain", price: 400 },
            { name: "Escalope Aux Champignons", price: 400 },
            { name: "Chawarma Syrien", price: 400 },
            { name: "Burrito", price: 600, ingredients: "Viande au choix, sauce piquante, sauce fromagère, sauce mexicaine, poivron, cheddar" },
            { name: "Quesadillas", price: 650, ingredients: "Poulet mariné, sauce piquante, légumes, sauce fromagère, sauce mexicaine, cheddar" },
            { name: "Fajitas", price: 500, ingredients: "Poulet mariné, sauce piquante, sauce mexicaine, sauce fromagère, cheddar" },
            { name: "Roulet 3 Fromages", price: 650, ingredients: "Viande au choix, sauce maison, sauce fromagère, cheddar, camembert, mozzarella" },
            { name: "Wrap", price: 700, ingredients: "Viande au choix, sauce fromagère, sauce maison, salade, tomate, poulet fumé au-dessus" }
        ]
    },
    pains_maison: {
        icon: "🌭",
        title: { fr: "Pains Maison (600 DA)", ar: "خبز البيت (600 دج)", en: "House Breads (600 DA)" },
        items: [
            { name: "Suisse", price: 600, ingredients: "Poulet pané, sauce maison, sauce fromage, gouda, camembert" },
            { name: "Twix", price: 600, ingredients: "Poulet pané, viande hachée, poulet fumé, sauce maison, sauce fromage, cheddar" },
            { name: "Vegas", price: 600, ingredients: "Viande hachée, sauce maison, sauce fromage, gruyère, gouda" },
            { name: "Chicago", price: 600, ingredients: "Poulet mariné, sauce maison, sauce fromage, camembert, gruyère" },
            { name: "Américain", price: 600, ingredients: "Double viande hachée, sauce maison, sauce fromage, camembert, miel au choix" },
            { name: "Dragon", price: 600, ingredients: "Poulet piquant, légumes caramélisés, sauce maison, sauce fromage, gouda" },
            { name: "Délice", price: 600, ingredients: "Escalope de poulet, poulet fumé, gruyère, sauce maison, sauce fromage" }
        ]
    },
    tacos: {
        icon: "🌮",
        title: { fr: "Tacos (M / L / XL)", ar: "تاكوس (وسط / كبير / كبير جداً)", en: "Tacos (M / L / XL)" },
        items: [
            { name: "Tacos Simple", prices: [550, 700, 900], ingredients: "Viande au choix, sauce maison, sauce fromage" },
            { name: "Tacos Fumée", prices: [700, 900, 1200], ingredients: "Viande au choix, gratiné avec poulet fumé au-dessus" },
            { name: "Tacos Cheese Crispy", prices: [750, 950, 1300], ingredients: "Poulet crispy, sauce fromage, sauce maison, gruyère" },
            { name: "Tacos Mexicain", prices: [700, 900, 1200], ingredients: "Poulet mexicain, sauce fromage, sauce maison, sauce mexicaine, gouda" },
            { name: "Tacos Chèvre Miel", prices: [700, 900, 1200], ingredients: "Viande hachée, sauce fromage, sauce maison, camembert, miel" },
            { name: "Tacos Forestier", prices: [550, 700, 900], ingredients: "Poulet aux champignons, sauce fromage, sauce maison, gouda, gratiné" },
            { name: "Tacos Crusty", prices: [800, 1000, 1400], ingredients: "Poulet au choix, sauce fromage, sauce maison, crunchy tortilla, cheddar" },
            { name: "Tacos Family", price: 2000 }
        ]
    },
    burgers: {
        icon: "🍔",
        title: { fr: "Hamburgers", ar: "همبرغر", en: "Burgers" },
        items: [
            { name: "Burger Simple Poulet Haché", price: 200 },
            { name: "Burger Cheese", price: 300 },
            { name: "Burger Double Viande", price: 400 },
            { name: "Burger Crispy", price: 350 },
            { name: "Burger Escalope", price: 350 },
            { name: "Burger Double Cheese", price: 400, ingredients: "viande, gruyère ou gouda" },
            { name: "Big Burger", price: 500, ingredients: "triple viande" },
            { name: "Burger Smoke Smash", price: 550, ingredients: "fumée" },
            { name: "Burger Pané", price: 600, ingredients: "viande, cheddar, rings pané" },
            { name: "Burger El Rey", price: 650, ingredients: "crispy, viande, gouda", signature: true }
        ]
    },
    hot_chicken: {
        icon: "🍗",
        title: { fr: "Hot Chicken (M / L)", ar: "دجاج حار (وسط / كبير)", en: "Hot Chicken (M / L)" },
        items: [
            { name: "Simple", prices: [500, 700] },
            { name: "3 Fromages", prices: [650, 850] },
            { name: "Box Crispy", price: 750, ingredients: "5 pièces, sauce fromage, cheddar" }
        ]
    },
    tenders: {
        icon: "🍗",
        title: { fr: "Tenders", ar: "تندرز", en: "Tenders" },
        items: [
            { name: "3 Pièces", price: 400 },
            { name: "6 Pièces", price: 700 },
            { name: "9 Pièces", price: 950 }
        ]
    },
    wings: {
        icon: "🍗",
        title: { fr: "Wings", ar: "أجنحة", en: "Wings" },
        items: [
            { name: "3 Pièces", price: 300 },
            { name: "6 Pièces", price: 550 },
            { name: "9 Pièces", price: 850 }
        ]
    },
    salades: {
        icon: "🥗",
        title: { fr: "Salades", ar: "سلطات", en: "Salads" },
        items: [
            { name: "Salade César", price: 550 },
            { name: "Salade de pâtes", price: 500 },
            { name: "Salade de pommes de terre", price: 400 },
            { name: "Salade syrienne", price: 300 },
            { name: "Salade algérienne", price: 250 },
            { name: "Salade de riz à l'espagnole", price: 400 }
        ]
    },
    gratins: {
        icon: "🧀",
        title: { fr: "Gratins (M / L)", ar: "غراتان (وسط / كبير)", en: "Gratins (M / L)" },
        items: [
            { name: "Gratin 4 Fromages", prices: [550, 800] },
            { name: "Gratin Viande", prices: [450, 650] },
            { name: "Gratin Poulet", prices: [400, 600] },
            { name: "Gratin aux Légumes", prices: [350, 500] },
            { name: "Gratin Fruits de Mer", prices: [650, 850] },
            { name: "Gratin Fumé", prices: [600, 800] }
        ]
    },
    poutine: {
        icon: "🍟",
        title: { fr: "Poutine", ar: "بوتين", en: "Poutine" },
        items: [
            { name: "Poutine Bœuf", price: 700 },
            { name: "Poutine Poulet", price: 650 },
            { name: "Poutine Mexicaine", price: 650 },
            { name: "Poutine Mixte", price: 800 }
        ]
    },
    bowls: {
        icon: "🥣",
        title: { fr: "Bowls", ar: "بولز", en: "Bowls" },
        items: [
            { name: "Special Bowl", price: 550 },
            { name: "Chef Bowl", price: 600 },
            { name: "Bowl Crispy", price: 600 },
            { name: "Healthy Bowl", price: 500 },
            { name: "Beef Bowl", price: 600 }
        ]
    },
    pastas: {
        icon: "🍝",
        title: { fr: "Pastas", ar: "معكرونة", en: "Pastas" },
        items: [
            { name: "Pasta Bolognaise", price: 650 },
            { name: "Pasta Creamy Alfredo", price: 600 },
            { name: "Pasta 4 Fromages", price: 700 },
            { name: "Pasta Pesto", price: 600 },
            { name: "Smoke Pasta", price: 650 },
            { name: "Pasta Fruits de Mer", price: 800 },
            { name: "Lasagne", price: 900 }
        ]
    },
    omelettes: {
        icon: "🍳",
        title: { fr: "Omelettes", ar: "عجة", en: "Omelettes" },
        items: [
            { name: "Omelette au Fromage", price: 350 },
            { name: "Omelette au Thon", price: 300 },
            { name: "Omelette aux Champignons", price: 350 },
            { name: "Omelette aux Herbes", price: 250 },
            { name: "Omelette au Saumon", price: 550 }
        ]
    },
    camembert: {
        icon: "🧀",
        title: { fr: "Camembert Pané", ar: "كامامبير مقلي", en: "Breaded Camembert" },
        items: [
            { name: "Camembert Pané", price: 450 }
        ]
    },
    plats: {
        icon: "🍽️",
        title: { fr: "Plats", ar: "أطباق", en: "Dishes" },
        items: [
            { name: "Cordon Bleu", price: 1000 },
            { name: "Viande Farcie", price: 1000 },
            { name: "Escalope Panée à la Crème", price: 900 },
            { name: "Poulet Haché Farci", price: 850 },
            { name: "Escalope Grillé 3 Fromages", price: 950 },
            { name: "Le Délicieux", price: 1150 },
            { name: "Escalope aux Légumes", price: 750 },
            { name: "Escalope Grillée", price: 700 },
            { name: "Viande Hachée", price: 700 },
            { name: "Poulet Mariné", price: 700 }
        ]
    },
    assiettes: {
        icon: "🍽️",
        title: { fr: "Assiettes", ar: "صحون", en: "Plates" },
        items: [
            { name: "Crispy", price: 1150, ingredients: "poulet pané, frite, sauce fromage, gruyère" },
            { name: "Grillée", price: 1150, ingredients: "poulet grillé, frite, sauce fromage, hot dog, gruyère" },
            { name: "Kebab", price: 1100, ingredients: "kebab poulet, frite, sauce fromage, gruyère" },
            { name: "Mixte", price: 1300, ingredients: "poulet pané, viande hachée, frite, gruyère, sauce fromage" },
            { name: "BBQ", price: 1300, ingredients: "viande hachée, poulet fumé, frite, sauce fromage, gruyère, sauce BBQ" }
        ]
    },
    gaufres: {
        icon: "🧇",
        title: { fr: "Gaufres", ar: "وافل", en: "Waffles" },
        items: [
            { name: "Simple", price: 350 },
            { name: "1 Fruit", price: 450 },
            { name: "2 Fruits", price: 550 },
            { name: "3 Fruits", price: 650 },
            { name: "Crème Pâtissière", price: 500 }
        ]
    },
    crepes: {
        icon: "🥞",
        title: { fr: "Crêpes", ar: "كريب", en: "Crêpes" },
        items: [
            { name: "Simple", price: 300 },
            { name: "1 Fruit", price: 400 },
            { name: "2 Fruits", price: 500 },
            { name: "3 Fruits", price: 550 },
            { name: "Snickers", price: 700 },
            { name: "Mars", price: 700 },
            { name: "Ferrero", price: 700 },
            { name: "Raffaello", price: 700 },
            { name: "Bueno", price: 700 },
            { name: "Dubaï", price: 700 }
        ]
    },
    pancakes: {
        icon: "🥞",
        title: { fr: "Pancakes", ar: "بان كيك", en: "Pancakes" },
        items: [
            { name: "Simple", price: 300 },
            { name: "1 Fruit", price: 400 },
            { name: "2 Fruits", price: 500 },
            { name: "3 Fruits", price: 550 },
            { name: "Crème Diplomate", price: 400 }
        ]
    },
    supplements: {
        icon: "➕",
        title: { fr: "Suppléments", ar: "إضافات", en: "Extras" },
        items: [
            { name: "Kinder Bueno", price: 200 },
            { name: "Mars", price: 200 },
            { name: "KitKat", price: 200 },
            { name: "Chocolat à Tartiner", price: 150 },
            { name: "Snickers", price: 200 },
            { name: "Nutella", price: 200 }
        ]
    },
    mojitos: {
        icon: "🍹",
        title: { fr: "Mojitos", ar: "موهيتو", en: "Mojitos" },
        items: [
            { name: "Mojito Classique", price: 400 },
            { name: "Mojito Vierge", price: 350 },
            { name: "Mojito Piña Colada", price: 400 },
            { name: "Mojito Blue", price: 400 }
        ]
    },
    mocktails: {
        icon: "🍹",
        title: { fr: "Mocktails", ar: "موكتيل", en: "Mocktails" },
        items: [
            { name: "Piña Colada", price: 450 },
            { name: "Pink Lady", price: 400 },
            { name: "Dragon Blue", price: 450 },
            { name: "Margarita", price: 400 },
            { name: "Blue Lady", price: 400 }
        ]
    },
    boissons_fraiches: {
        icon: "🧃",
        title: { fr: "Boissons Fraîches", ar: "مشروبات باردة", en: "Cold Drinks" },
        items: [
            { name: "Jus de Banane", price: 300 },
            { name: "Jus d'Orange", price: 300 },
            { name: "Jus de Citron", price: 300 },
            { name: "Jus de Pêche", price: 300 },
            { name: "Jus d'Abricot", price: 300 },
            { name: "Ice Coffee", price: 300 },
            { name: "Ice Coffee Vanille", price: 350 },
            { name: "Ice Coffee Noisette", price: 350 },
            { name: "Matcha", price: 550 }
        ]
    },
    boissons_chaudes: {
        icon: "☕",
        title: { fr: "Boissons Chaudes", ar: "مشروبات ساخنة", en: "Hot Drinks" },
        items: [
            { name: "Café Caps", price: 150 },
            { name: "Café au Lait", price: 100 },
            { name: "Cappuccino Light", price: 150 },
            { name: "Cappuccino Noisette", price: 150 },
            { name: "Cappuccino Vanille", price: 150 },
            { name: "Chocolat Chaud", price: 200 },
            { name: "Mocha", price: 350 }
        ]
    },
    desserts: {
        icon: "🍰",
        title: { fr: "Desserts", ar: "حلويات", en: "Desserts" },
        items: [
            { name: "Mousse au Chocolat", price: 400 },
            { name: "Cheesecake", price: 400 },
            { name: "Cake Dubaï", price: 550 },
            { name: "Tiramisu", price: 400 }
        ]
    }
};
