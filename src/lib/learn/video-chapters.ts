// Chapter data: every chapter of every core subject, Classes 6–12.
//
// CBSE-first (rationalized NCERT + current NCF books: Curiosity 6–8,
// Poorvi 6–7, Honeycomb/Honeydew where still prescribed). `board` marks
// ICSE overlap: core Maths/Science chapters overlap heavily ("Both238080"? no —
// see Board type), while SST/English readers follow CBSE books ("CBSE").
// Videos are concept-driven explainers, so a renamed chapter still maps 1:1 —
// rename a title here and both engines follow on the next regenerate.

export type Board = "CBSE" | "Both";
export type ChapterBand = { subject: string; board: Board; chapters: string[] };
export type ClassBand = { classLevel: number; bands: ChapterBand[] };

export const CHAPTER_BANDS: ClassBand[] = [
  {
    classLevel: 6,
    bands: [
      { subject: "Maths", board: "Both", chapters: [
        "Knowing Our Numbers", "Whole Numbers", "Playing with Numbers",
        "Basic Geometrical Ideas", "Understanding Elementary Shapes", "Integers",
        "Fractions", "Decimals", "Data Handling", "Mensuration", "Algebra",
        "Ratio and Proportion", "Symmetry", "Practical Geometry",
      ] },
      { subject: "Science", board: "Both", chapters: [
        "The Wonderful World of Science", "Diversity in the Living World",
        "Mindful Eating: A Path to a Healthy Body", "Exploring Magnets",
        "Measurement of Length and Motion", "Materials Around Us",
        "Temperature and its Measurement", "A Journey through States of Water",
        "Methods of Separation in Everyday Life",
        "Living Creatures: Exploring their Characteristics", "Nature's Treasures",
        "Beyond Earth",
      ] },
      { subject: "English", board: "CBSE", chapters: [
        "A Bottle of Dew", "The Raven and the Fox", "Rama to the Rescue",
        "The Unlikely Best Friends", "A Friend's Prayer", "The Chair",
        "Neem Baba", "What a Bird Thought", "Spices That Heal Us",
        "Change of Heart", "The Winner", "Yoga: A Way of Life",
        "Hamara Bharat, Incredible India", "The Kites",
        "Ila Sachani: Embroidering Dreams with Her Feet", "National War Memorial",
      ] },
      { subject: "History", board: "CBSE", chapters: [
        "What, Where, How and When", "From Hunting-Gathering to Growing Food",
        "In the Earliest Cities", "What Books and Burials Tell Us",
        "Kingdoms, Kings and an Early Republic", "New Questions and Ideas",
        "Ashoka, the Emperor Who Gave Up War", "Vital Villages, Thriving Towns",
        "Traders, Kings and Pilgrims", "New Empires and Kingdoms",
        "Buildings, Paintings and Books",
      ] },
      { subject: "Geography", board: "CBSE", chapters: [
        "The Earth in the Solar System", "Globe: Latitudes and Longitudes",
        "Motions of the Earth", "Maps", "Major Domains of the Earth",
        "Major Landforms of the Earth", "Our Country: India",
        "India: Climate, Vegetation and Wildlife",
      ] },
      { subject: "Civics", board: "CBSE", chapters: [
        "What is Government", "Key Elements of a Democratic Government",
        "Panchayati Raj", "Rural Livelihoods", "Urban Livelihoods",
        "Rural Administration", "Urban Administration", "Making a Living",
      ] },
    ],
  },
  {
    classLevel: 7,
    bands: [
      { subject: "Maths", board: "Both", chapters: [
        "Integers", "Fractions and Decimals", "Data Handling", "Simple Equations",
        "Lines and Angles", "Triangles and Its Properties", "Comparing Quantities",
        "Rational Numbers", "Perimeter and Area", "Algebraic Expressions",
        "Exponents and Powers", "Symmetry", "Visualising Solid Shapes",
      ] },
      { subject: "Science", board: "Both", chapters: [
        "The Ever-Evolving World of Science",
        "Exploring Substances: Acidic, Basic and Neutral",
        "Electricity: Circuits and their Components",
        "The World of Metals and Non-metals",
        "Changes Around Us: Physical and Chemical",
        "Adolescence: A Stage of Growth and Change", "Heat Transfer in Nature",
        "Measurement of Time and Motion", "Life Processes in Animals",
        "Life Processes in Plants", "Light: Shadows and Reflections",
        "Earth, Moon, and the Sun",
      ] },
      { subject: "English", board: "CBSE", chapters: [
        "Three Questions", "A Gift of Chappal", "Gopal and the Hilsa Fish",
        "The Ashes That Made Trees Bloom", "Quality", "Expert Detectives",
        "The Invention of Vita-Wonk", "Fire: Friend and Foe",
        "A Bicycle in Good Repair", "The Story of Cricket",
        "The Squirrel", "The Rebel", "The Shed", "Chivvy", "Trees",
        "Mystery of the Talking Fan", "Dad and the Cat and the Tree",
        "Meadow Surprises", "Garden Snake",
        "The Tiny Teacher", "Bringing Up Kari", "The Desert",
        "The Cop and the Anthem", "Golu Grows a Nose",
        "I Want Something in a Cage", "Chandni", "The Bear Story",
      ] },
      { subject: "History", board: "CBSE", chapters: [
        "Tracing Changes Through a Thousand Years", "New Kings and Kingdoms",
        "The Delhi Sultans", "The Mughal Empire", "Rulers and Buildings",
        "Towns, Traders and Craftspersons", "Tribes, Nomads and Settled Communities",
        "Devotional Paths to the Divine", "The Making of Regional Cultures",
        "Eighteenth-Century Political Formations",
      ] },
      { subject: "Geography", board: "CBSE", chapters: [
        "Environment", "Inside Our Earth", "Our Changing Earth", "Air", "Water",
        "Natural Vegetation and Wildlife", "Human Environment", "Life in the Deserts",
      ] },
      { subject: "Civics", board: "CBSE", chapters: [
        "On Equality", "Role of the Government in Health",
        "How the State Government Works", "Growing Up as Boys and Girls",
        "Women Change the World", "Understanding Media", "Markets Around Us",
        "A Shirt in the Market",
      ] },
    ],
  },
  {
    classLevel: 8,
    bands: [
      { subject: "Maths", board: "Both", chapters: [
        "Rational Numbers", "Linear Equations in One Variable",
        "Understanding Quadrilaterals", "Data Handling", "Squares and Square Roots",
        "Cubes and Cube Roots", "Comparing Quantities",
        "Algebraic Expressions and Identities", "Mensuration", "Exponents and Powers",
        "Direct and Inverse Proportions", "Factorisation", "Introduction to Graphs",
      ] },
      { subject: "Science", board: "Both", chapters: [
        "Exploring the Investigative World of Science",
        "The Invisible Living World: Beyond Our Naked Eye",
        "Health: The Ultimate Treasure", "Electricity: Magnetic and Heating Effects",
        "Exploring Forces", "Pressure, Winds, Storms, and Cyclones",
        "Particulate Nature of Matter",
        "Nature of Matter: Elements, Compounds, and Mixtures",
        "The Amazing World of Solutes, Solvents, and Solutions",
        "Light: Mirrors and Lenses", "Keeping Time with the Skies",
        "How Nature Works in Harmony",
        "Our Home: Earth, a Unique Life Sustaining Planet",
      ] },
      { subject: "English", board: "CBSE", chapters: [
        "The Best Christmas Present in the World", "The Tsunami",
        "Glimpses of the Past", "Bepin Choudhury's Lapse of Memory",
        "The Summit Within", "This is Jody's Fawn", "A Visit to Cambridge",
        "A Short Monsoon Diary", "The Great Stone Face I", "The Great Stone Face II",
        "The Ant and the Cricket", "Geography Lesson", "Macavity: The Mystery Cat",
        "The Last Bargain", "The School Boy", "The Duck and the Kangaroo",
        "When I Set Out for Lyonnesse", "On the Grasshopper and Cricket",
        "How the Camel Got His Hump", "Children at Work", "The Selfish Giant",
        "The Treasure Within", "Princess September", "The Fight", "The Open Window",
        "Jalebis", "The Comet I", "The Comet II",
      ] },
      { subject: "History", board: "CBSE", chapters: [
        "How, When and Where", "From Trade to Territory", "Ruling the Countryside",
        "Tribals, Dikus and the Vision of a Golden Age", "When People Rebel",
        "Weavers, Iron Smelters and Factory Owners", "Women, Caste and Reform",
        "The Making of the National Movement",
      ] },
      { subject: "Geography", board: "CBSE", chapters: [
        "Resources", "Land, Soil, Water, Natural Vegetation and Wildlife",
        "Agriculture", "Industries", "Human Resources",
      ] },
      { subject: "Civics", board: "CBSE", chapters: [
        "The Indian Constitution", "Understanding Secularism",
        "Parliament and the Making of Laws", "Judiciary",
        "Understanding Marginalisation", "Confronting Marginalisation",
        "Public Facilities", "Law and Social Justice",
      ] },
    ],
  },
  {
    classLevel: 9,
    bands: [
      { subject: "Maths", board: "Both", chapters: [
        "Number Systems", "Polynomials", "Coordinate Geometry",
        "Linear Equations in Two Variables", "Introduction to Euclid's Geometry",
        "Lines and Angles", "Triangles", "Quadrilaterals", "Circles",
        "Heron's Formula", "Surface Areas and Volumes", "Statistics",
      ] },
      { subject: "Science", board: "Both", chapters: [
        "Matter in Our Surroundings", "Is Matter Around Us Pure",
        "Atoms and Molecules", "Structure of the Atom", "The Fundamental Unit of Life",
        "Tissues", "Motion", "Force and Laws of Motion", "Gravitation",
        "Work and Energy", "Sound", "Improvement in Food Resources",
      ] },
      { subject: "English", board: "CBSE", chapters: [
        "The Fun They Had", "The Sound of Music", "The Little Girl",
        "A Truly Beautiful Mind", "The Snake and the Mirror", "My Childhood",
        "Packing", "Reach for the Top", "The Bond of Love", "Kathmandu",
        "If I Were You",
        "The Road Not Taken", "Wind", "Rain on the Roof",
        "The Lake Isle of Innisfree", "A Legend of the Northland",
        "No Men Are Foreign", "The Duck and the Kangaroo", "On Killing a Tree",
        "The Snake Trying", "A Slumber Did My Spirit Seal",
        "The Lost Child", "The Adventures of Toto", "Iswaran the Storyteller",
        "In the Kingdom of Fools", "The Happy Prince",
        "Weathering the Storm in Ersama", "The Last Leaf", "A House is Not a Home",
        "The Accidental Tourist", "The Beggar",
      ] },
      { subject: "History", board: "CBSE", chapters: [
        "The French Revolution", "Socialism in Europe and the Russian Revolution",
        "Nazism and the Rise of Hitler", "Forest Society and Colonialism",
        "Pastoralists in the Modern World",
      ] },
      { subject: "Geography", board: "CBSE", chapters: [
        "India: Size and Location", "Physical Features of India", "Drainage",
        "Climate", "Natural Vegetation and Wildlife", "Population",
      ] },
      { subject: "Civics", board: "CBSE", chapters: [
        "What is Democracy? Why Democracy?", "Constitutional Design",
        "Electoral Politics", "Working of Institutions", "Democratic Rights",
      ] },
      { subject: "Economics", board: "CBSE", chapters: [
        "The Story of Village Palampur", "People as Resource",
        "Poverty as a Challenge", "Food Security in India",
      ] },
    ],
  },
  {
    classLevel: 10,
    bands: [
      { subject: "Maths", board: "Both", chapters: [
        "Real Numbers", "Polynomials", "Pair of Linear Equations in Two Variables",
        "Quadratic Equations", "Arithmetic Progressions", "Triangles",
        "Coordinate Geometry", "Introduction to Trigonometry",
        "Some Applications of Trigonometry", "Circles", "Areas Related to Circles",
        "Surface Areas and Volumes", "Statistics", "Probability",
      ] },
      { subject: "Science", board: "Both", chapters: [
        "Chemical Reactions and Equations", "Acids, Bases and Salts",
        "Metals and Non-metals", "Carbon and Its Compounds", "Life Processes",
        "Control and Coordination", "How Do Organisms Reproduce", "Heredity",
        "Light: Reflection and Refraction", "The Human Eye and the Colourful World",
        "Electricity", "Magnetic Effects of Electric Current", "Our Environment",
      ] },
      { subject: "English", board: "CBSE", chapters: [
        "A Letter to God", "Nelson Mandela: Long Walk to Freedom",
        "Two Stories About Flying", "From the Diary of Anne Frank",
        "Glimpses of India", "Mijbil the Otter", "Madam Rides the Bus",
        "The Sermon at Benares", "The Proposal",
        "Dust of Snow", "Fire and Ice", "A Tiger in the Zoo",
        "How to Tell Wild Animals", "The Ball Poem", "Amanda", "The Trees",
        "Fog", "The Tale of Custard the Dragon", "For Anne Gregory",
        "A Triumph of Surgery", "The Thief's Story", "The Midnight Visitor",
        "A Question of Trust", "Footprints Without Feet",
        "The Making of a Scientist", "The Necklace", "Bholi",
        "The Book That Saved the Earth",
      ] },
      { subject: "History", board: "CBSE", chapters: [
        "The Rise of Nationalism in Europe", "Nationalism in India",
        "The Making of a Global World", "Print Culture and the Modern World",
      ] },
      { subject: "Geography", board: "CBSE", chapters: [
        "Resources and Development", "Forest and Wildlife Resources",
        "Water Resources", "Agriculture", "Minerals and Energy Resources",
        "Manufacturing Industries", "Lifelines of National Economy",
      ] },
      { subject: "Civics", board: "CBSE", chapters: [
        "Power Sharing", "Federalism", "Gender, Religion and Caste",
        "Political Parties", "Outcomes of Democracy",
      ] },
      { subject: "Economics", board: "CBSE", chapters: [
        "Development", "Sectors of the Indian Economy", "Money and Credit",
        "Globalisation and the Indian Economy", "Consumer Rights",
      ] },
    ],
  },
  {
    classLevel: 11,
    bands: [
      { subject: "Physics", board: "Both", chapters: [
        "Units and Measurements", "Motion in a Straight Line", "Motion in a Plane",
        "Laws of Motion", "Work, Energy and Power",
        "System of Particles and Rotational Motion", "Gravitation",
        "Mechanical Properties of Solids", "Mechanical Properties of Fluids",
        "Thermal Properties of Matter", "Thermodynamics", "Kinetic Theory",
        "Oscillations", "Waves",
      ] },
      { subject: "Chemistry", board: "Both", chapters: [
        "Some Basic Concepts of Chemistry", "Structure of Atom",
        "Classification of Elements and Periodicity in Properties",
        "Chemical Bonding and Molecular Structure", "Thermodynamics", "Equilibrium",
        "Redox Reactions", "Organic Chemistry: Basic Principles and Techniques",
        "Hydrocarbons",
      ] },
      { subject: "Maths", board: "Both", chapters: [
        "Sets", "Relations and Functions", "Trigonometric Functions",
        "Complex Numbers and Quadratic Equations", "Linear Inequalities",
        "Permutations and Combinations", "Binomial Theorem", "Sequences and Series",
        "Straight Lines", "Conic Sections", "Introduction to Three Dimensional Geometry",
        "Limits and Derivatives", "Statistics", "Probability",
      ] },
      { subject: "Biology", board: "Both", chapters: [
        "The Living World", "Biological Classification", "Plant Kingdom",
        "Animal Kingdom", "Morphology of Flowering Plants",
        "Anatomy of Flowering Plants", "Structural Organisation in Animals",
        "Cell: The Unit of Life", "Biomolecules", "Cell Cycle and Cell Division",
        "Photosynthesis in Higher Plants", "Respiration in Plants",
        "Plant Growth and Development", "Breathing and Exchange of Gases",
        "Body Fluids and Circulation", "Excretory Products and their Elimination",
        "Locomotion and Movement", "Neural Control and Coordination",
        "Chemical Coordination and Integration",
      ] },
      { subject: "English", board: "CBSE", chapters: [
        "The Portrait of a Lady", "We're Not Afraid to Die",
        "Discovering Tut: The Saga Continues", "Landscape of the Soul",
        "The Ailing Planet", "The Browning Version", "The Silk Road",
        "A Photograph", "The Laburnum Top", "The Voice of the Rain", "Childhood",
        "Father to Son",
        "The Summer of the Beautiful White Horse", "The Address",
        "Ranga's Marriage", "Albert Einstein at School", "Mother's Day", "Birth",
        "The Tale of Melon City",
      ] },
    ],
  },
  {
    classLevel: 12,
    bands: [
      { subject: "Physics", board: "Both", chapters: [
        "Electric Charges and Fields",
        "Electrostatic Potential and Capacitance", "Current Electricity",
        "Moving Charges and Magnetism", "Magnetism and Matter",
        "Electromagnetic Induction", "Alternating Current", "Electromagnetic Waves",
        "Ray Optics and Optical Instruments", "Wave Optics",
        "Dual Nature of Radiation and Matter", "Atoms", "Nuclei",
        "Semiconductor Electronics",
      ] },
      { subject: "Chemistry", board: "Both", chapters: [
        "Solutions", "Electrochemistry", "Chemical Kinetics",
        "The d- and f-Block Elements", "Coordination Compounds",
        "Haloalkanes and Haloarenes", "Alcohols, Phenols and Ethers",
        "Aldehydes, Ketones and Carboxylic Acids", "Amines", "Biomolecules",
      ] },
      { subject: "Maths", board: "Both", chapters: [
        "Relations and Functions", "Inverse Trigonometric Functions", "Matrices",
        "Determinants", "Continuity and Differentiability",
        "Application of Derivatives", "Integrals", "Application of Integrals",
        "Differential Equations", "Vector Algebra", "Three Dimensional Geometry",
        "Linear Programming", "Probability",
      ] },
      { subject: "Biology", board: "Both", chapters: [
        "Sexual Reproduction in Flowering Plants", "Human Reproduction",
        "Reproductive Health", "Principles of Inheritance and Variation",
        "Molecular Basis of Inheritance", "Evolution", "Human Health and Disease",
        "Microbes in Human Welfare", "Biotechnology: Principles and Processes",
        "Biotechnology and its Applications", "Organisms and Populations",
        "Ecosystem", "Biodiversity and Conservation",
      ] },
      { subject: "English", board: "CBSE", chapters: [
        "The Last Lesson", "Lost Spring", "Deep Water", "The Rattrap", "Indigo",
        "Poets and Pancakes", "The Interview", "Going Places",
        "My Mother at Sixty-six", "Keeping Quiet", "A Thing of Beauty",
        "A Roadside Stand", "Aunt Jennifer's Tigers",
        "The Third Level", "The Tiger King", "Journey to the End of the Earth",
        "The Enemy", "On the Face of It", "Memories of Childhood",
      ] },
    ],
  },
];
