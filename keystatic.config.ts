import { collection, config, fields, singleton } from '@keystatic/core';

const isProd = process.env.NODE_ENV === 'production';

export default config({
  storage: isProd
    ? {
        kind: 'github',
        repo: 'AlphaNoob07/gdev_portfolio',
      }
    : {
        kind: 'local',
      },
  collections: {
    blog: collection({
      label: 'Blog Posts',
      slugField: 'title',
      path: 'src/content/blog/*',
      format: { contentField: 'content' },
      entryLayout: 'content',
      schema: {
        title: fields.slug({ name: { label: 'Title' } }),
        description: fields.text({
          label: 'Description',
          multiline: true,
          validation: { isRequired: true },
        }),
        publishedAt: fields.date({
          label: 'Published Date',
          validation: { isRequired: true },
        }),
        updatedAt: fields.date({ label: 'Updated Date' }),
        tags: fields.array(fields.text({ label: 'Tag' }), {
          label: 'Tags',
          itemLabel: (props) => props.value || 'Tag',
        }),
        draft: fields.checkbox({ label: 'Draft', defaultValue: false }),
        locale: fields.text({ label: 'Locale', defaultValue: 'en' }),
        content: fields.mdx({ label: 'Content' }),
      },
    }),

    projects: collection({
      label: 'Projects',
      slugField: 'title',
      path: 'src/content/projects/*',
      format: { contentField: 'content' },
      schema: {
        title: fields.slug({ name: { label: 'Title' } }),
        featured: fields.checkbox({ label: 'Featured', defaultValue: false }),
        order: fields.integer({ label: 'Sort Order', defaultValue: 50 }),
        categories: fields.multiselect({
          label: 'Categories',
          options: [
            { label: 'XR', value: 'XR' },
            { label: 'Unity', value: 'Unity' },
            { label: 'Unreal', value: 'Unreal' },
            { label: 'Medical', value: 'Medical' },
            { label: 'AI', value: 'AI' },
            { label: 'Games', value: 'Games' },
          ],
        }),
        summary: fields.text({
          label: 'Summary',
          multiline: true,
          validation: { isRequired: true },
        }),
        year: fields.text({ label: 'Year' }),
        role: fields.text({ label: 'Role' }),
        organization: fields.text({ label: 'Organization' }),
        tech: fields.array(fields.text({ label: 'Technology' }), {
          label: 'Technologies',
          itemLabel: (props) => props.value || 'Tech',
        }),
        source: fields.select({
          label: 'Source',
          options: [
            { label: 'Existing Site', value: 'existing-site' },
            { label: 'GitHub README', value: 'github-readme' },
            { label: 'GitHub Repo', value: 'github-repo' },
            { label: 'VirtuCare', value: 'virtucare' },
            { label: 'Tulip Tech (Generic)', value: 'tulip-generic' },
            { label: 'LinkedIn', value: 'linkedin' },
          ],
          defaultValue: 'existing-site',
        }),
        confidentiality: fields.select({
          label: 'Confidentiality',
          options: [
            { label: 'Public', value: 'public' },
            { label: 'Generic Only', value: 'generic-only' },
          ],
          defaultValue: 'public',
        }),
        poster: fields.text({ label: 'Poster Image Path' }),
        previewVideo: fields.text({ label: 'Preview Video Path' }),
        draft: fields.checkbox({ label: 'Draft', defaultValue: false }),
        content: fields.mdx({ label: 'Case Study Notes' }),
      },
    }),

    testimonials: collection({
      label: 'Testimonials',
      slugField: 'author',
      path: 'src/content/testimonials/*',
      format: { data: 'yaml' },
      schema: {
        author: fields.slug({ name: { label: 'Author Name' } }),
        role: fields.text({ label: 'Role' }),
        company: fields.text({ label: 'Company' }),
        relationship: fields.text({ label: 'Relationship' }),
        date: fields.text({ label: 'Date' }),
        quote: fields.text({
          label: 'Quote',
          multiline: true,
          validation: { isRequired: true },
        }),
        source: fields.select({
          label: 'Verification Source',
          options: [
            { label: 'LinkedIn Export', value: 'linkedin' },
            { label: 'Written Permission', value: 'written-permission' },
          ],
          defaultValue: 'linkedin',
        }),
      },
    }),

    certifications: collection({
      label: 'Certifications',
      slugField: 'name',
      path: 'src/content/certifications/*',
      format: { data: 'yaml' },
      schema: {
        name: fields.slug({ name: { label: 'Certification Name' } }),
        authority: fields.text({
          label: 'Issuing Authority',
          validation: { isRequired: true },
        }),
        licenseNumber: fields.text({ label: 'License Number' }),
        issuedAt: fields.text({ label: 'Issued Date' }),
        expiresAt: fields.text({ label: 'Expiration Date' }),
        url: fields.url({ label: 'Credential URL' }),
        source: fields.select({
          label: 'Source',
          options: [
            { label: 'LinkedIn Export', value: 'linkedin' },
            { label: 'Verified Credential', value: 'verified-credential' },
          ],
          defaultValue: 'linkedin',
        }),
      },
    }),
  },

  singletons: {
    availability: singleton({
      label: 'Availability',
      path: 'src/content/availability',
      format: { data: 'yaml' },
      schema: {
        status: fields.select({
          label: 'Status',
          options: [
            { label: 'Hidden', value: 'hidden' },
            { label: 'Available', value: 'available' },
            { label: 'Limited', value: 'limited' },
            { label: 'Booked', value: 'booked' },
          ],
          defaultValue: 'hidden',
        }),
        headline: fields.text({ label: 'Headline' }),
        engagements: fields.multiselect({
          label: 'Engagement Types',
          options: [
            { label: 'Freelance', value: 'freelance' },
            { label: 'Contract', value: 'contract' },
            { label: 'Consulting', value: 'consulting' },
            { label: 'XR Collaboration', value: 'xr-collaboration' },
            { label: 'Full-Time', value: 'full-time' },
          ],
        }),
        note: fields.text({ label: 'Note', multiline: true }),
      },
    }),
  },
});
