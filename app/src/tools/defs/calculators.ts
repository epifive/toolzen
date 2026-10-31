import type { ToolDefinition } from "../registry";

const FORMULA_NOT_ADVICE = "Results are estimates for planning only and are not financial advice.";
const EXACT_FACTORS = "Conversions use exact, internationally defined factors and show up to 10 significant digits.";

export const CALCULATOR_TOOLS: ToolDefinition[] = [
  // ───────────────────────────── Finance ─────────────────────────────
  {
    slug: "compound-interest-calculator",
    name: "Compound Interest Calculator",
    category: "calculator",
    icon: "trending-up",
    description: "See how savings grow with compound interest and monthly contributions, year by year.",
    keywords: [
      "compound interest calculator",
      "investment growth calculator",
      "savings calculator",
      "monthly compound interest",
      "future value calculator",
    ],
    steps: [
      "Enter the initial investment, annual interest rate and number of years.",
      "Choose how often interest compounds and add an optional monthly contribution.",
      "Review the future value, the growth table and download it as a CSV file.",
    ],
    faq: [
      {
        q: "What formula is used?",
        a: "Without contributions the future value is P × (1 + r/n)^(n × t). Monthly contributions are added at the end of each month and earn interest at the same effective rate.",
      },
      {
        q: "Does compounding frequency matter?",
        a: "Yes. The more often interest compounds, the more you earn, although the difference between monthly and daily compounding is small.",
      },
      { q: "Is this financial advice?", a: FORMULA_NOT_ADVICE },
    ],
    featured: true,
  },
  {
    slug: "simple-interest-calculator",
    name: "Simple Interest Calculator",
    category: "calculator",
    icon: "coins",
    description: "Calculate simple interest and the total amount for any principal, rate and time period.",
    keywords: ["simple interest calculator", "simple interest formula", "interest calculator", "p r t calculator"],
    steps: [
      "Enter the principal amount and the annual interest rate.",
      "Enter the time period in years, months or days.",
      "Read the interest, the total amount and how it compares with compound interest.",
    ],
    faq: [
      { q: "What is the simple interest formula?", a: "Interest = P × r × t, where P is the principal, r the annual rate and t the time in years." },
      {
        q: "How is simple interest different from compound interest?",
        a: "Simple interest is only earned on the original principal. Compound interest is also earned on interest already added, so it grows faster.",
      },
    ],
  },
  {
    slug: "sip-calculator",
    name: "SIP Calculator",
    category: "calculator",
    icon: "piggy-bank",
    description: "Estimate the future value of a monthly SIP in mutual funds, with an optional yearly step-up.",
    keywords: ["sip calculator", "mutual fund sip calculator", "step up sip calculator", "sip return calculator", "monthly investment calculator"],
    steps: [
      "Enter the monthly investment, expected annual return and investment period.",
      "Optionally add a yearly step-up to increase the instalment each year.",
      "See the amount invested, the estimated returns and a year-by-year table.",
    ],
    faq: [
      {
        q: "How is the SIP value calculated?",
        a: "Each instalment is invested at the start of the month and grows at the monthly rate r ÷ 12: FV = P × ((1 + i)^n − 1) ÷ i × (1 + i).",
      },
      { q: "What is a step-up SIP?", a: "A step-up SIP increases the monthly amount by a fixed percentage every year, for example as your income grows." },
      { q: "Are the returns guaranteed?", a: "No. Mutual fund returns vary with the market. " + FORMULA_NOT_ADVICE },
    ],
  },
  {
    slug: "fd-calculator",
    name: "FD Calculator",
    category: "calculator",
    icon: "vault",
    description: "Calculate fixed deposit maturity value and interest with quarterly, monthly or yearly compounding.",
    keywords: ["fd calculator", "fixed deposit calculator", "fd maturity calculator", "fd interest calculator", "term deposit calculator"],
    steps: [
      "Enter the deposit amount and annual interest rate.",
      "Enter the tenure in years, months and days and choose the compounding frequency.",
      "Read the maturity amount, the interest earned and the effective annual yield.",
    ],
    faq: [
      { q: "How do banks compound FD interest?", a: "Most banks compound fixed deposit interest quarterly. Maturity = P × (1 + r/n)^(n × t)." },
      {
        q: "Why is my bank's figure slightly different?",
        a: "Banks may count days differently, round interest each quarter or deduct tax at source. The difference is usually very small.",
      },
    ],
  },
  {
    slug: "roi-calculator",
    name: "ROI Calculator",
    category: "calculator",
    icon: "chart-line",
    description: "Calculate return on investment and annualized ROI (CAGR) from the amount invested and returned.",
    keywords: ["roi calculator", "return on investment calculator", "cagr calculator", "annualized return calculator", "investment return"],
    steps: [
      "Enter the amount invested and the final value of the investment.",
      "Optionally enter how long you held it.",
      "See the ROI, the annualized return, the profit and the investment multiple.",
    ],
    faq: [
      { q: "How is ROI calculated?", a: "ROI = (final value − amount invested) ÷ amount invested × 100." },
      {
        q: "What is annualized ROI?",
        a: "The compound annual growth rate (CAGR): (final ÷ invested)^(1 ÷ years) − 1. It lets you compare investments held for different periods.",
      },
    ],
  },
  {
    slug: "inflation-calculator",
    name: "Inflation Calculator",
    category: "calculator",
    icon: "trending-down",
    description: "See what money will cost in the future and how inflation reduces its purchasing power.",
    keywords: ["inflation calculator", "future value of money", "purchasing power calculator", "cost of living calculator"],
    steps: [
      "Enter an amount in today's money.",
      "Enter the expected average inflation rate and the number of years.",
      "Read the future cost, the remaining purchasing power and the year-by-year table.",
    ],
    faq: [
      { q: "How is the future cost calculated?", a: "Future cost = amount × (1 + inflation)^years. Purchasing power = amount ÷ (1 + inflation)^years." },
      { q: "Which inflation rate should I use?", a: "Use your country's long-run average consumer price inflation, often between 2% and 6% a year." },
    ],
  },
  {
    slug: "salary-calculator",
    name: "Salary Calculator",
    category: "calculator",
    icon: "wallet",
    description: "Convert pay between hourly, daily, weekly, monthly and yearly, including overtime.",
    keywords: ["salary calculator", "hourly to salary", "salary to hourly", "annual salary calculator", "overtime calculator"],
    steps: [
      "Enter your pay and choose the period it is paid for.",
      "Adjust hours per week, days per week and paid weeks per year.",
      "Optionally add overtime hours and the overtime multiplier to see your pay for every period.",
    ],
    faq: [
      { q: "How is an hourly wage converted to a yearly salary?", a: "Yearly salary = hourly rate × hours per week × weeks per year." },
      { q: "Is tax included?", a: "No. All amounts are gross pay before tax and other deductions." },
    ],
  },
  {
    slug: "profit-margin-calculator",
    name: "Profit Margin Calculator",
    category: "calculator",
    icon: "hand-coins",
    description: "Calculate gross profit, margin and markup, or the selling price for a target margin.",
    keywords: ["profit margin calculator", "markup calculator", "gross margin calculator", "selling price calculator", "margin vs markup"],
    steps: [
      "Choose whether you know the revenue, a target margin or a target markup.",
      "Enter the cost and the second value.",
      "Read the profit, margin, markup and selling price.",
    ],
    faq: [
      { q: "What is the difference between margin and markup?", a: "Margin is profit divided by the selling price; markup is profit divided by the cost." },
      { q: "How do I price for a target margin?", a: "Selling price = cost ÷ (1 − margin). For a 40% margin on a cost of 60, the price is 100." },
    ],
  },
  {
    slug: "tip-calculator",
    name: "Tip Calculator",
    category: "calculator",
    icon: "hand-platter",
    description: "Work out the tip and split the bill between any number of people, with rounding.",
    keywords: ["tip calculator", "split bill calculator", "gratuity calculator", "restaurant tip"],
    steps: ["Enter the bill amount.", "Pick a tip percentage and the number of people.", "Optionally round up, then read each person's share."],
    faq: [
      { q: "How much should I tip?", a: "Customs vary by country. In the US 15–20% is usual in restaurants; in many other countries tips are smaller or included." },
      { q: "How does rounding work?", a: "Rounding goes up to the next whole amount, either for the total or for each person's share, and the extra is added to the tip." },
    ],
  },

  // ───────────────────────────── Education ─────────────────────────────
  {
    slug: "gpa-calculator",
    name: "GPA Calculator",
    category: "calculator",
    icon: "graduation-cap",
    description: "Calculate your term GPA and cumulative GPA on a 4.0 or 10-point scale.",
    keywords: ["gpa calculator", "cgpa calculator", "college gpa calculator", "cumulative gpa calculator", "sgpa calculator"],
    steps: [
      "Choose the 4.0 or 10-point grading scale.",
      "Add your courses with their credits and grades.",
      "Optionally enter your current CGPA and credits to get the new cumulative GPA.",
    ],
    faq: [
      { q: "How is GPA calculated?", a: "GPA = Σ(credits × grade points) ÷ Σ credits." },
      {
        q: "How is the cumulative GPA calculated?",
        a: "Previous CGPA × previous credits plus this term's grade points, divided by all credits together.",
      },
    ],
  },
  {
    slug: "cgpa-to-percentage",
    name: "CGPA to Percentage Converter",
    category: "calculator",
    icon: "school",
    description: "Convert CGPA to percentage and percentage to CGPA with CBSE, university or custom formulas.",
    keywords: ["cgpa to percentage", "percentage to cgpa", "cbse cgpa to percentage", "gpa to percentage", "sgpa to percentage"],
    steps: [
      "Choose the conversion direction.",
      "Pick the formula your board or university uses, or enter a custom multiplier.",
      "Enter your CGPA or percentage and read the result.",
    ],
    faq: [
      { q: "How do I convert CBSE CGPA to percentage?", a: "Multiply the CGPA by 9.5. For example, a CGPA of 8.2 is 77.9%." },
      { q: "Which formula should I use?", a: "Use the formula on your mark sheet or published by your university, as institutions differ." },
    ],
  },

  // ───────────────────────────── Health ─────────────────────────────
  {
    slug: "bmr-calorie-calculator",
    name: "BMR & Calorie Calculator",
    category: "calculator",
    icon: "flame",
    description: "Calculate your BMR and daily calories to lose, keep or gain weight (Mifflin-St Jeor).",
    keywords: ["bmr calculator", "calorie calculator", "tdee calculator", "maintenance calories", "calorie deficit calculator"],
    steps: [
      "Choose metric or imperial units and enter your sex, age, height and weight.",
      "Select your typical activity level.",
      "Read your BMR, maintenance calories and the targets for each weight goal.",
    ],
    faq: [
      { q: "Which formula is used?", a: "The Mifflin-St Jeor equation, considered the most accurate common BMR formula for most adults." },
      {
        q: "Is this medical advice?",
        a: "No. The results are estimates. Talk to a doctor or dietitian before making big changes to your diet, especially below 1,200–1,500 kcal a day.",
      },
    ],
  },
  {
    slug: "pregnancy-due-date-calculator",
    name: "Pregnancy Due Date Calculator",
    category: "calculator",
    icon: "baby",
    description: "Estimate your due date from your last period, conception date or IVF transfer, with weekly milestones.",
    keywords: ["due date calculator", "pregnancy calculator", "how many weeks pregnant", "ivf due date calculator", "conception calculator"],
    steps: [
      "Choose last period, conception date or IVF transfer.",
      "Enter the date (and your cycle length or embryo age if asked).",
      "See the due date, how far along you are, the trimester and key milestones.",
    ],
    faq: [
      {
        q: "How is the due date calculated?",
        a: "From the last period it is 280 days after its first day, adjusted for cycle length; from conception it is 266 days later; from an IVF transfer it is 266 days minus the embryo's age.",
      },
      {
        q: "Is this medical advice?",
        a: "No. It is an estimate only; an ultrasound dating scan is more accurate. Always follow your doctor's or midwife's advice.",
      },
    ],
  },

  // ───────────────────────────── Everyday ─────────────────────────────
  {
    slug: "time-zone-converter",
    name: "Time Zone Converter",
    category: "calculator",
    icon: "globe",
    description: "Convert a date and time between world time zones, with UTC offsets and daylight saving.",
    keywords: ["time zone converter", "world clock", "est to ist", "utc converter", "meeting time planner"],
    steps: [
      "Pick a date, a time and the time zone it is in.",
      "Add or remove the time zones you want to compare.",
      "Read the converted times and copy them all with one click.",
    ],
    faq: [
      {
        q: "Does it handle daylight saving time?",
        a: "Yes. Offsets come from your browser's time zone database for the chosen date, so summer and winter time are always correct.",
      },
      { q: "How many time zones are available?", a: "Every IANA time zone your browser supports, usually more than 400." },
    ],
  },
  {
    slug: "random-number-generator",
    name: "Random Number Generator",
    category: "calculator",
    icon: "dices",
    description: "Generate secure random numbers in any range, with unique, decimal and sorting options.",
    keywords: ["random number generator", "random number picker", "lottery number generator", "rng", "pick a random number"],
    steps: [
      "Enter the minimum, maximum and how many numbers you need.",
      "Choose whole numbers or decimals, and whether repeats are allowed.",
      "Press Generate, then copy or download the numbers.",
    ],
    faq: [
      {
        q: "Are the numbers truly random?",
        a: "They come from your browser's cryptographically secure generator (crypto.getRandomValues) with rejection sampling, so every value is equally likely.",
      },
      { q: "Are both the minimum and maximum included?", a: "Yes. Both ends of the range can be drawn." },
    ],
  },
  {
    slug: "average-calculator",
    name: "Average Calculator",
    category: "calculator",
    icon: "sigma",
    description: "Find the mean, median, mode, range and standard deviation of a list of numbers.",
    keywords: ["average calculator", "mean median mode calculator", "standard deviation calculator", "statistics calculator"],
    steps: [
      "Paste or type your numbers, separated by commas, spaces or new lines.",
      "See the mean, median, mode, range, sum and standard deviation instantly.",
      "Copy the sorted list if you need it.",
    ],
    faq: [
      { q: "What is the difference between mean and median?", a: "The mean is the sum divided by the count; the median is the middle value when the numbers are sorted." },
      {
        q: "Population or sample standard deviation?",
        a: "Use population when your numbers are the whole group, and sample (divided by n − 1) when they are a sample of a larger group.",
      },
    ],
  },

  // ───────────────────────────── Unit converters ─────────────────────────────
  {
    slug: "length-converter",
    name: "Length Converter",
    category: "converter",
    icon: "ruler",
    description: "Convert cm to inches, feet to metres, km to miles and every other length unit.",
    keywords: ["cm to inches", "inches to cm", "feet to meters", "meters to feet", "km to miles", "length converter"],
    steps: ["Enter a value.", "Choose the unit to convert from and to.", "Read the result or compare all units in the table."],
    faq: [
      { q: "How many centimetres are in an inch?", a: "Exactly 2.54 cm. One foot is 30.48 cm and one mile is 1.609344 km." },
      { q: "How precise is it?", a: EXACT_FACTORS },
    ],
  },
  {
    slug: "weight-converter",
    name: "Weight Converter",
    category: "converter",
    icon: "weight",
    description: "Convert kg to lbs, pounds to kilograms, grams to ounces, stone and tonnes.",
    keywords: ["kg to lbs", "lbs to kg", "grams to ounces", "stone to kg", "weight converter", "mass converter"],
    steps: ["Enter a weight.", "Choose the units to convert between.", "Read the result or see it in every unit."],
    faq: [
      { q: "How many pounds are in a kilogram?", a: "One kilogram is about 2.20462 pounds; one pound is exactly 0.45359237 kg." },
      { q: "How precise is it?", a: EXACT_FACTORS },
    ],
  },
  {
    slug: "temperature-converter",
    name: "Temperature Converter",
    category: "converter",
    icon: "thermometer",
    description: "Convert Celsius to Fahrenheit, Fahrenheit to Celsius, Kelvin and Rankine.",
    keywords: ["celsius to fahrenheit", "fahrenheit to celsius", "c to f", "f to c", "kelvin to celsius", "temperature converter"],
    steps: ["Enter a temperature.", "Choose the scales to convert between.", "Read the result and the conversion formula."],
    faq: [
      { q: "How do I convert Celsius to Fahrenheit?", a: "°F = °C × 1.8 + 32. For example, 20 °C is 68 °F." },
      { q: "What is absolute zero?", a: "−273.15 °C, 0 K or −459.67 °F. The converter won't accept lower temperatures." },
    ],
  },
  {
    slug: "area-converter",
    name: "Area Converter",
    category: "converter",
    icon: "square-dashed",
    description: "Convert square feet to square metres, acres to hectares and other area units.",
    keywords: ["sq ft to sq m", "square meters to square feet", "acres to hectares", "hectare to acre", "area converter"],
    steps: ["Enter an area.", "Choose the units to convert between.", "Read the result or compare all units."],
    faq: [
      { q: "How many square feet are in a square metre?", a: "About 10.7639 square feet. One acre is about 0.4047 hectares." },
      { q: "How precise is it?", a: EXACT_FACTORS },
    ],
  },
  {
    slug: "volume-converter",
    name: "Volume Converter",
    category: "converter",
    icon: "beaker",
    description: "Convert litres to gallons, ml to fluid ounces, cups, tablespoons and cubic units.",
    keywords: ["liters to gallons", "gallons to liters", "ml to oz", "cups to ml", "volume converter"],
    steps: ["Enter a volume.", "Choose the units, including US or imperial measures.", "Read the result or compare all units."],
    faq: [
      { q: "Are US and UK gallons different?", a: "Yes. A US gallon is 3.785 litres and an imperial (UK) gallon is 4.546 litres." },
      { q: "How precise is it?", a: EXACT_FACTORS },
    ],
  },
  {
    slug: "speed-converter",
    name: "Speed Converter",
    category: "converter",
    icon: "gauge",
    description: "Convert km/h to mph, metres per second, feet per second and knots.",
    keywords: ["kmh to mph", "mph to kmh", "m/s to km/h", "knots to mph", "speed converter"],
    steps: ["Enter a speed.", "Choose the units to convert between.", "Read the result or compare all units."],
    faq: [
      { q: "How do I convert km/h to mph?", a: "Divide by 1.609344. For example, 100 km/h is about 62.14 mph." },
      { q: "How precise is it?", a: EXACT_FACTORS },
    ],
  },
  {
    slug: "time-converter",
    name: "Time Converter",
    category: "converter",
    icon: "hourglass",
    description: "Convert seconds, minutes, hours, days, weeks, months and years.",
    keywords: ["hours to minutes", "minutes to seconds", "days to hours", "seconds to hours", "time converter"],
    steps: ["Enter a duration.", "Choose the units to convert between.", "Read the result or compare all units."],
    faq: [
      { q: "How long is a month or a year here?", a: "An average Gregorian year of 365.2425 days and a month of one twelfth of that (about 30.44 days)." },
      { q: "How precise is it?", a: EXACT_FACTORS },
    ],
  },
  {
    slug: "data-storage-converter",
    name: "Data Storage Converter",
    category: "converter",
    icon: "hard-drive",
    description: "Convert bytes, KB, MB, GB, TB and bits, in both decimal and binary (KiB, MiB, GiB) units.",
    keywords: ["mb to gb", "gb to mb", "gb to gib", "bytes converter", "mbps to mb/s", "data storage converter"],
    steps: ["Enter an amount of data.", "Choose decimal (GB) or binary (GiB) units.", "Read the result or compare all units."],
    faq: [
      {
        q: "What is the difference between GB and GiB?",
        a: "A gigabyte (GB) is 1,000³ bytes; a gibibyte (GiB) is 1,024³ bytes. Drive makers use GB, many operating systems show GiB.",
      },
      { q: "How do I convert Mbps to MB/s?", a: "Divide by 8, because there are 8 bits in a byte. 100 Mbit is 12.5 MB." },
    ],
  },
  {
    slug: "pressure-converter",
    name: "Pressure Converter",
    category: "converter",
    icon: "gauge-circle",
    description: "Convert bar to psi, kPa, atmospheres, mmHg and other pressure units.",
    keywords: ["bar to psi", "psi to bar", "kpa to psi", "atm to pa", "mmhg to kpa", "pressure converter"],
    steps: ["Enter a pressure.", "Choose the units to convert between.", "Read the result or compare all units."],
    faq: [
      { q: "How many psi is one bar?", a: "One bar is about 14.5038 psi, and one standard atmosphere is 101.325 kPa." },
      { q: "How precise is it?", a: EXACT_FACTORS },
    ],
  },
  {
    slug: "energy-converter",
    name: "Energy Converter",
    category: "converter",
    icon: "zap",
    description: "Convert kcal to kJ, kWh, joules, BTU, calories and electronvolts.",
    keywords: ["kcal to kj", "kj to kcal", "kwh to joules", "btu to kwh", "calories to joules", "energy converter"],
    steps: ["Enter an amount of energy.", "Choose the units to convert between.", "Read the result or compare all units."],
    faq: [
      { q: "How many kilojoules are in a calorie?", a: "One food calorie (kcal) is 4.184 kJ." },
      { q: "How precise is it?", a: EXACT_FACTORS },
    ],
  },
  {
    slug: "power-converter",
    name: "Power Converter",
    category: "converter",
    icon: "plug-zap",
    description: "Convert horsepower to kW, watts, metric horsepower (PS), BTU/h and more.",
    keywords: ["hp to kw", "kw to hp", "watts to horsepower", "ps to kw", "btu to watts", "power converter"],
    steps: ["Enter a power value.", "Choose the units to convert between.", "Read the result or compare all units."],
    faq: [
      {
        q: "What is the difference between hp and PS?",
        a: "Mechanical horsepower (hp) is about 745.7 W; metric horsepower (PS or CV) is 735.49875 W.",
      },
      { q: "How precise is it?", a: EXACT_FACTORS },
    ],
  },
  {
    slug: "angle-converter",
    name: "Angle Converter",
    category: "converter",
    icon: "triangle-right",
    description: "Convert degrees to radians, gradians, arcminutes, arcseconds and turns.",
    keywords: ["degrees to radians", "radians to degrees", "deg to rad", "arcminutes", "angle converter"],
    steps: ["Enter an angle.", "Choose the units to convert between.", "Read the result or compare all units."],
    faq: [
      { q: "How do I convert degrees to radians?", a: "Multiply by π ÷ 180. For example, 180° is π (about 3.14159) radians." },
      { q: "What is a gradian?", a: "A gradian (gon) is 1/400 of a full turn, so a right angle is 100 gradians." },
    ],
  },
];
