import { defineCollection } from 'astro:content';
import { glob, type Loader } from 'astro/loaders';
import { z } from 'astro/zod';

function optionalGlob(options: Parameters<typeof glob>[0]): Loader {
  const inner = glob(options);
  return {
    ...inner,
    load: (context) => {
      const filteredLogger = Object.assign(
        Object.create(Object.getPrototypeOf(context.logger)),
        context.logger,
        {
          warn(message: string) {
            if (message.startsWith('No files found matching ')) return;
            context.logger.warn(message);
          },
        }
      );
      return inner.load({
        ...context,
        logger: filteredLogger,
      });
    },
  };
}

const profile = defineCollection({
  loader: glob({ pattern: 'profile.yaml', base: './src/content' }),
  schema: z.object({
    name: z.string().min(1),
    fullName: z.string().min(1),
    headline: z.string().min(1),
    intro: z.string().min(1),
    email: z.email(),
    location: z.string().min(1),
    githubUsername: z.string().min(1),
    links: z.object({
      github: z.url(),
      linkedin: z.url(),
    }),
    about: z.array(z.string().min(1)).min(1),
    education: z.array(
      z.object({
        degree: z.string().min(1),
        institution: z.string().min(1),
        period: z.string().min(1),
        location: z.string().min(1),
      })
    ),
    expertise: z.array(z.string().min(1)),
    curatedRepos: z.array(z.string().min(1)),
    i18n: z.object({
      defaultLocale: z.literal('en'),
      locales: z.array(z.string().min(1)).min(1),
    }),
  }),
});

const experience = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/experience' }),
  schema: z.object({
    order: z.number().int().positive(),
    company: z.string().min(1),
    companyNote: z.string().optional(),
    companyUrl: z.url().optional(),
    role: z.string().min(1),
    period: z.string().min(1),
    startDate: z.string().min(1),
    endDate: z.string().optional(),
    current: z.boolean(),
    needsConfirmation: z.boolean().default(false),
    location: z.string().min(1),
    summary: z.string().optional(),
    responsibilities: z.array(z.string().min(1)),
    tech: z.array(z.string().min(1)),
    relatedProjects: z.array(z.string().min(1)).default([]),
  }),
});

const projects = defineCollection({
  loader: glob({ pattern: '*.mdx', base: './src/content/projects' }),
  schema: z.object({
    title: z.string().min(1),
    featured: z.boolean(),
    order: z.number().int().positive(),
    categories: z
      .array(z.enum(['XR', 'Unity', 'Unreal', 'Medical', 'AI', 'Games']))
      .min(1),
    summary: z.string().min(1),
    year: z.string().optional(),
    role: z.string().optional(),
    organization: z.string().optional(),
    tech: z.array(z.string().min(1)).min(1),
    source: z.enum([
      'existing-site',
      'github-readme',
      'github-repo',
      'virtucare',
      'tulip-generic',
    ]),
    confidentiality: z.enum(['public', 'generic-only']).default('public'),
    poster: z.string().optional(),
    previewVideo: z.string().optional(),
    gallery: z
      .array(
        z.object({
          src: z.string().min(1),
          alt: z.string().min(1),
          caption: z.string().optional(),
        })
      )
      .default([]),
    links: z
      .object({
        repo: z.url().optional(),
        live: z.url().optional(),
        video: z.url().optional(),
      })
      .optional(),
    caseStudy: z
      .object({
        overview: z.string().optional(),
        objectives: z.array(z.string().min(1)).optional(),
        challenges: z.array(z.string().min(1)).optional(),
        solutions: z.array(z.string().min(1)).optional(),
        outcomes: z.array(z.string().min(1)).optional(),
      })
      .optional(),
    draft: z.boolean().default(false),
  }),
});

const skills = defineCollection({
  loader: glob({ pattern: 'skills.yaml', base: './src/content' }),
  schema: z.object({
    categories: z.array(
      z.object({
        id: z.enum([
          'engines',
          'programming',
          'xr-spatial',
          'game-dev',
          'ai-emerging',
        ]),
        label: z.string().min(1),
        skills: z.array(
          z.object({
            name: z.string().min(1),
            source: z.enum(['resume', 'github-readme', 'tulip-generic']),
            relatedProjects: z.array(z.string().min(1)).default([]),
          })
        ),
      })
    ),
  }),
});

const blog = defineCollection({
  loader: optionalGlob({ pattern: '*.mdx', base: './src/content/blog' }),
  schema: z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    publishedAt: z.coerce.date(),
    updatedAt: z.coerce.date().optional(),
    tags: z.array(z.string().min(1)).default([]),
    draft: z.boolean().default(false),
    locale: z.string().default('en'),
  }),
});

const testimonials = defineCollection({
  loader: optionalGlob({
    pattern: '*.yaml',
    base: './src/content/testimonials',
  }),
  schema: z.object({
    author: z.string().min(1),
    role: z.string().optional(),
    company: z.string().optional(),
    relationship: z.string().optional(),
    date: z.string().optional(),
    quote: z.string().min(1),
    source: z.enum(['linkedin', 'written-permission']),
  }),
});

const certifications = defineCollection({
  loader: optionalGlob({
    pattern: '*.yaml',
    base: './src/content/certifications',
  }),
  schema: z.object({
    name: z.string().min(1),
    authority: z.string().min(1),
    licenseNumber: z.string().optional(),
    issuedAt: z.string().optional(),
    expiresAt: z.string().optional(),
    url: z.url().optional(),
    source: z.enum(['linkedin', 'verified-credential']),
  }),
});

const availability = defineCollection({
  loader: glob({ pattern: 'availability.yaml', base: './src/content' }),
  schema: z.object({
    status: z
      .enum(['hidden', 'available', 'limited', 'booked'])
      .default('hidden'),
    headline: z.string().optional(),
    engagements: z
      .array(
        z.enum([
          'freelance',
          'contract',
          'consulting',
          'xr-collaboration',
          'full-time',
        ])
      )
      .default([]),
    note: z.string().optional(),
  }),
});

export const collections = {
  profile,
  experience,
  projects,
  skills,
  blog,
  testimonials,
  certifications,
  availability,
};
