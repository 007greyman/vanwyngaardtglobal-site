// VWG Staff: company settings. Edit this file; you don't need to touch app.js.
window.VWG_CONFIG = {
  company: 'Van Wyngaardt Global',
  shortName: 'VWG Staff',
  domain: 'vanwyngaardtglobal.com',   // used by "Log In with Domain"
  region: 'UK',                       // shown after the version number in the menu
  currency: '£',

  // Support screen and help texts
  supportPhone: '+44 7487 707580',    // main support line
  supportPhoneOoh: '',                // optional separate evenings & weekends line
  supportEmail: 'info@vanwyngaardtglobal.com',
  emergencyPhone: '999',

  welfareMinutes: 60,                 // how often lone workers must do a welfare check
  siteRadiusMetres: 200,              // clock on/off further than this from a site is flagged (each site can override)
  startPage: 'shifts',                // first screen after signing in
  loginBackground: '',                // optional photo behind the sign-in screen, e.g. 'login-bg.jpg'

  // Shared database (Supabase). Leave both empty to run on this device only, with demo data.
  // Supabase dashboard > Project Settings > API: the "Project URL" and a publishable (or legacy anon) key.
  // Never put the service_role / secret key here.
  supabaseUrl: 'https://surarxooallaxdmrndma.supabase.co',
  supabaseAnonKey: 'sb_publishable_prAUY0c4axInxhEyLidx7g_QSepylfc', // publishable key: safe to be public
};
