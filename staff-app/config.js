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
  startPage: 'shifts',                // first screen after signing in
  loginBackground: '',                // optional photo behind the sign-in screen, e.g. 'login-bg.jpg'

  // Shared database (Supabase). Leave both empty to run on this device only, with demo data.
  // Supabase dashboard > Project Settings > API: copy "Project URL" and the "anon public" key.
  supabaseUrl: '',
  supabaseAnonKey: '',
};
