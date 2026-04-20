const Sentry = require('@sentry/node');

Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: process.env.SENTRY_TRACES_SAMPLE_RATE ? parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE) : 0.1,
    profilesSampleRate: process.env.SENTRY_PROFILES_SAMPLE_RATE ? parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE) : 0.1,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.SENTRY_RELEASE,
    enabled: process.env.NODE_ENV === 'production',
});
