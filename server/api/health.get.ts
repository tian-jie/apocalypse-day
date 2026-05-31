export default defineEventHandler(() => {
  return {
    service: 'Aether Watch API',
    status: 'Nuxt server is ready for signal ingestion.',
    checkedAt: new Date().toISOString(),
  }
})