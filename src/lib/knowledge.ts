import {
  getAvailability,
  getCertifications,
  getExperience,
  getProfile,
  getProjects,
  getSkills,
  getTestimonials,
} from './content';

export const ASSISTANT_EXAMPLE_QUESTIONS = [
  'What XR and spatial computing work has Swapon built?',
  'Which game engines and programming languages does he use?',
  'Tell me about his medical AR/VR experience.',
  'Summarize his career timeline and current role.',
  'How can I contact Swapon or view his GitHub?',
] as const;

export interface KnowledgePack {
  knowledgeText: string;
  systemInstruction: string;
  searchableLower: string;
  faqAnswers: Record<string, string>;
  contactEmail: string;
}

let cachedPack: KnowledgePack | null = null;

export function resetKnowledgeCache(): void {
  cachedPack = null;
}

export async function buildKnowledgePack(): Promise<KnowledgePack> {
  if (cachedPack) return cachedPack;

  const [
    profile,
    availability,
    skills,
    experience,
    projects,
    certifications,
    testimonials,
  ] = await Promise.all([
    getProfile(),
    getAvailability(),
    getSkills(),
    getExperience(),
    getProjects(),
    getCertifications(),
    getTestimonials(),
  ]);

  const sections: string[] = [];

  sections.push(
    [
      'PROFILE:',
      `Name: ${profile.fullName} (${profile.name})`,
      `Headline: ${profile.headline}`,
      `Intro: ${profile.intro}`,
      `Location: ${profile.location}`,
      `Email: ${profile.email}`,
      `GitHub: ${profile.links.github}`,
      `LinkedIn: ${profile.links.linkedin}`,
      `About: ${profile.about.join(' ')}`,
      `Education: ${profile.education
        .map((e) => `${e.degree} — ${e.institution} (${e.period})`)
        .join('; ')}`,
      `Core Expertise: ${profile.expertise.join(', ')}`,
    ].join('\n')
  );

  if (availability.status !== 'hidden') {
    sections.push(
      [
        'AVAILABILITY:',
        `Status: ${availability.status}`,
        ...(availability.headline ? [`Headline: ${availability.headline}`] : []),
        ...(availability.engagements.length > 0
          ? [`Engagements: ${availability.engagements.join(', ')}`]
          : []),
        ...(availability.note ? [`Note: ${availability.note}`] : []),
      ].join('\n')
    );
  } else {
    sections.push(
      'AVAILABILITY:\nCurrent availability status is not publicly listed. Direct inquiries to the contact form (#contact) or email.'
    );
  }

  sections.push(
    [
      'SKILLS:',
      ...skills.categories.map(
        (cat) => `- ${cat.label}: ${cat.skills.map((s) => s.name).join(', ')}`
      ),
    ].join('\n')
  );

  sections.push(
    [
      'EXPERIENCE:',
      ...experience.map((exp) => {
        const header = `- ${exp.data.role} at ${exp.data.company} (${exp.data.period}, ${exp.data.location})`;
        const details = exp.data.responsibilities.join(' ');
        const tech =
          exp.data.tech.length > 0
            ? ` [Tech: ${exp.data.tech.join(', ')}]`
            : '';
        return `${header}${details ? `: ${details}` : ''}${tech}`;
      }),
    ].join('\n')
  );

  sections.push(
    [
      'PROJECTS:',
      ...projects.map((p) => {
        const org = p.data.organization ? ` (${p.data.organization})` : '';
        const link = p.data.links?.repo ? ` Repo: ${p.data.links.repo}` : '';
        return `- ${p.data.title}${org} [${p.data.categories.join(', ')}]: ${p.data.summary} Tech: ${p.data.tech.join(', ')}.${link}`;
      }),
    ].join('\n')
  );

  if (certifications.length > 0) {
    sections.push(
      [
        'CERTIFICATIONS:',
        ...certifications.map(
          (c) => `- ${c.data.name} (${c.data.authority})`
        ),
      ].join('\n')
    );
  }

  if (testimonials.length > 0) {
    sections.push(
      [
        'RECOMMENDATIONS:',
        ...testimonials.map(
          (t) => `- ${t.data.author}: "${t.data.quote}"`
        ),
      ].join('\n')
    );
  }

  const knowledgeText = sections.join('\n\n');
  const systemInstruction = [
    `You are the portfolio assistant for ${profile.name} (${profile.location}).`,
    'Answer questions strictly and ONLY using the verified PORTFOLIO KNOWLEDGE below.',
    `If a fact, technology, project, date, or topic is NOT in the knowledge pack, respond with: "I don't have that information." and point the visitor to the contact form (#contact) or ${profile.email}.`,
    'Keep answers concise (2-4 sentences or short bullet points).',
    'Never invent metrics, percentages, client names, phone numbers, or street addresses.',
    'Politely decline unrelated tasks (coding homework, general trivia, writing essays, etc.) and steer back to Swapon’s portfolio.',
    '',
    '--- PORTFOLIO KNOWLEDGE ---',
    knowledgeText,
  ].join('\n');

  const xrProjects = projects
    .filter((p) => p.data.categories.includes('XR'))
    .slice(0, 6)
    .map((p) => p.data.title);
  const engineCat = skills.categories.find((c) => c.id === 'engines');
  const langCat = skills.categories.find((c) => c.id === 'programming');
  const medicalProjects = projects
    .filter((p) => p.data.categories.includes('Medical'))
    .map((p) => p.data.title);
  const currentExp = experience[0];
  const recentRoles = experience
    .slice(0, 4)
    .map((e) => `${e.data.role} at ${e.data.company} (${e.data.period})`);

  const faqAnswers: Record<string, string> = {
    [ASSISTANT_EXAMPLE_QUESTIONS[0]]: `Swapon builds AR, VR, and spatial computing experiences across mobile, headsets, and optical AR glasses—including ${xrProjects.join(', ')}. His XR stack spans OpenXR, Android XR, XREAL SDK, AR Foundation, ARKit, ARCore, and Oculus SDK.`,
    [ASSISTANT_EXAMPLE_QUESTIONS[1]]: `He works primarily with ${engineCat?.skills.map((s) => s.name).join(', ') || 'Unity and Unreal Engine'}, using programming languages including ${langCat?.skills.map((s) => s.name).join(', ') || 'C#, C++, Blueprint, JavaScript, Python, Lua, and Verse'}.`,
    [ASSISTANT_EXAMPLE_QUESTIONS[2]]: `At VirtuCareBD.AI (Dec 2024 – Feb 2026, a sister concern of LABAID Cancer Hospital), Swapon worked as an AR/VR Developer (Programmer) building AR-based anatomy and surgical simulation apps and a gynecology training simulation for doctors and nurses. Related projects include ${medicalProjects.join(', ')}.`,
    [ASSISTANT_EXAMPLE_QUESTIONS[3]]: `Swapon has been building games and interactive software since January 2015 (plus earlier computer teaching from 2013). Currently he is ${currentExp ? `${currentExp.data.role} at ${currentExp.data.company} (${currentExp.data.period})` : 'an XR Developer'}. Recent roles include: ${recentRoles.join('; ')}.`,
    [ASSISTANT_EXAMPLE_QUESTIONS[4]]: `You can reach Swapon via the contact form on this page (#contact) or by email at ${profile.email}. His public repositories are at ${profile.links.github}, and his LinkedIn profile is ${profile.links.linkedin}.`,
  };

  cachedPack = {
    knowledgeText,
    systemInstruction,
    searchableLower: knowledgeText.toLowerCase(),
    faqAnswers,
    contactEmail: profile.email,
  };
  return cachedPack;
}

export function answerFromFallback(
  question: string,
  pack: KnowledgePack
): string {
  const q = question.trim();
  const normalized = q.toLowerCase();

  const direct = pack.faqAnswers[q];
  if (direct) return direct;

  // Detect explicit "Does he know <X>?" / "experience with <X>" queries for unknown tech
  const skillProbe = normalized.match(
    /(?:know|use|work with|experience (?:with|in)|familiar with)\s+([a-z0-9.+#/-]{2,24})/i
  );
  if (skillProbe?.[1]) {
    const term = skillProbe[1].replace(/[?!.,]+$/, '').toLowerCase();
    const stopWords = new Set(['xr', 'vr', 'ar', 'ai', '3d', 'games', 'it', 'that', 'this', 'which', 'what']);
    if (!stopWords.has(term) && !pack.searchableLower.includes(term)) {
      return `I don't have that information. You can ask Swapon directly through the contact form (#contact) or at ${pack.contactEmail}.`;
    }
  }

  if (/\b(medical|virtucare|labaid|anatomy|gynecology|surgical|biolab)\b/.test(normalized)) {
    return pack.faqAnswers[ASSISTANT_EXAMPLE_QUESTIONS[2]];
  }
  if (/\b(engine|unity|unreal|uefn|phaser|solar2d|language|c#|c\+\+|python|lua|verse|blueprint|skill|stack)\b/.test(normalized)) {
    return pack.faqAnswers[ASSISTANT_EXAMPLE_QUESTIONS[1]];
  }
  if (/\b(xr|ar|vr|mr|spatial|xreal|openxr|android xr|kinect|tulip|project|glasses)\b/.test(normalized)) {
    return pack.faqAnswers[ASSISTANT_EXAMPLE_QUESTIONS[0]];
  }
  if (/\b(career|timeline|experience|role|current|job|work history|dreamerz|techno magic|caffebd|education|degree)\b/.test(normalized)) {
    return pack.faqAnswers[ASSISTANT_EXAMPLE_QUESTIONS[3]];
  }
  if (/\b(contact|email|github|linkedin|hire|reach|resume|cv|available|availability)\b/.test(normalized)) {
    return pack.faqAnswers[ASSISTANT_EXAMPLE_QUESTIONS[4]];
  }

  return `I don't have that information. You can ask Swapon directly through the contact form (#contact) or at ${pack.contactEmail}.`;
}
