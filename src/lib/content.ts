import { getCollection, type CollectionEntry } from 'astro:content';

export type ProfileData = CollectionEntry<'profile'>['data'];
export type ExperienceEntry = CollectionEntry<'experience'>;
export type ProjectEntry = CollectionEntry<'projects'>;
export type SkillsData = CollectionEntry<'skills'>['data'];
export type BlogEntry = CollectionEntry<'blog'>;
export type TestimonialEntry = CollectionEntry<'testimonials'>;
export type CertificationEntry = CollectionEntry<'certifications'>;
export type AvailabilityData = CollectionEntry<'availability'>['data'];

export interface SkillNode {
  name: string;
  categoryId: SkillsData['categories'][number]['id'];
  categoryLabel: string;
  source: 'resume' | 'github-readme' | 'tulip-generic';
  projectIds: string[];
}

export interface SkillEdge {
  from: string;
  to: string;
  sharedProjectIds: string[];
}

export interface SkillConstellation {
  nodes: SkillNode[];
  edges: SkillEdge[];
}

export async function getProfile(): Promise<ProfileData> {
  const entries = await getCollection('profile');
  if (entries.length === 0) {
    throw new Error('Missing src/content/profile.yaml');
  }
  return entries[0].data;
}

export async function getAvailability(): Promise<AvailabilityData> {
  const entries = await getCollection('availability');
  if (entries.length === 0) {
    return { status: 'hidden', engagements: [] };
  }
  return entries[0].data;
}

export async function getSkills(): Promise<SkillsData> {
  const entries = await getCollection('skills');
  if (entries.length === 0) {
    throw new Error('Missing src/content/skills.yaml');
  }
  return entries[0].data;
}

export async function getExperience(): Promise<ExperienceEntry[]> {
  const entries = await getCollection('experience');
  return [...entries].sort((a, b) => a.data.order - b.data.order);
}

export async function getProjects(includeDrafts = false): Promise<ProjectEntry[]> {
  const entries = await getCollection('projects');
  return entries
    .filter((entry) => includeDrafts || !entry.data.draft)
    .sort((a, b) => a.data.order - b.data.order);
}

export async function getBlogPosts(includeDrafts = false): Promise<BlogEntry[]> {
  const entries = await getCollection('blog');
  return entries
    .filter((entry) => includeDrafts || !entry.data.draft)
    .sort(
      (a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime()
    );
}

export async function getTestimonials(): Promise<TestimonialEntry[]> {
  return getCollection('testimonials');
}

export async function getCertifications(): Promise<CertificationEntry[]> {
  return getCollection('certifications');
}

function normalizeSkillKey(value: string): string {
  return value.trim().toLowerCase();
}

export function validateContentIntegrity(
  experienceEntries: ExperienceEntry[],
  skillsData: SkillsData,
  projectEntries: ProjectEntry[]
): void {
  const projectIds = new Set(projectEntries.map((p) => p.id));

  for (const exp of experienceEntries) {
    for (const slug of exp.data.relatedProjects) {
      if (!projectIds.has(slug)) {
        throw new Error(
          `Experience "${exp.id}" references unknown project slug "${slug}".`
        );
      }
    }
  }

  for (const category of skillsData.categories) {
    for (const skill of category.skills) {
      for (const slug of skill.relatedProjects) {
        if (!projectIds.has(slug)) {
          throw new Error(
            `Skill "${skill.name}" in category "${category.id}" references unknown project slug "${slug}".`
          );
        }
      }
    }
  }
}

export function buildSkillConstellation(
  skillsData: SkillsData,
  projectEntries: ProjectEntry[]
): SkillConstellation {
  const knownSkills = new Map<string, SkillNode>();

  for (const category of skillsData.categories) {
    for (const skill of category.skills) {
      knownSkills.set(normalizeSkillKey(skill.name), {
        name: skill.name,
        categoryId: category.id,
        categoryLabel: category.label,
        source: skill.source,
        projectIds: [...skill.relatedProjects],
      });
    }
  }

  // Merge project tech[] associations and compute co-occurrence edges at build time
  const edgeMap = new Map<string, Set<string>>();

  for (const project of projectEntries) {
    const matchedSkillNames: string[] = [];

    for (const techName of project.data.tech) {
      const node = knownSkills.get(normalizeSkillKey(techName));
      if (!node) continue;

      if (!node.projectIds.includes(project.id)) {
        node.projectIds.push(project.id);
      }
      if (!matchedSkillNames.includes(node.name)) {
        matchedSkillNames.push(node.name);
      }
    }

    for (let i = 0; i < matchedSkillNames.length; i += 1) {
      for (let j = i + 1; j < matchedSkillNames.length; j += 1) {
        const [a, b] = [matchedSkillNames[i], matchedSkillNames[j]].sort();
        const edgeKey = `${a}::${b}`;
        let shared = edgeMap.get(edgeKey);
        if (!shared) {
          shared = new Set<string>();
          edgeMap.set(edgeKey, shared);
        }
        shared.add(project.id);
      }
    }
  }

  const edges: SkillEdge[] = [];
  for (const [edgeKey, sharedSet] of edgeMap.entries()) {
    const [from, to] = edgeKey.split('::');
    edges.push({
      from,
      to,
      sharedProjectIds: [...sharedSet],
    });
  }

  return {
    nodes: [...knownSkills.values()],
    edges,
  };
}
