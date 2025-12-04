
const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, 'src/i18n/locales');

const dePath = path.join(localesDir, 'de.json');
const enPath = path.join(localesDir, 'en.json');
const ruPath = path.join(localesDir, 'ru.json');

function updateDe() {
    const data = JSON.parse(fs.readFileSync(dePath, 'utf8'));

    // Landing Page Translations
    data.landing = {
        "nav": {
            "start": "Jetzt starten"
        },
        "hero": {
            "tagline": "Magische Geschichten für dein Kind",
            "page1": "Es war einmal...",
            "page2": "...ein Kind voller Träume.",
            "page3": "Deine Reise beginnt hier.",
            "coverTitle": "Deine Geschichte",
            "scrollHint": "Scroll zum Öffnen"
        },
        "features": {
            "title": "Entdecke die Welt von Talea",
            "stories": {
                "title": "Personalisierte Geschichten",
                "subtitle": "Der Storywald",
                "description": "Dein Kind wird zur Hauptfigur in magischen Märchen, Abenteuern und Dokumentationen."
            },
            "avatars": {
                "title": "Einzigartige Avatare",
                "subtitle": "Die Avatar-Werkstatt",
                "description": "Erstelle einen digitalen Zwilling deines Kindes, der in jeder Geschichte lebendig wird."
            },
            "learning": {
                "title": "Spielend Lernen",
                "subtitle": "Die Wissensberge",
                "description": "Bildungsinhalte verpackt in spannende Geschichten, die Neugier wecken."
            },
            "memory": {
                "title": "Wachsendes Gedächtnis",
                "subtitle": "Der Erinnerungsbaum",
                "description": "Talea merkt sich alles und baut auf vorherigen Abenteuern auf."
            },
            "values": {
                "title": "Werte vermitteln",
                "subtitle": "Der Werte-Garten",
                "description": "Freundschaft, Mut und Mitgefühl – kindgerecht in Geschichten eingebettet."
            },
            "parents": {
                "title": "Volle Kontrolle",
                "subtitle": "Die Eltern-Lounge",
                "description": "Du bestimmst Themen, Länge und Inhalte. 100% kindersicher."
            }
        },
        "pricing": {
            "title": "Wähle deinen Plan",
            "popular": "Beliebt",
            "starter": {
                "name": "Starter",
                "price": "Kostenlos",
                "features": ["3 Geschichten pro Monat", "1 Avatar", "Standard-Qualität"],
                "cta": "Kostenlos starten"
            },
            "family": {
                "name": "Familie",
                "price": "€9,99",
                "period": "/Monat",
                "features": ["Unbegrenzte Geschichten", "5 Avatare", "HD-Qualität", "Gedächtnis-Funktion", "Keine Werbung"],
                "cta": "Jetzt starten"
            },
            "premium": {
                "name": "Premium",
                "price": "€19,99",
                "period": "/Monat",
                "features": ["Alles aus Familie", "Unbegrenzte Avatare", "4K-Qualität", "Prioritäts-Support", "Frühzugang zu Features"],
                "cta": "Premium wählen"
            }
        },
        "footer": {
            "copyright": "Magische Geschichten für Kinder © 2025",
            "privacy": "Datenschutz",
            "terms": "AGB",
            "contact": "Kontakt"
        }
    };

    data.wizard = {
        "titles": {
            "avatars": "Wer spielt in der Geschichte mit?",
            "category": "Was für eine Geschichte soll es werden?",
            "ageLength": "Für welches Alter & wie lang?",
            "feeling": "Welches Gefühl soll die Geschichte haben?",
            "wishes": "Besondere Wünsche? (Optional)",
            "summary": "Alles bereit!"
        },
        "subtitles": {
            "avatars": "Wähle 1-4 Avatare aus, die Teil der Geschichte werden sollen.",
            "category": "Wähle eine Kategorie aus - deine Avatare werden Teil einer einzigartigen Geschichte!",
            "ageLength": "Passe die Geschichte an das Alter und die verfügbare Zeit an.",
            "feeling": "Wähle 1-3 Stimmungen aus, die die Geschichte prägen sollen.",
            "wishes": "Füge besondere Features hinzu oder überspringe diesen Schritt.",
            "summary": "Überprüfe deine Auswahl und erstelle die Geschichte."
        },
        "buttons": {
            "back": "Zurück",
            "next": "Weiter",
            "create": "Erstellen",
            "generate": "✨ Geschichte erstellen! ✨"
        },
        "common": {
            "examples": "BEISPIELE:",
            "note": "💡 Hinweis:",
            "categoryNote": "Jede Kategorie erstellt eine komplett neue Geschichte speziell für deine Avatare. Es wird keine vorgeschriebene Geschichte erzählt, sondern eine individuelle Geschichte erschaffen!",
            "wishesNote": "Alle Wünsche sind optional. Die KI wird ihr Bestes tun, deine Wünsche einzubauen, aber die Geschichte bleibt immer spannend und logisch!",
            "summaryNote": "Die KI erstellt eine komplett neue Geschichte basierend auf deinen Wünschen. Das dauert ca. 60-90 Sekunden. Mit Bildern insgesamt 2-3 Minuten.",
            "selected": "ausgewählt",
            "notSelected": "Nicht gewählt",
            "customWish": "💬 Eigener Wunsch (optional):",
            "customWishPlaceholder": "z.B. 'Die Geschichte soll im Weltall spielen' oder 'Mit einem sprechenden Drachen'",
            "chars": "Zeichen"
        },
        "categories": {
            "fairy_tales": {
                "title": "Klassische Märchen",
                "description": "Verwunschene Welten, Könige & Prinzessinnen, magische Wesen",
                "examples": "Hänsel & Gretel, Rotkäppchen, Bremer Stadtmusikanten"
            },
            "adventure": {
                "title": "Abenteuer & Schätze",
                "description": "Spannende Reisen, versteckte Schätze, mutige Helden",
                "examples": "Schatzsuche, Geheime Höhlen, Wilde Expeditionen"
            },
            "magic": {
                "title": "Märchenwelten & Magie",
                "description": "Zaubersprüche, fliegende Teppiche, magische Kräfte",
                "examples": "Zauberer, Feen, Magische Gegenstände"
            },
            "animals": {
                "title": "Tierwelten",
                "description": "Sprechende Tiere, Waldabenteuer, Tierfreundschaften",
                "examples": "Im Wald, Auf dem Bauernhof, In der Wildnis"
            },
            "scifi": {
                "title": "Sci-Fi & Zukunft",
                "description": "Raumschiffe, fremde Planeten, futuristische Welten",
                "examples": "Weltraumabenteuer, Roboter, Zeitreisen"
            },
            "modern": {
                "title": "Modern & Realität",
                "description": "Alltag, Schule, Familie, echte Erlebnisse",
                "examples": "Heute & Hier, Realistische Geschichten"
            }
        },
        "ageGroups": {
            "3-5": {
                "title": "3-5 Jahre",
                "description": "Kurze, einfache Geschichten"
            },
            "6-8": {
                "title": "6-8 Jahre",
                "description": "Spannende Abenteuer"
            },
            "9-12": {
                "title": "9-12 Jahre",
                "description": "Komplexere Handlungen"
            },
            "13+": {
                "title": "13+ Jahre",
                "description": "Tiefgründige Geschichten"
            }
        },
        "lengths": {
            "short": {
                "title": "Kurz",
                "duration": "3-5 Min",
                "chapters": "3 Kapitel"
            },
            "medium": {
                "title": "Mittel",
                "duration": "8-12 Min",
                "chapters": "5 Kapitel"
            },
            "long": {
                "title": "Lang",
                "duration": "15-20 Min",
                "chapters": "7 Kapitel"
            }
        },
        "feelings": {
            "funny": {
                "title": "Lustig",
                "description": "Zum Lachen & Schmunzeln"
            },
            "warm": {
                "title": "Herzerwärmend",
                "description": "Liebevolle Momente"
            },
            "exciting": {
                "title": "Aufregend",
                "description": "Spannende Action"
            },
            "crazy": {
                "title": "Verrückt",
                "description": "Wilde Überraschungen"
            },
            "meaningful": {
                "title": "Bedeutsam",
                "description": "Mit wichtiger Botschaft"
            }
        },
        "summary": {
            "avatars": "Avatare",
            "age": "Alter",
            "category": "Kategorie",
            "length": "Länge",
            "feelings": "Gefühle",
            "wishes": "Wünsche",
            "ready": "Deine Geschichte wird jetzt erstellt!"
        },
        "wishes": {
            "rhymes": {
                "title": "Reime & Verse",
                "description": "Die Geschichte wird in Reimen erzählt"
            },
            "moral": {
                "title": "Moral & Werte",
                "description": "Die Geschichte vermittelt eine wichtige Lektion"
            },
            "avatarIsHero": {
                "title": "Avatar ist Held",
                "description": "Dein Avatar spielt die Hauptrolle"
            },
            "famousCharacters": {
                "title": "Bekannte Figuren",
                "description": "Triff Figuren aus bekannten Märchen"
            },
            "happyEnd": {
                "title": "Happy End",
                "description": "Die Geschichte geht gut aus"
            },
            "surpriseEnd": {
                "title": "Überraschendes Ende",
                "description": "Ein unerwarteter Schluss"
            }
        },
        "steps": {
            "avatars": "Avatare",
            "category": "Kategorie",
            "ageLength": "Alter & Länge",
            "feeling": "Gefühle",
            "wishes": "Wünsche",
            "summary": "Zusammenfassung"
        }
    };

    fs.writeFileSync(dePath, JSON.stringify(data, null, 2));
    console.log('Updated de.json');
}

function updateEn() {
    const data = JSON.parse(fs.readFileSync(enPath, 'utf8'));

    // Landing Page Translations
    data.landing = {
        "nav": {
            "start": "Get Started"
        },
        "hero": {
            "tagline": "Magical stories for your child",
            "page1": "Once upon a time...",
            "page2": "...a child full of dreams.",
            "page3": "Your journey begins here.",
            "coverTitle": "Your Story",
            "scrollHint": "Scroll to Open"
        },
        "features": {
            "title": "Discover the World of Talea",
            "stories": {
                "title": "Personalized Stories",
                "subtitle": "The Story Forest",
                "description": "Your child becomes the main character in magical fairy tales, adventures and documentaries."
            },
            "avatars": {
                "title": "Unique Avatars",
                "subtitle": "The Avatar Workshop",
                "description": "Create a digital twin of your child that comes alive in every story."
            },
            "learning": {
                "title": "Learning Through Play",
                "subtitle": "The Mountains of Knowledge",
                "description": "Educational content wrapped in exciting stories that spark curiosity."
            },
            "memory": {
                "title": "Growing Memory",
                "subtitle": "The Memory Tree",
                "description": "Talea remembers everything and builds on previous adventures."
            },
            "values": {
                "title": "Conveying Values",
                "subtitle": "The Values Garden",
                "description": "Friendship, courage and compassion – embedded in stories for children."
            },
            "parents": {
                "title": "Full Control",
                "subtitle": "The Parents Lounge",
                "description": "You determine topics, length and content. 100% child-safe."
            }
        },
        "pricing": {
            "title": "Choose Your Plan",
            "popular": "Popular",
            "starter": {
                "name": "Starter",
                "price": "Free",
                "features": ["3 stories per month", "1 Avatar", "Standard quality"],
                "cta": "Start Free"
            },
            "family": {
                "name": "Family",
                "price": "€9.99",
                "period": "/month",
                "features": ["Unlimited stories", "5 Avatars", "HD quality", "Memory function", "Ad-free"],
                "cta": "Get Started"
            },
            "premium": {
                "name": "Premium",
                "price": "€19.99",
                "period": "/month",
                "features": ["Everything in Family", "Unlimited Avatars", "4K quality", "Priority support", "Early access to features"],
                "cta": "Choose Premium"
            }
        },
        "footer": {
            "copyright": "Magical Stories for Children © 2025",
            "privacy": "Privacy",
            "terms": "Terms",
            "contact": "Contact"
        }
    };

    data.wizard = {
        "titles": {
            "avatars": "Who is in the story?",
            "category": "What kind of story should it be?",
            "ageLength": "For which age & how long?",
            "feeling": "What feeling should the story have?",
            "wishes": "Special wishes? (Optional)",
            "summary": "All ready!"
        },
        "subtitles": {
            "avatars": "Select 1-4 avatars to be part of the story.",
            "category": "Choose a category - your avatars will be part of a unique story!",
            "ageLength": "Adjust the story to the age and available time.",
            "feeling": "Select 1-3 moods that should shape the story.",
            "wishes": "Add special features or skip this step.",
            "summary": "Check your selection and create the story."
        },
        "buttons": {
            "back": "Back",
            "next": "Next",
            "create": "Create",
            "generate": "✨ Create Story! ✨"
        },
        "common": {
            "examples": "EXAMPLES:",
            "note": "💡 Note:",
            "categoryNote": "Each category creates a completely new story specifically for your avatars. No pre-written story is told, but an individual story is created!",
            "wishesNote": "All wishes are optional. The AI will do its best to include your wishes, but the story will always remain exciting and logical!",
            "summaryNote": "The AI creates a completely new story based on your wishes. This takes about 60-90 seconds. With images a total of 2-3 minutes.",
            "selected": "selected",
            "notSelected": "Not selected",
            "customWish": "💬 Custom wish (optional):",
            "customWishPlaceholder": "e.g. 'The story should take place in space' or 'With a talking dragon'",
            "chars": "chars"
        },
        "categories": {
            "fairy_tales": {
                "title": "Classic Fairy Tales",
                "description": "Enchanted worlds, kings & princesses, magical creatures",
                "examples": "Hansel & Gretel, Little Red Riding Hood, Bremen Town Musicians"
            },
            "adventure": {
                "title": "Adventure & Treasures",
                "description": "Exciting journeys, hidden treasures, brave heroes",
                "examples": "Treasure Hunt, Secret Caves, Wild Expeditions"
            },
            "magic": {
                "title": "Fairy Tale Worlds & Magic",
                "description": "Spells, flying carpets, magical powers",
                "examples": "Wizards, Fairies, Magical Objects"
            },
            "animals": {
                "title": "Animal Worlds",
                "description": "Talking animals, forest adventures, animal friendships",
                "examples": "In the Forest, On the Farm, In the Wild"
            },
            "scifi": {
                "title": "Sci-Fi & Future",
                "description": "Spaceships, alien planets, futuristic worlds",
                "examples": "Space Adventures, Robots, Time Travel"
            },
            "modern": {
                "title": "Modern & Reality",
                "description": "Everyday life, school, family, real experiences",
                "examples": "Here & Now, Realistic Stories"
            }
        },
        "ageGroups": {
            "3-5": {
                "title": "3-5 Years",
                "description": "Short, simple stories"
            },
            "6-8": {
                "title": "6-8 Years",
                "description": "Exciting adventures"
            },
            "9-12": {
                "title": "9-12 Years",
                "description": "More complex plots"
            },
            "13+": {
                "title": "13+ Years",
                "description": "Profound stories"
            }
        },
        "lengths": {
            "short": {
                "title": "Short",
                "duration": "3-5 Min",
                "chapters": "3 chapters"
            },
            "medium": {
                "title": "Medium",
                "duration": "8-12 Min",
                "chapters": "5 chapters"
            },
            "long": {
                "title": "Long",
                "duration": "15-20 Min",
                "chapters": "7 chapters"
            }
        },
        "feelings": {
            "funny": {
                "title": "Funny",
                "description": "Laugh out loud"
            },
            "warm": {
                "title": "Heartwarming",
                "description": "Loving moments"
            },
            "exciting": {
                "title": "Exciting",
                "description": "Thrilling action"
            },
            "crazy": {
                "title": "Crazy",
                "description": "Wild surprises"
            },
            "meaningful": {
                "title": "Meaningful",
                "description": "With important message"
            }
        },
        "summary": {
            "avatars": "Avatars",
            "age": "Age",
            "category": "Category",
            "length": "Length",
            "feelings": "Feelings",
            "wishes": "Wishes",
            "ready": "Your story will be created now!"
        },
        "wishes": {
            "rhymes": {
                "title": "Rhymes & Verses",
                "description": "The story is told in rhymes"
            },
            "moral": {
                "title": "Moral & Values",
                "description": "The story conveys an important lesson"
            },
            "avatarIsHero": {
                "title": "Avatar is Hero",
                "description": "Your avatar plays the main role"
            },
            "famousCharacters": {
                "title": "Famous Characters",
                "description": "Meet characters from famous fairy tales"
            },
            "happyEnd": {
                "title": "Happy End",
                "description": "The story ends well"
            },
            "surpriseEnd": {
                "title": "Surprise Ending",
                "description": "An unexpected ending"
            }
        },
        "steps": {
            "avatars": "Avatars",
            "category": "Category",
            "ageLength": "Age & Length",
            "feeling": "Feelings",
            "wishes": "Wishes",
            "summary": "Summary"
        }
    };

    fs.writeFileSync(enPath, JSON.stringify(data, null, 2));
    console.log('Updated en.json');
}

function updateRu() {
    const data = JSON.parse(fs.readFileSync(ruPath, 'utf8'));

    // Landing Page Translations
    data.landing = {
        "nav": {
            "start": "Начать"
        },
        "hero": {
            "tagline": "Волшебные истории для вашего ребенка",
            "page1": "Жил-был когда-то...",
            "page2": "...ребенок, полный мечтаний.",
            "page3": "Здесь начинается твое путешествие.",
            "coverTitle": "Твоя история",
            "scrollHint": "Прокрутите для открытия"
        },
        "features": {
            "title": "Откройте мир Talea",
            "stories": {
                "title": "Персонализированные истории",
                "subtitle": "Лес историй",
                "description": "Ваш ребенок становится главным героем в волшебных сказках, приключениях и документах."
            },
            "avatars": {
                "title": "Уникальные аватары",
                "subtitle": "Мастерская аватаров",
                "description": "Создайте цифрового близнеца вашего ребенка, который оживает в каждой истории."
            },
            "learning": {
                "title": "Обучение через игру",
                "subtitle": "Горы знаний",
                "description": "Образовательный контент, упакованный в захватывающие истории, пробуждающие любопытство."
            },
            "memory": {
                "title": "Растущая память",
                "subtitle": "Дерево воспоминаний",
                "description": "Talea помнит все и строит на предыдущих приключениях."
            },
            "values": {
                "title": "Передача ценностей",
                "subtitle": "Сад ценностей",
                "description": "Дружба, мужество и сострадание – встроенные в детские истории."
            },
            "parents": {
                "title": "Полный контроль",
                "subtitle": "Комната родителей",
                "description": "Вы определяете темы, длину и содержание. 100% безопасно для детей."
            }
        },
        "pricing": {
            "title": "Выберите свой план",
            "popular": "Популярный",
            "starter": {
                "name": "Стартовый",
                "price": "Бесплатно",
                "features": ["3 истории в месяц", "1 Аватар", "Стандартное качество"],
                "cta": "Начать бесплатно"
            },
            "family": {
                "name": "Семейный",
                "price": "€9.99",
                "period": "/месяц",
                "features": ["Неограниченные истории", "5 Аватаров", "HD качество", "Функция памяти", "Без рекламы"],
                "cta": "Начать"
            },
            "premium": {
                "name": "Премиум",
                "price": "€19.99",
                "period": "/месяц",
                "features": ["Все из Семейного", "Неограниченные аватары", "4K качество", "Приоритетная поддержка", "Ранний доступ к функциям"],
                "cta": "Выбрать Премиум"
            }
        },
        "footer": {
            "copyright": "Волшебные истории для детей © 2025",
            "privacy": "Конфиденциальность",
            "terms": "Условия",
            "contact": "Контакты"
        }
    };

    // Fix doku.wizard structure
    if (data.doku) {
        // Ensure wizard exists
        if (!data.doku.wizard) {
            data.doku.wizard = {};
        }

        // Helper to nest if string
        const nest = (key, title) => {
            if (typeof data.doku.wizard[key] === 'string') {
                data.doku.wizard[key] = { title: data.doku.wizard[key] };
            } else if (!data.doku.wizard[key]) {
                data.doku.wizard[key] = { title: title };
            }
        };

        nest('depth', 'Глубина');
        nest('perspective', 'Перспектива');
        nest('length', 'Длительность');
        nest('tone', 'Тон');

        // Move options into the nested objects
        if (data.doku.depths) {
            Object.assign(data.doku.wizard.depth, data.doku.depths);
        }
        if (data.doku.perspectives) {
            Object.assign(data.doku.wizard.perspective, data.doku.perspectives);
        }
        if (data.doku.tones) {
            Object.assign(data.doku.wizard.tone, data.doku.tones);
        }
        // Lengths seem to be missing in ru.json doku.wizard, check if they are elsewhere
        if (data.doku.lengths) {
            Object.assign(data.doku.wizard.length, data.doku.lengths);
        }

        // Move simple keys
        const simpleKeys = {
            'topic': 'topicLabel',
            'topicPlaceholder': 'topicPlaceholder',
            'ageGroup': 'ageGroup',
            'interactive': 'interactive',
            'quizQuestions': 'quizQuestions',
            'activities': 'activities',
            'generateDoku': 'generate',
            'generating': 'generating'
        };

        for (const [src, dest] of Object.entries(simpleKeys)) {
            if (data.doku[src]) {
                data.doku.wizard[dest] = data.doku[src];
            }
        }

        // Add errors
        if (!data.doku.wizard.errors) {
            data.doku.wizard.errors = {
                missingTopic: "Пожалуйста, введите тему",
                generationFailed: data.doku.generationError || "Ошибка генерации"
            };
        }

        // Add age options if missing
        if (!data.doku.wizard.age) {
            data.doku.wizard.age = {
                "3_5": "3-5 лет",
                "6_8": "6-8 лет",
                "9_12": "9-12 лет",
                "13_plus": "13+ лет"
            };
        }
    }

    // Add wizard object
    data.wizard = {
        "titles": {
            "avatars": "Кто участвует в истории?",
            "category": "Какая это будет история?",
            "ageLength": "Для какого возраста и как долго?",
            "feeling": "Какое настроение должно быть у истории?",
            "wishes": "Особые пожелания? (Опционально)",
            "summary": "Все готово!"
        },
        "subtitles": {
            "avatars": "Выберите 1-4 аватаров для истории.",
            "category": "Выберите категорию - ваши аватары станут частью уникальной истории!",
            "ageLength": "Настройте историю под возраст и доступное время.",
            "feeling": "Выберите 1-3 настроения, которые сформируют историю.",
            "wishes": "Добавьте особые функции или пропустите этот шаг.",
            "summary": "Проверьте выбор и создайте историю."
        },
        "buttons": {
            "back": "Назад",
            "next": "Далее",
            "create": "Создать",
            "generate": "✨ Создать историю! ✨"
        },
        "common": {
            "examples": "ПРИМЕРЫ:",
            "note": "💡 Примечание:",
            "categoryNote": "Каждая категория создает совершенно новую историю специально для ваших аватаров!",
            "wishesNote": "Все пожелания опциональны. ИИ постарается их учесть, но история всегда останется логичной!",
            "summaryNote": "ИИ создает новую историю на основе ваших пожеланий. Это займет 60-90 секунд.",
            "selected": "выбрано",
            "notSelected": "Не выбрано",
            "customWish": "💬 Свое пожелание (опционально):",
            "customWishPlaceholder": "Например: 'История должна происходить в космосе'",
            "chars": "символов"
        },
        "categories": {
            "fairy_tales": {
                "title": "Классические сказки",
                "description": "Зачарованные миры, короли и принцессы",
                "examples": "Гензель и Гретель, Красная Шапочка"
            },
            "adventure": {
                "title": "Приключения и сокровища",
                "description": "Захватывающие путешествия, скрытые сокровища",
                "examples": "Поиск сокровищ, Тайные пещеры"
            },
            "magic": {
                "title": "Волшебные миры",
                "description": "Заклинания, ковры-самолеты, магические силы",
                "examples": "Волшебники, Феи"
            },
            "animals": {
                "title": "Мир животных",
                "description": "Говорящие животные, лесные приключения",
                "examples": "В лесу, На ферме"
            },
            "scifi": {
                "title": "Фантастика и будущее",
                "description": "Космические корабли, чужие планеты",
                "examples": "Космические приключения, Роботы"
            },
            "modern": {
                "title": "Современность",
                "description": "Повседневная жизнь, школа, семья",
                "examples": "Здесь и сейчас"
            }
        },
        "ageGroups": {
            "3-5": {
                "title": "3-5 лет",
                "description": "Короткие простые истории"
            },
            "6-8": {
                "title": "6-8 лет",
                "description": "Увлекательные приключения"
            },
            "9-12": {
                "title": "9-12 лет",
                "description": "Сложные сюжеты"
            },
            "13+": {
                "title": "13+ лет",
                "description": "Глубокие истории"
            }
        },
        "lengths": {
            "short": {
                "title": "Короткая",
                "duration": "3-5 Мин",
                "chapters": "3 главы"
            },
            "medium": {
                "title": "Средняя",
                "duration": "8-12 Мин",
                "chapters": "5 глав"
            },
            "long": {
                "title": "Длинная",
                "duration": "15-20 Мин",
                "chapters": "7 глав"
            }
        },
        "feelings": {
            "funny": {
                "title": "Смешная",
                "description": "Для смеха"
            },
            "warm": {
                "title": "Теплая",
                "description": "Душевные моменты"
            },
            "exciting": {
                "title": "Захватывающая",
                "description": "Динамичное действие"
            },
            "crazy": {
                "title": "Безумная",
                "description": "Дикие сюрпризы"
            },
            "meaningful": {
                "title": "Глубокая",
                "description": "С важным посланием"
            }
        },
        "summary": {
            "avatars": "Аватары",
            "age": "Возраст",
            "category": "Категория",
            "length": "Длина",
            "feelings": "Чувства",
            "wishes": "Пожелания",
            "ready": "Ваша история будет создана!"
        },
        "wishes": {
            "rhymes": {
                "title": "Рифмы и стихи",
                "description": "История рассказывается в стихах"
            },
            "moral": {
                "title": "Мораль и ценности",
                "description": "История преподает важный урок"
            },
            "avatarIsHero": {
                "title": "Аватар - герой",
                "description": "Ваш аватар играет главную роль"
            },
            "famousCharacters": {
                "title": "Известные персонажи",
                "description": "Встреча с героями известных сказок"
            },
            "happyEnd": {
                "title": "Счастливый конец",
                "description": "История хорошо заканчивается"
            },
            "surpriseEnd": {
                "title": "Неожиданный конец",
                "description": "Неожиданная развязка"
            }
        },
        "steps": {
            "avatars": "Аватары",
            "category": "Категория",
            "ageLength": "Возраст и Длина",
            "feeling": "Чувства",
            "wishes": "Пожелания",
            "summary": "Итог"
        }
    };

    fs.writeFileSync(ruPath, JSON.stringify(data, null, 2));
    console.log('Updated ru.json');
}

updateDe();
updateEn();
updateRu();
