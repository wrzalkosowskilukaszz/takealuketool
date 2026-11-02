/**
 * Grow: career paths outside day-to-day design, each tied to Łukasz's CV. Written 2026-11-02.
 *
 * Every link was taken from a page or search result checked on that date; `pnpm links:check` re-checks
 * them all. Pay is described in words with a source to look up current figures, because salary numbers
 * date quickly and differ by city and company.
 */
import type { ExploreField } from "@/lib/jobs/types";

export type PathLink = {
  title: string;
  url: string;
  kind: "course" | "guide" | "community" | "law" | "pay" | "book" | "tool";
};

export type CareerPath = {
  slug: string;
  title: string;
  /** Explore field whose live offers are shown on the page (null: matching by track). */
  field: ExploreField | null;
  tagline: string;
  whyYou: string[];
  theWork: string;
  pay: string;
  gaps: string[];
  plan: { days30: string[]; days60: string[]; days90: string[] };
  links: PathLink[];
};

export const PATHS: CareerPath[] = [
  {
    slug: "real-estate",
    title: "Real estate agent or broker",
    field: "real_estate",
    tagline: "Sell and rent property, residential or commercial, on commission.",
    whyYou: [
      "You studied Real Estate Management and Economics at WSGN (2009–2012): the vocabulary, valuation basics and market logic are not new to you.",
      "Your work is persuasion with visuals: you could market listings (photos, video, AI-made staging, landing pages) better than most agents.",
      "You present to boards and C-level (Win Casino, UNICEF, Lingaro); a buyer or an investor is an easier room.",
      "Friends say you would sell well; real estate pays directly for that.",
    ],
    theWork:
      "Finding owners who want to sell or rent (the hardest part), valuing and preparing listings, viewings, negotiating, and guiding paperwork with notaries and banks. Residential work is evenings and weekends; commercial (offices, retail, logistics) is office hours, longer deals and bigger fees, usually inside agencies such as CBRE, JLL, Colliers or Cushman & Wakefield.",
    pay: "Mostly commission: a share of the agency's fee, often with a low or no base salary at the start, so the first months are lean. Commercial roles at international agencies more often pay a base salary plus bonus. Look up current figures in the salary reports linked below.",
    gaps: [
      "A pipeline of owners and buyers (it takes months to build).",
      "Polish property law basics: land registers (księgi wieczyste), notarial deeds, mortgages.",
      "Comfort with income that swings month to month.",
    ],
    plan: {
      days30: [
        "Read how the profession works in Poland: since 1 January 2014 no state licence is needed, but liability insurance (OC) is mandatory.",
        "Talk to three agents (one residential, one commercial, one at a developer) about their first year.",
        "Pick a niche where your design eye counts: premium flats, new developments, or commercial space for creative companies.",
      ],
      days60: [
        "Take a short practical course for intermediaries (e.g. a university academy of the real estate market).",
        "Build a sample listing kit: AI-staged photos, a one-page site, a short video. It is your portfolio for agencies.",
        "Apply to two or three agencies with training programmes, or a developer's sales office.",
      ],
      days90: [
        "Close or co-close a first deal under a senior agent.",
        "Decide: residential on commission, or commercial with a base salary.",
      ],
    },
    links: [
      {
        title: "How to become a real estate agent: from zero to first sale (ONGEO)",
        url: "https://blog.ongeo.pl/jak-zostac-agentem-nieruchomosci",
        kind: "guide",
      },
      {
        title: "Requirements, training and costs of becoming an agent (KB.pl)",
        url: "https://kb.pl/prawo/kupno-sprzedaz-nieruchomosci/jak-zostac-agentem-nieruchomosci-wymagania-szkolenia-koszty/",
        kind: "guide",
      },
      {
        title: "Intermediaries without a licence since 2014 (Infor)",
        url: "https://kadry.infor.pl/wiadomosci/674724,Posrednik-i-zarzadca-nieruchomosci-od-2014-roku-bez-licencji.html",
        kind: "law",
      },
      {
        title: "Mandatory OC insurance for intermediaries: the regulation (Infor)",
        url: "https://www.infor.pl/akt-prawny/DZU.2013.241.0001626,rozporzadzenie-ministra-finansow-w-sprawie-obowiazkowego-ubezpieczenia-odpowiedzialnosci-cywilnej-posrednika-w-obrocie-nieruchomosciami.html",
        kind: "law",
      },
      {
        title: "2026 bill: ban on double commission, possible registry (ONGEO)",
        url: "https://www.blog.ongeo.pl/regulacja-posrednikow-nieruchomosci-zakaz-podwojnej-prowizji",
        kind: "law",
      },
      {
        title: "Academy of the Real Estate Market, Lazarski University",
        url: "https://ckp.lazarski.pl/aktualnosci/rozwijaj-kompetencje-w-akademii-rynku-nieruchomosci-uczelni-lazarskiego",
        kind: "course",
      },
      {
        title: "RICS: the global professional body for property",
        url: "https://www.rics.org/",
        kind: "community",
      },
      { title: "Hays Poland salary report", url: "https://www.hays.pl/raport-placowy", kind: "pay" },
    ],
  },
  {
    slug: "b2b-sales",
    title: "B2B and SaaS sales",
    field: "sales",
    tagline: "Account Executive or Account Manager: sell software or services to companies.",
    whyYou: [
      "You have spent years turning a client's vague need into a clear proposal and a presentation that wins the room.",
      "You understand creative and AI tools from the inside: selling Figma, Adobe, Canva, ElevenLabs or a creative agency's services to marketing teams plays to that.",
      "You manage stakeholders up to the board and handle pushback without losing the relationship.",
    ],
    theWork:
      "Prospecting, discovery calls, demos, proposals, negotiation and closing, tracked in a CRM against a quarterly target. Entry roles (SDR or BDR) book meetings; Account Executives run the deal; Account Managers grow existing clients.",
    pay: "Base salary plus commission (often split around 50/50 between the two at target in SaaS). International software companies with Warsaw offices usually pay the most. Check current figures in the salary reports.",
    gaps: [
      "A sales method (discovery, qualification, objection handling) and CRM discipline.",
      "Comfort with targets and rejection.",
      "Proof: a number you sold or grew, framed in sales language (Black Week +16% is a good start).",
    ],
    plan: {
      days30: [
        "Do the free HubSpot sales training to learn the vocabulary and the pipeline.",
        "List 20 companies that sell to marketing and creative teams; follow their sales leaders.",
        "Rewrite your CV around revenue and persuasion: campaigns, pitches, loyalty programme, fundraising.",
      ],
      days60: [
        "Learn one CRM hands-on (HubSpot or Salesforce Trailhead).",
        "Run mock discovery calls with a friend in sales; record and review them.",
        "Apply to Account Executive roles at creative-tool and AI companies, where your domain knowledge is rare.",
      ],
      days90: [
        "Aim for a role with a structured onboarding and a ramped target.",
        "Keep a small freelance design practice on the side until commission is steady.",
      ],
    },
    links: [
      {
        title: "HubSpot sales training",
        url: "https://www.hubspot.com/sales/sales-training",
        kind: "course",
      },
      {
        title: "HubSpot Academy: inbound sales",
        url: "https://academy.hubspot.com/track-your-sales",
        kind: "course",
      },
      {
        title: "Salesforce Trailhead (free CRM learning)",
        url: "https://trailhead.salesforce.com/",
        kind: "course",
      },
      { title: "Hays Poland salary report", url: "https://www.hays.pl/raport-placowy", kind: "pay" },
    ],
  },
  {
    slug: "partnerships",
    title: "Partnerships and business development",
    field: "partnerships",
    tagline: "Build deals between companies: integrations, co-marketing, agencies, resellers.",
    whyYou: [
      "At UNICEF you already partner with media houses and external agencies; that is partnership work.",
      "You can design the pitch, the deck and the co-marketing campaign yourself.",
      "AI companies grow through agency and creator partnerships, where a creative lead is credible.",
    ],
    theWork:
      "Finding partners, shaping a deal that helps both sides, aligning legal, product and marketing, and launching joint campaigns. Less cold calling than sales, more long relationships and internal coordination.",
    pay: "Usually a base salary with a bonus tied to partner-sourced revenue. Check current figures in the salary reports.",
    gaps: ["Basic deal structures and contracts.", "Measuring partner-sourced pipeline."],
    plan: {
      days30: [
        "Map 15 AI and creative-tool companies with agency or partner programmes.",
        "Write a one-page partner proposal for one of them as a portfolio piece.",
      ],
      days60: [
        "Join the partnerships community below and attend a chapter event.",
        "Apply to partner or agency manager roles at creative-tool companies.",
      ],
      days90: ["Use one freelance client to run a real co-marketing campaign you can show."],
    },
    links: [
      {
        title: "Partnership Leaders: community for partnership professionals",
        url: "https://partnershipleaders.com/",
        kind: "community",
      },
      { title: "Hays Poland salary report", url: "https://www.hays.pl/raport-placowy", kind: "pay" },
    ],
  },
  {
    slug: "brand-marketing-lead",
    title: "Brand and marketing leadership",
    field: "marketing",
    tagline: "Brand Manager, Head of Brand or Marketing Lead: own the brand, not only its look.",
    whyYou: [
      "You led a full brand transformation at Win Casino: positioning, archetypes, tone of voice, rollout.",
      "You run fundraising campaigns at UNICEF with media houses and agencies, from strategy to landing pages.",
      "You know performance and CRM work across 17 markets from Expondo.",
    ],
    theWork:
      "Setting positioning and the brand platform, planning campaigns and budgets, briefing agencies, and answering for results (awareness, leads, sales). More spreadsheets and meetings, far less Figma.",
    pay: "Salary plus bonus; brand and marketing heads at larger companies earn well above senior designers. Check current figures in the salary reports.",
    gaps: [
      "Marketing strategy and measurement (segmentation, targeting, budgets).",
      "Owning a P&L or a media budget.",
    ],
    plan: {
      days30: [
        "Read about the Mini MBA in Marketing and decide whether to take the next cohort.",
        "Write a short case study of Win Casino as a brand strategy story with outcomes.",
      ],
      days60: ["Take the course or an equivalent.", "Apply to Brand Manager and Head of Brand roles."],
      days90: ["Pitch yourself as a creative who can run the brand end to end."],
    },
    links: [
      {
        title: "Mini MBA in Marketing (Mark Ritson): what it is",
        url: "https://www.marketingweek.com/mini-mba-in-marketing-all-you-need-to-know/",
        kind: "course",
      },
      { title: "Hays Poland salary report", url: "https://www.hays.pl/raport-placowy", kind: "pay" },
    ],
  },
  {
    slug: "product",
    title: "Product management",
    field: "product",
    tagline: "Decide what a digital product does next, with design and engineering.",
    whyYou: [
      "You have shipped digital products, design systems and AI tools, and you know how teams build.",
      "You built Claude-based tools at Lingaro from concept to rollout: that is product work.",
    ],
    theWork:
      "Talking to users, choosing problems, writing specs, prioritising a roadmap, and working with engineers and designers every day. AI product roles add model evaluation and prompt design.",
    pay: "Salary plus bonus or equity; similar to or above senior design. Check current figures in the salary reports.",
    gaps: [
      "Product discovery methods, metrics and experimentation.",
      "Working closely with engineering on trade-offs.",
    ],
    plan: {
      days30: [
        "Read Marty Cagan's INSPIRED.",
        "Write up your Lingaro AI tool as a product case: problem, users, results.",
      ],
      days60: [
        "Join Mind the Product events or content.",
        "Apply to AI product roles and design-to-product moves inside companies.",
      ],
      days90: ["Ship a small AI product end to end (Lovable or Claude Code) and measure its use."],
    },
    links: [
      {
        title: "SVPG (Marty Cagan): books including INSPIRED",
        url: "https://www.svpg.com/books/",
        kind: "book",
      },
      { title: "Mind the Product", url: "https://www.mindtheproduct.com/", kind: "community" },
      { title: "Hays Poland salary report", url: "https://www.hays.pl/raport-placowy", kind: "pay" },
    ],
  },
  {
    slug: "ai-consultant",
    title: "AI consultant or trainer for creative teams",
    field: "consulting",
    tagline: "Help agencies and brands adopt AI tools and workflows, and teach them.",
    whyYou: [
      "You built and introduced Claude-based workflows for a creative team at Lingaro.",
      "You know Midjourney, Firefly, Runway, Krea, Figma AI, Lovable, v0 and Claude Code hands-on.",
      "You have AI training from OpenAI Academy, DeepLearning.AI and Anthropic.",
    ],
    theWork:
      "Auditing how a team works, designing AI workflows, running workshops, writing guidelines (quality, brand, legal), and supporting the rollout. Freelance, at a consultancy, or as an in-house AI enablement lead.",
    pay: "Day rates as a freelancer, or salary in-house; experienced AI enablement leads are in demand. Check current figures in the salary reports.",
    gaps: [
      "Packaging the offer (scope, outcomes, price).",
      "Change management: getting teams to actually adopt.",
    ],
    plan: {
      days30: [
        "Finish the free Anthropic Academy courses relevant to teams.",
        "Write a two-page AI workflow playbook for creative teams from your Lingaro experience.",
      ],
      days60: [
        "Run one paid or pilot workshop for an agency.",
        "Publish the playbook on lukaszwrzal.com and LinkedIn.",
      ],
      days90: ["Turn it into a fixed-price offer under Take a Luke Studio, or apply to AI enablement roles."],
    },
    links: [
      { title: "Anthropic Academy (free courses)", url: "https://anthropic.skilljar.com/", kind: "course" },
      {
        title: "DeepLearning.AI short courses",
        url: "https://www.deeplearning.ai/short-courses/",
        kind: "course",
      },
      {
        title: "Elements of AI (free, University of Helsinki)",
        url: "https://www.elementsofai.com/",
        kind: "course",
      },
    ],
  },
  {
    slug: "creative-technologist",
    title: "Creative technologist",
    field: null,
    tagline: "Prototype with code, AI and new media: the bridge between ideas and technology.",
    whyYou: [
      "You already build with Lovable, v0, Claude Code, Jitter and Krea nodes.",
      "You think in concepts and campaigns, which most engineers do not.",
    ],
    theWork:
      "Fast prototypes, AI pipelines for images and video, interactive installations, and tools for creative teams. Found at agencies, AI companies and innovation teams.",
    pay: "Salary similar to senior design, higher at product and AI companies. Check current figures in the salary reports.",
    gaps: [
      "Some code (JavaScript, a creative coding library).",
      "A portfolio of working prototypes, not mock-ups.",
    ],
    plan: {
      days30: [
        "Learn p5.js basics and ship three small sketches.",
        "Build one ComfyUI or Krea pipeline you can demo.",
      ],
      days60: ["Make an interactive brand piece (Three.js or TouchDesigner)."],
      days90: ["Apply to creative technologist roles with three working prototypes."],
    },
    links: [
      { title: "p5.js: creative coding", url: "https://p5js.org/", kind: "tool" },
      { title: "Three.js", url: "https://threejs.org/", kind: "tool" },
      { title: "TouchDesigner (Derivative)", url: "https://derivative.ca/", kind: "tool" },
    ],
  },
  {
    slug: "creative-entrepreneur",
    title: "Creative entrepreneur: grow Take a Luke Studio",
    field: null,
    tagline: "Turn the studio into a business with productised AI and brand offers.",
    whyYou: [
      "You have run Take a Luke Studio since 2022 for international and local clients.",
      "You build AI tools that help small teams do more with branding: that can be a product.",
    ],
    theWork:
      "Choosing a niche, packaging fixed-price offers, selling, delivering with a small network, and building one product line (templates, AI tools, trainings).",
    pay: "Uneven at first, but no ceiling; it depends on pricing and positioning more than hours.",
    gaps: ["A repeatable way to win clients.", "Pricing on value instead of time."],
    plan: {
      days30: ["Read The Win Without Pitching Manifesto.", "Define one niche and one fixed-price offer."],
      days60: ["Sell the offer to three past clients or contacts.", "Check PARP programmes for support."],
      days90: ["Decide: studio full time, or studio alongside a role found here."],
    },
    links: [
      { title: "Win Without Pitching", url: "https://www.winwithoutpitching.com/", kind: "book" },
      {
        title: "biznes.gov.pl: running a business in Poland",
        url: "https://www.biznes.gov.pl/",
        kind: "guide",
      },
      { title: "PARP: support for entrepreneurs", url: "https://www.parp.gov.pl/", kind: "guide" },
    ],
  },
];

export const pathBySlug = (slug: string) => PATHS.find((p) => p.slug === slug) ?? null;

/** All curated URLs, so the advisor can tell checked links from new ones. */
export const CURATED_URLS = new Set(PATHS.flatMap((p) => p.links.map((l) => l.url)));
