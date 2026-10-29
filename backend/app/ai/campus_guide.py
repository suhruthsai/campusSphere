"""
Mitra's guidebook: every building and area of MVSR Engineering College, what it is used for, where she
stands to present it on the 3D twin, and the full campus tour narrated in English, Hindi and Telugu.

Facts come from the twin's own building data (rooms and labs in SuhruthDigitalTwin.jsx), the site survey
(docs/mvsr-survey, OpenStreetMap) and the services catalogue. Nothing here is guessed: where the survey
was unsure (the workshop shed), the text stays general. Edit this file to correct or add details.

node: the walking-graph node she walks to (SuhruthDigitalTwin.jsx NODES); look: the point (x, z) she turns
to and points at.
"""

PLACES = {
    "frontgate": {
        "name": "Main Gate", "kind": "entrance", "node": "frontgate", "look": (-229, -25),
        "short": "the main entrance, on the Badangpet-Nadergul main road",
        "about": "The main entrance of MVSR Engineering College, on the Badangpet-Nadergul main road. The Security "
                 "Room and a bank branch with an ATM are right beside it.",
        "tour": {
            "en-IN": "Welcome to MVSR Engineering College, Nadergul! This is the main gate, and the Security Room and a bank with an ATM are right beside it.",
            "hi-IN": "एमवीएसआर इंजीनियरिंग कॉलेज, नादरगुल में आपका स्वागत है! यह मुख्य द्वार है, और इसके पास ही सुरक्षा कक्ष और एटीएम वाला बैंक है।",
            "te-IN": "ఎంవీఎస్ఆర్ ఇంజినీరింగ్ కాలేజీ, నాదర్‌గుల్‌కి స్వాగతం! ఇది ప్రధాన ద్వారం; దీని పక్కనే సెక్యూరిటీ రూమ్, ఏటీఎం ఉన్న బ్యాంక్ ఉన్నాయి.",
        },
    },
    "security": {
        "name": "Security Room", "kind": "service", "node": "security", "look": (-215, -40),
        "short": "the campus security staff's room, beside the main gate",
        "about": "The room of the campus security staff, beside the main gate.",
    },
    "bank": {
        "name": "Bank & ATM", "kind": "service", "node": "security", "look": (-211, -55),
        "short": "a bank branch with an ATM, near the main gate",
        "about": "A bank branch with an ATM on campus, near the main gate and the Security Room. Useful for paying "
                 "fees in person or withdrawing cash.",
    },
    "rockgarden": {
        "name": "Rock Garden", "kind": "garden", "node": "W_N", "look": (-211, 15),
        "short": "a garden with a fountain, boulders and trees",
        "about": "A green garden with a fountain, big boulders and trees, a quiet place to sit between classes.",
        "tour": {
            "en-IN": "This is the Rock Garden, with its fountain, big boulders and trees. It's a calm green spot to sit and relax between classes.",
            "hi-IN": "यह रॉक गार्डन है, जिसमें फव्वारा, बड़े पत्थर और पेड़ हैं। क्लास के बीच आराम से बैठने के लिए यह एक शांत हरी जगह है।",
            "te-IN": "ఇది రాక్ గార్డెన్; ఇక్కడ ఫౌంటెన్, పెద్ద బండరాళ్లు, చెట్లు ఉన్నాయి. క్లాసుల మధ్యలో ప్రశాంతంగా కూర్చోడానికి ఇది చక్కని పచ్చని ప్రదేశం.",
        },
    },
    "civilit": {
        "name": "Civil & IT Block", "kind": "academic", "node": "civilit", "look": (-158, 20),
        "short": "administration (Admin Office, Principal, Accounts) plus the Civil and IT departments",
        "about": "The administrative heart of the college, 3 floors. Admin Office (issues Bonafide, TC, Conduct, Course "
                 "Completion and Medium of Instruction certificates), Principal / Director's office, Accounts section, "
                 "IQAC room, KVR Conference Hall, Civil department office and IT staff room. Civil labs: Surveying, "
                 "Engineering Geology, Fluid Mechanics, Transportation Engineering, Environmental Engineering, Concrete "
                 "Technology. IT / computer labs: Ada Lab, Charles Babbage Lab, IoT Lab, and Civil and IT classrooms.",
        "tour": {
            "en-IN": "This is the Civil and IT Block, the administrative heart of the college. The Admin Office, the Principal's office and the Accounts section are here, with the Civil and IT classrooms and labs.",
            "hi-IN": "यह सिविल और आईटी ब्लॉक है, कॉलेज का प्रशासनिक केंद्र। यहाँ एडमिन ऑफिस, प्रिंसिपल का कार्यालय और अकाउंट्स सेक्शन हैं, साथ ही सिविल और आईटी की कक्षाएँ और लैब भी।",
            "te-IN": "ఇది సివిల్ & ఐటీ బ్లాక్, కాలేజీ పరిపాలనకు కేంద్రం. అడ్మిన్ ఆఫీస్, ప్రిన్సిపాల్ కార్యాలయం, అకౌంట్స్ సెక్షన్ ఇక్కడే ఉన్నాయి; సివిల్, ఐటీ క్లాస్‌రూమ్‌లు, ల్యాబ్‌లు కూడా ఇక్కడే.",
        },
    },
    "mecheee": {
        "name": "Mech & EEE Block", "kind": "academic", "node": "mecheee", "look": (-102, 18.5),
        "short": "the Mechanical and EEE departments",
        "about": "Home of the Mechanical Engineering and Electrical & Electronics Engineering departments, with their "
                 "classrooms, labs and staff rooms. A 3-floor block built around a central courtyard.",
        "tour": {
            "en-IN": "This is the Mechanical and EEE Block, home to the Mechanical Engineering and Electrical and Electronics Engineering departments, with their classrooms and labs.",
            "hi-IN": "यह मैकेनिकल और ईईई ब्लॉक है, जहाँ मैकेनिकल इंजीनियरिंग और इलेक्ट्रिकल एवं इलेक्ट्रॉनिक्स इंजीनियरिंग विभाग अपनी कक्षाओं और लैब के साथ हैं।",
            "te-IN": "ఇది మెకానికల్ & ఈఈఈ బ్లాక్. మెకానికల్ ఇంజినీరింగ్, ఎలక్ట్రికల్ & ఎలక్ట్రానిక్స్ ఇంజినీరింగ్ విభాగాలు, వాటి క్లాస్‌రూమ్‌లు, ల్యాబ్‌లు ఇక్కడ ఉన్నాయి.",
        },
    },
    "cse": {
        "name": "CSE Block", "kind": "academic", "node": "cse", "look": (-50, 19.5),
        "short": "the Computer Science department: classrooms and computer labs",
        "about": "The Computer Science & Engineering department, 3 floors: classrooms, computer labs (OS Lab, Web "
                 "Programming Lab, MPMC Lab and more), teacher cabins and the HOD's cabin. Solar panels on the roof.",
        "tour": {
            "en-IN": "This is the CSE Block of the Computer Science department, with three floors of classrooms and computer labs like the OS, Web Programming and MPMC labs. Its roof carries solar panels.",
            "hi-IN": "यह कंप्यूटर साइंस विभाग का सीएसई ब्लॉक है, तीन मंज़िलों में कक्षाएँ और ओएस, वेब प्रोग्रामिंग, एमपीएमसी जैसी कंप्यूटर लैब। इसकी छत पर सोलर पैनल लगे हैं।",
            "te-IN": "ఇది కంప్యూటర్ సైన్స్ విభాగం సీఎస్ఈ బ్లాక్; మూడు అంతస్తుల్లో క్లాస్‌రూమ్‌లు, ఓఎస్, వెబ్ ప్రోగ్రామింగ్, ఎంపీఎంసీ వంటి కంప్యూటర్ ల్యాబ్‌లు ఉన్నాయి. దీని పైకప్పుపై సోలార్ ప్యానెల్స్ ఉన్నాయి.",
        },
    },
    "ece": {
        "name": "ECE Block", "kind": "academic", "node": "ece", "look": (-7, 18),
        "short": "the Electronics & Communication department",
        "about": "The Electronics & Communication Engineering department, 2 floors: classrooms, electronics labs, an IoT "
                 "lab and staff rooms.",
        "tour": {
            "en-IN": "This is the ECE Block of Electronics and Communication Engineering, with classrooms, electronics labs and an IoT lab.",
            "hi-IN": "यह इलेक्ट्रॉनिक्स एवं कम्युनिकेशन इंजीनियरिंग का ईसीई ब्लॉक है, जिसमें कक्षाएँ, इलेक्ट्रॉनिक्स लैब और एक आईओटी लैब है।",
            "te-IN": "ఇది ఎలక్ట్రానిక్స్ & కమ్యూనికేషన్ ఇంజినీరింగ్ విభాగం ఈసీఈ బ్లాక్; ఇక్కడ క్లాస్‌రూమ్‌లు, ఎలక్ట్రానిక్స్ ల్యాబ్‌లు, ఒక ఐఓటీ ల్యాబ్ ఉన్నాయి.",
        },
    },
    "placement": {
        "name": "Placement Cell", "kind": "admin", "node": "placement", "look": (-33, -50),
        "short": "training & placement: company talks, tests, group discussions, interviews; issues the NOC",
        "about": "Training & Placement, 3 floors: placement office, reception and waiting area, pre-placement talk hall, "
                 "online assessment lab, group discussion room and interview room. Issues the No Objection Certificate "
                 "(NOC) for internships and other purposes.",
        "tour": {
            "en-IN": "This is the Placement Cell, where companies hold pre-placement talks, online tests, group discussions and interviews. Students also get their No Objection Certificate here.",
            "hi-IN": "यह प्लेसमेंट सेल है, जहाँ कंपनियाँ प्री-प्लेसमेंट टॉक, ऑनलाइन टेस्ट, ग्रुप डिस्कशन और इंटरव्यू करती हैं। छात्रों को एनओसी भी यहीं से मिलता है।",
            "te-IN": "ఇది ప్లేస్‌మెంట్ సెల్; ఇక్కడ కంపెనీలు ప్రీ-ప్లేస్‌మెంట్ టాక్స్, ఆన్‌లైన్ పరీక్షలు, గ్రూప్ డిస్కషన్లు, ఇంటర్వ్యూలు నిర్వహిస్తాయి. విద్యార్థులకు ఎన్ఓసీ కూడా ఇక్కడే లభిస్తుంది.",
        },
    },
    "lib": {
        "name": "Library", "kind": "library", "node": "lib", "look": (-63, -59),
        "short": "books, reading hall and study hall; library no-dues",
        "about": "The college library, 2 floors: book issue and collection counter, main reading hall, a quiet study hall "
                 "and the Ada Lovelace computer lab. Students clear their library dues here when leaving college.",
        "tour": {
            "en-IN": "This is the Library, with a book issue counter, a main reading hall and a quiet study hall. Students also clear their library dues here before leaving college.",
            "hi-IN": "यह लाइब्रेरी है, जिसमें किताबें लेने-देने का काउंटर, मुख्य रीडिंग हॉल और एक शांत स्टडी हॉल है। कॉलेज छोड़ने से पहले छात्र यहाँ लाइब्रेरी नो-ड्यूज़ भी लेते हैं।",
            "te-IN": "ఇది లైబ్రరీ; ఇక్కడ పుస్తకాలు ఇచ్చే-తీసుకునే కౌంటర్, ప్రధాన రీడింగ్ హాల్, ప్రశాంతమైన స్టడీ హాల్ ఉన్నాయి. కాలేజీ వదిలే ముందు విద్యార్థులు లైబ్రరీ నో-డ్యూస్ కూడా ఇక్కడే తీసుకుంటారు.",
        },
    },
    "aud": {
        "name": "Auditorium", "kind": "auditorium", "node": "aud", "look": (-139, -58),
        "short": "events, cultural programmes, seminars and gatherings",
        "about": "The college auditorium, used for events, cultural programmes, seminars and large gatherings.",
        "tour": {
            "en-IN": "This is the Auditorium, where the college holds its events, cultural programmes, seminars and big gatherings.",
            "hi-IN": "यह ऑडिटोरियम है, जहाँ कॉलेज के कार्यक्रम, सांस्कृतिक उत्सव, सेमिनार और बड़ी सभाएँ होती हैं।",
            "te-IN": "ఇది ఆడిటోరియం; కాలేజీ కార్యక్రమాలు, సాంస్కృతిక ఉత్సవాలు, సెమినార్లు, పెద్ద సమావేశాలు ఇక్కడ జరుగుతాయి.",
        },
    },
    "boyshostel": {
        "name": "Boys Hostel", "kind": "hostel", "node": "boyshostel", "look": (-190.5, -58),
        "short": "accommodation for boys living on campus",
        "about": "Accommodation for boys who live on campus.",
        "tour": {
            "en-IN": "This is the Boys Hostel, where boys who live on campus stay.",
            "hi-IN": "यह बॉयज़ हॉस्टल है, जहाँ कैंपस में रहने वाले लड़के रहते हैं।",
            "te-IN": "ఇది బాయ్స్ హాస్టల్; క్యాంపస్‌లో ఉండే అబ్బాయిలు ఇక్కడ ఉంటారు.",
        },
    },
    "girlshostel": {
        "name": "Girls Hostel", "kind": "hostel", "node": "girlshostel", "look": (-208, 77.5),
        "short": "accommodation for girls living on campus",
        "about": "Accommodation for girls who live on campus.",
        "tour": {
            "en-IN": "This is the Girls Hostel, where girls who live on campus stay.",
            "hi-IN": "यह गर्ल्स हॉस्टल है, जहाँ कैंपस में रहने वाली लड़कियाँ रहती हैं।",
            "te-IN": "ఇది గర్ల్స్ హాస్టల్; క్యాంపస్‌లో ఉండే అమ్మాయిలు ఇక్కడ ఉంటారు.",
        },
    },
    "sh": {
        "name": "S&H Block", "kind": "academic", "node": "sh", "look": (-162.5, 85),
        "short": "Science & Humanities: physics, chemistry, English, graphics labs, workshop",
        "about": "The Science & Humanities department, 4 floors around a courtyard: classrooms, Physics, Chemistry, "
                 "English, Engineering Graphics and computer labs, a workshop, staff cabins and a girls' common room. "
                 "The basic science and humanities subjects of engineering are taught here.",
        "tour": {
            "en-IN": "This is the Science and Humanities Block, where the basics are taught, with physics, chemistry and English labs, an engineering graphics lab, a workshop and a girls' common room.",
            "hi-IN": "यह साइंस एंड ह्यूमैनिटीज़ ब्लॉक है, जहाँ बुनियादी विषय पढ़ाए जाते हैं; यहाँ फिज़िक्स, केमिस्ट्री और इंग्लिश लैब, इंजीनियरिंग ग्राफ़िक्स लैब, एक वर्कशॉप और लड़कियों का कॉमन रूम है।",
            "te-IN": "ఇది సైన్స్ & హ్యుమానిటీస్ బ్లాక్; ఇక్కడ ప్రాథమిక విషయాలు బోధిస్తారు. ఫిజిక్స్, కెమిస్ట్రీ, ఇంగ్లీష్ ల్యాబ్‌లు, ఇంజినీరింగ్ గ్రాఫిక్స్ ల్యాబ్, వర్క్‌షాప్, అమ్మాయిల కామన్ రూమ్ ఉన్నాయి.",
        },
    },
    "exam": {
        "name": "Examination Department (Exam Cell)", "kind": "admin", "node": "exam", "look": (-105, 110),
        "short": "the Exam Cell: Controller of Examinations; issues PC, marks memo (CMM), transcripts",
        "about": "The Examination Department (Exam Cell), 4 floors: the exam control room and the Controller of "
                 "Examinations, plus classrooms used for exams. Issues the Provisional Certificate, Consolidated Marks "
                 "Memo (CMM) and official transcripts; exam-cell no-dues. The S&H Annex is next to it.",
        "tour": {
            "en-IN": "This is the Examination Department, the Exam Cell. The Controller of Examinations works here, and students collect their Provisional Certificate, marks memo and transcripts here.",
            "hi-IN": "यह परीक्षा विभाग यानी एग्ज़ाम सेल है। यहाँ परीक्षा नियंत्रक बैठते हैं, और छात्र अपना प्रोविज़नल सर्टिफिकेट, मार्क्स मेमो और ट्रांसक्रिप्ट यहीं से लेते हैं।",
            "te-IN": "ఇది ఎగ్జామినేషన్ డిపార్ట్‌మెంట్, అంటే ఎగ్జామ్ సెల్. పరీక్షల నియంత్రణాధికారి ఇక్కడే ఉంటారు; విద్యార్థులు ప్రొవిజనల్ సర్టిఫికేట్, మార్క్స్ మెమో, ట్రాన్స్‌క్రిప్ట్స్ ఇక్కడే తీసుకుంటారు.",
        },
    },
    "shannex": {
        "name": "S&H Annex", "kind": "academic", "node": "I_EXAM", "look": (-163.5, 112),
        "short": "a low annex building of the S&H block",
        "about": "A low annex building belonging to the Science & Humanities block, next to the Exam Cell.",
    },
    "cad": {
        "name": "CAD Lab", "kind": "lab", "node": "cad", "look": (-106, 83),
        "short": "computer-aided design labs",
        "about": "Computer-Aided Design labs (3 lab rooms) where students do design and drawing on computers.",
        "tour": {
            "en-IN": "This is the CAD Lab, where students do computer-aided design and drawing on computers.",
            "hi-IN": "यह कैड लैब है, जहाँ छात्र कंप्यूटर पर कंप्यूटर-एडेड डिज़ाइन और ड्रॉइंग करते हैं।",
            "te-IN": "ఇది క్యాడ్ ల్యాబ్; ఇక్కడ విద్యార్థులు కంప్యూటర్లపై కంప్యూటర్-ఎయిడెడ్ డిజైన్, డ్రాయింగ్ చేస్తారు.",
        },
    },
    "workshop": {
        "name": "Workshop Shed", "kind": "workshop", "node": "P2_S", "look": (-76, 88),
        "short": "a long workshop hall",
        "about": "A long workshop hall of the college.",
        "tour": {
            "en-IN": "This long building is the Workshop Shed, a workshop hall of the college.",
            "hi-IN": "यह लंबी इमारत वर्कशॉप शेड है, कॉलेज का वर्कशॉप हॉल।",
            "te-IN": "ఈ పొడవైన భవనం వర్క్‌షాప్ షెడ్, కాలేజీ వర్క్‌షాప్ హాల్.",
        },
    },
    "cant": {
        "name": "Canteen & Sports Block", "kind": "canteen", "node": "cant", "look": (-40, 75.5),
        "short": "canteen (bakery, meals, tea and coffee) and indoor sports (table tennis, carroms, gym)",
        "about": "Canteen: bakery, tiffins and meals, tea and coffee, a student dining area and a staff dining area. "
                 "Sports: table tennis, carroms, a gymnasium and the sports staff cabin (sports no-dues).",
        "tour": {
            "en-IN": "This is the Canteen and Sports Block. There's a bakery, tiffins and meals, tea and coffee, and dining areas for students and staff, and the sports section has table tennis, carroms and a gym.",
            "hi-IN": "यह कैंटीन और स्पोर्ट्स ब्लॉक है। यहाँ बेकरी, टिफ़िन और खाना, चाय-कॉफ़ी और छात्रों व स्टाफ़ के लिए डाइनिंग एरिया हैं; स्पोर्ट्स सेक्शन में टेबल टेनिस, कैरम और जिम है।",
            "te-IN": "ఇది క్యాంటీన్ & స్పోర్ట్స్ బ్లాక్. ఇక్కడ బేకరీ, టిఫిన్లు, భోజనం, టీ-కాఫీ, విద్యార్థులకు, సిబ్బందికి డైనింగ్ ఏరియాలు ఉన్నాయి; స్పోర్ట్స్ విభాగంలో టేబుల్ టెన్నిస్, క్యారమ్స్, జిమ్ ఉన్నాయి.",
        },
    },
    "rnd": {
        "name": "R&D Block", "kind": "research", "node": "rnd", "look": (-14, 70),
        "short": "research & development labs",
        "about": "Research & Development block, 2 floors with 6 research labs.",
        "tour": {
            "en-IN": "This is the R and D Block, with six research labs for research and development work.",
            "hi-IN": "यह आर एंड डी ब्लॉक है, जिसमें अनुसंधान और विकास के लिए छह रिसर्च लैब हैं।",
            "te-IN": "ఇది ఆర్ & డీ బ్లాక్; పరిశోధన, అభివృద్ధి పనుల కోసం ఇక్కడ ఆరు రీసెర్చ్ ల్యాబ్‌లు ఉన్నాయి.",
        },
    },
    "basketball": {
        "name": "Basketball Courts", "kind": "sport", "node": "E_S", "look": (6, 69),
        "short": "outdoor basketball courts",
        "about": "Outdoor basketball courts where students play in their free time.",
        "tour": {
            "en-IN": "These are the basketball courts, where students play in their free time.",
            "hi-IN": "ये बास्केटबॉल कोर्ट हैं, जहाँ छात्र खाली समय में खेलते हैं।",
            "te-IN": "ఇవి బాస్కెట్‌బాల్ కోర్టులు; విద్యార్థులు ఖాళీ సమయంలో ఇక్కడ ఆడుకుంటారు.",
        },
    },
    "ground": {
        "name": "Cricket Ground", "kind": "sport", "node": "PK_N", "look": (125, 14),
        "short": "the big open cricket ground",
        "about": "The college's big open ground, used for cricket and other sports. The car parking is next to it.",
        "tour": {
            "en-IN": "This is the big cricket ground, the college's open ground for sports. The car parking is right next to it.",
            "hi-IN": "यह बड़ा क्रिकेट ग्राउंड है, खेलों के लिए कॉलेज का खुला मैदान। इसके पास ही कार पार्किंग है।",
            "te-IN": "ఇది పెద్ద క్రికెట్ గ్రౌండ్, ఆటల కోసం కాలేజీ బహిరంగ మైదానం. దీని పక్కనే కార్ పార్కింగ్ ఉంది.",
        },
    },
    "carpark": {
        "name": "Car Parking", "kind": "parking", "node": "PK_N", "look": (59, 9),
        "short": "car parking, next to the cricket ground",
        "about": "Car parking for visitors, staff and students, next to the cricket ground.",
    },
    "buspark": {
        "name": "College Bus Parking", "kind": "parking", "node": "D_TURN", "look": (84, -38),
        "short": "where the college buses park; transport no-dues",
        "about": "Where the college buses park. Students clear their transport dues before leaving college.",
        "tour": {
            "en-IN": "This is the college bus parking, where the college buses stop.",
            "hi-IN": "यह कॉलेज बस पार्किंग है, जहाँ कॉलेज की बसें खड़ी होती हैं।",
            "te-IN": "ఇది కాలేజీ బస్ పార్కింగ్; కాలేజీ బస్సులు ఇక్కడ ఆగుతాయి.",
        },
    },
    "backgate": {
        "name": "Back Gate", "kind": "entrance", "node": "backgate", "look": (20, -79),
        "short": "the second entrance, near the parking",
        "about": "The second entrance of the campus, near the car and bus parking.",
        "tour": {
            "en-IN": "And this is the Back Gate, the second way in and out of the campus. That was the full tour of MVSR. Ask me anything, anytime!",
            "hi-IN": "और यह बैक गेट है, कैंपस में आने-जाने का दूसरा रास्ता। यह था एमवीएसआर का पूरा टूर। कभी भी कुछ भी पूछिए!",
            "te-IN": "ఇది బ్యాక్ గేట్, క్యాంపస్‌లోకి రావడానికి, వెళ్లడానికి మరో దారి. ఇదీ ఎంవీఎస్ఆర్ పూర్తి టూర్. ఎప్పుడైనా ఏదైనా అడగండి!",
        },
    },
}

# The full campus tour, in walking order along the paths (gate, academic blocks, library and auditorium,
# hostels, the southern blocks, canteen and sports, then out by the back gate)
FULL_TOUR = [
    "frontgate", "rockgarden", "civilit", "mecheee", "cse", "ece", "placement", "lib", "aud", "boyshostel",
    "girlshostel", "sh", "exam", "cad", "workshop", "cant", "rnd", "basketball", "ground", "buspark", "backgate",
]

assert all("tour" in PLACES[p] for p in FULL_TOUR)


def stop(place: str, say: str) -> dict:
    """One tour stop as the browser needs it: where to walk, what to point at, what to say."""
    p = PLACES[place]
    return {"place": place, "name": p["name"], "say": say, "node": p["node"], "look": {"x": p["look"][0], "z": p["look"][1]}}


def full_tour(lang: str) -> list:
    return [stop(p, PLACES[p]["tour"][lang]) for p in FULL_TOUR]


def place_info(place: str) -> dict:
    p = PLACES.get(place)
    if not p:
        return {"error": f"unknown place {place!r}", "places": list(PLACES)}
    return {"place": place, "name": p["name"], "kind": p["kind"], "about": p["about"]}
